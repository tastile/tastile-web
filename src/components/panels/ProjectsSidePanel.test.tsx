/** @vitest-environment jsdom */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsSidePanel } from "./ProjectsSidePanel";
import { renderWithMantine } from "@/test/render-with-mantine";

const mockCreateWorkspace = vi.fn();
const mockDeleteWorkspace = vi.fn();
const mockRefresh = vi.fn();
const mockUseProjects = vi.fn();

const routerReplace = vi.fn();
const routerPush = vi.fn();

vi.mock("next/navigation", () => ({
	usePathname: () => "/dashboard",
	useRouter: () => ({ replace: routerReplace, push: routerPush }),
	useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lib/i18n/use-translation", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/lib/hooks/use-projects", () => ({
	useProjects: () => mockUseProjects(),
	createWorkspace: (...args: unknown[]) => mockCreateWorkspace(...args),
	deleteWorkspace: (...args: unknown[]) => mockDeleteWorkspace(...args),
	orderWorkspaceTree: (items: unknown[]) => items,
}));

// Mantine Select renders a plain combobox in jsdom; stub it out so we can drive
// the create form by data-testid without bringing up the real popover.
vi.mock("@mantine/core", async () => {
	const actual = await vi.importActual<typeof import("@mantine/core")>("@mantine/core");
	return {
		...actual,
		Select: ({
			value,
			onChange,
			"data-testid": testId,
		}: {
			value: string | null;
			onChange: (v: string | null) => void;
			"data-testid"?: string;
		}) => (
			<select
				data-testid={testId}
				value={value ?? ""}
				onChange={(event) => onChange(event.target.value || null)}
			>
				<option value="">(none)</option>
				<option value="ws-existing">Existing workspace</option>
			</select>
		),
		Tree: () => null,
		useTree: () => ({ toggleExpanded: vi.fn() }),
		getTreeExpandedState: () => ({}),
	};
});

beforeEach(() => {
	mockCreateWorkspace.mockReset();
	mockDeleteWorkspace.mockReset();
	mockRefresh.mockReset();
	routerReplace.mockReset();
	routerPush.mockReset();
	mockUseProjects.mockReturnValue({
		workspaces: [],
		loading: false,
		error: null,
		refresh: mockRefresh,
	});
	// Default success shape; individual tests override with mockRejectedValue.
	mockCreateWorkspace.mockResolvedValue({ id: "ws-new" } as never);
	mockDeleteWorkspace.mockResolvedValue(undefined as never);
});

afterEach(() => {
	vi.restoreAllMocks();
});

describe("ProjectsSidePanel create flow", () => {
	it("creates a workspace, refreshes, selects it, and resets the form", async () => {
		mockRefresh.mockResolvedValue(undefined);

		renderWithMantine(<ProjectsSidePanel />);

		fireEvent.click(screen.getByTestId("project-create"));

		fireEvent.change(await screen.findByTestId("project-create-name"), {
			target: { value: "Demo project" },
		});

		fireEvent.click(screen.getByTestId("project-create-submit"));

		await waitFor(() => expect(mockCreateWorkspace).toHaveBeenCalledTimes(1));
		expect(mockCreateWorkspace).toHaveBeenCalledWith(
			expect.objectContaining({
				display_name: "Demo project",
			}),
		);
		expect(mockRefresh).toHaveBeenCalledTimes(1);

		await waitFor(() => {
			expect(routerReplace).toHaveBeenCalled();
			const last = routerReplace.mock.calls.at(-1)?.[0] as string | undefined;
			expect(last ?? "").toContain("owner=ws-new");
		});

		// Form should reset: name input is no longer present.
		await waitFor(() => {
			expect(screen.queryByTestId("project-create-name")).toBeNull();
		});
	});

	it("captures createError and resets busy flag when createWorkspace rejects", async () => {
		mockCreateWorkspace.mockRejectedValue(new Error("server exploded"));
		mockRefresh.mockResolvedValue(undefined);

		renderWithMantine(<ProjectsSidePanel />);

		fireEvent.click(screen.getByTestId("project-create"));

		fireEvent.change(await screen.findByTestId("project-create-name"), {
			target: { value: "Demo project" },
		});

		fireEvent.click(screen.getByTestId("project-create-submit"));

		await waitFor(() => expect(mockCreateWorkspace).toHaveBeenCalledTimes(1));
		expect(await screen.findByText("server exploded")).toBeTruthy();

		// busy flag reset: submit button returns to its "Create" label.
		await waitFor(() => {
			expect(
				screen.getByRole("button", { name: "Create" }),
			).toBeTruthy();
		});
	});

	it("blocks submit when name is empty without calling the API", async () => {
		renderWithMantine(<ProjectsSidePanel />);

		fireEvent.click(screen.getByTestId("project-create"));
		await screen.findByTestId("project-create-name");

		fireEvent.click(screen.getByTestId("project-create-submit"));

		expect(mockCreateWorkspace).not.toHaveBeenCalled();
	});

	it("normalizes slug to lowercase and strips non-slug characters", async () => {
		mockRefresh.mockResolvedValue(undefined);

		renderWithMantine(<ProjectsSidePanel />);

		fireEvent.click(screen.getByTestId("project-create"));

		const nameInput = await screen.findByTestId("project-create-name");
		fireEvent.change(nameInput, { target: { value: "Hello" } });
		fireEvent.change(screen.getByTestId("project-create-slug"), {
			target: { value: "Hello World!!" },
		});

		fireEvent.click(screen.getByTestId("project-create-submit"));

		await waitFor(() => expect(mockCreateWorkspace).toHaveBeenCalledTimes(1));
		expect(mockCreateWorkspace).toHaveBeenCalledWith(
			expect.objectContaining({ slug: "hello-world--" }),
		);
	});

	it("keeps form values when the API rejects (no clear on error)", async () => {
		mockCreateWorkspace.mockRejectedValueOnce(new Error("nope"));
		mockRefresh.mockResolvedValue(undefined);

		renderWithMantine(<ProjectsSidePanel />);

		fireEvent.click(screen.getByTestId("project-create"));

		const nameInput = await screen.findByTestId("project-create-name");
		fireEvent.change(nameInput, { target: { value: "Sticky value" } });

		fireEvent.click(screen.getByTestId("project-create-submit"));

		await waitFor(() => expect(mockCreateWorkspace).toHaveBeenCalledTimes(1));
		await screen.findByText("nope");
		// Dialog still open and value still present.
		expect((nameInput as HTMLInputElement).value).toBe("Sticky value");
	});

	it("prevents double-submit while a request is in flight", async () => {
		let resolveCreate: (value: { id: string }) => void = () => {};
		mockCreateWorkspace.mockReturnValueOnce(
			new Promise((resolve) => {
				resolveCreate = resolve;
			}),
		);
		mockRefresh.mockResolvedValue(undefined);

		renderWithMantine(<ProjectsSidePanel />);

		fireEvent.click(screen.getByTestId("project-create"));
		const nameInput = await screen.findByTestId("project-create-name");
		fireEvent.change(nameInput, { target: { value: "Demo" } });

		const submit = screen.getByTestId("project-create-submit");
		fireEvent.click(submit);
		fireEvent.click(submit);

		expect(mockCreateWorkspace).toHaveBeenCalledTimes(1);

		resolveCreate({ id: "ws-new" });
		await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
	});
});