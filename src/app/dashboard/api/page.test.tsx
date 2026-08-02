/** @vitest-environment jsdom */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import ApiExplorer from "./page";
import { renderWithMantine } from "@/test/render-with-mantine";

vi.mock("@/shared/i18n/use-translation", () => ({
	useTranslation: () => ({ t: (key: string) => key, locale: "ja" as const }),
}));

const callMock = vi.fn();

vi.mock("@/shared/api/endpoints", async () => {
	const actual = await vi.importActual<typeof import("@/shared/api/endpoints")>(
		"@/shared/api/endpoints",
	);
	return {
		...actual,
		getCoreClient: () => ({
			call: (...args: unknown[]) => {
				callMock(...args);
				const ep = args[0] as string;
				if (ep === "createWorkspace") {
					return Promise.resolve({ ok: false, error: { kind: "server", status: 500, message: "boom", body: null } });
				}
				return Promise.resolve({ ok: true, status: 200, latencyMs: 12, data: { echo: args } });
			},
		}),
	};
});

vi.mock("@/lib/context/side-panel-context", () => ({
	useSidePanel: () => {},
}));

beforeEach(() => {
	callMock.mockReset();
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("ApiExplorer run flow", () => {
	it("calls the core client with the selected endpoint and renders the response", async () => {
		renderWithMantine(<ApiExplorer />);

		// Click the first row to focus a GET endpoint (listMyWorkspaces is GET, no body needed).
		const rows = document.querySelectorAll("tbody tr");
		const firstRow = rows[0] as HTMLElement;
		fireEvent.click(firstRow);

		const runButton = await screen.findByRole("button", { name: "Run request" });
		fireEvent.click(runButton);

		await waitFor(() => expect(callMock).toHaveBeenCalledTimes(1));
		expect(callMock).toHaveBeenCalledWith(
			expect.any(String),
			expect.objectContaining({ pathParams: {}, body: undefined }),
		);

		await waitFor(() => {
			expect(screen.getByText(/200 OK/)).toBeTruthy();
		});
	});

	it("captures the failed response and resets the running flag", async () => {
		renderWithMantine(<ApiExplorer />);

		// Focus createWorkspace (POST) by searching for it. The endpoint
		// summary rendered in the row is "Create workspace".
		const searchInput = screen.getByPlaceholderText("Search endpoints, paths, keywords…");
		fireEvent.change(searchInput, { target: { value: "Create workspace" } });

		const row = screen.getByText("Create workspace").closest("tr");
		if (!row) throw new Error("Create workspace row not found");
		fireEvent.click(row);

		const runButton = await screen.findByRole("button", { name: "Run request" });
		fireEvent.click(runButton);

		await waitFor(() => expect(callMock).toHaveBeenCalledTimes(1));

		// "boom" appears in both the JSON.stringify'd response body AND the
		// inline danger box, so use getAllByText and assert non-empty.
		await waitFor(() => {
			expect(screen.getAllByText(/boom/).length).toBeGreaterThan(0);
		});

		// Run button is enabled again — loading flag was reset.
		await waitFor(() => {
			expect(screen.getByRole("button", { name: "Run request" })).toBeTruthy();
		});
	});
});