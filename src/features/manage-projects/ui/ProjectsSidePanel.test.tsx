/** @vitest-environment jsdom */

import { fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProjectsSidePanel } from "./ProjectsSidePanel";
import { renderWithMantine } from "@/test/render-with-mantine";
import { type Workspace } from "@/shared/hooks/use-workspaces";

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

vi.mock("@/shared/i18n/use-translation", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@/shared/hooks/use-workspaces", () => ({
	useWorkspaces: () => mockUseProjects(),
	createWorkspace: (...args: unknown[]) => mockCreateWorkspace(...args),
	deleteWorkspace: (...args: unknown[]) => mockDeleteWorkspace(...args),
	orderWorkspaceTree: (items: Workspace[]) =>
		items.map((workspace) => ({ workspace, depth: 0 })),
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
		// Mantine's real Tree renders its rows through a `renderNode` callback.
		// In jsdom that component does not settle, so this stub flattens the
		// nested data and invokes the SAME `renderNode` (and therefore the real
		// `onSelect` / `onDelete` handlers from ProjectsSidePanel) so the delete
		// affordance and its failure path stay testable.
		Tree: ({
			data,
			renderNode,
		}: {
			data: Array<{ value: string; label: string; children?: typeof data }>;
			renderNode: (payload: Record<string, unknown>) => React.ReactNode;
		}) => {
const rows: React.ReactNode[] = [];
		const visit = (nodes: typeof data) => {
			for (const node of nodes) {
				rows.push(
					<div key={node.value}>
						{renderNode({
							node,
							expanded: true,
							hasChildren: Boolean(node.children?.length),
							elementProps: { role: "treeitem" },
						})}
					</div>,
				);
				if (node.children) visit(node.children);
			}
		};
			visit(data);
			return <>{rows}</>;
		},
		useTree: () => ({ toggleExpanded: () => {} }),
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

		const user = userEvent.setup();
		renderWithMantine(<ProjectsSidePanel />);

		await user.click(screen.getByTestId("project-create"));

		const nameInput = await screen.findByTestId("project-create-name");
		await user.clear(nameInput);
		await user.type(nameInput, "Hello");

		const slugInput = screen.getByTestId("project-create-slug");
		await user.clear(slugInput);
		await user.type(slugInput, "Hello World!!");

		// Use the form element itself to trigger submit, since the button
		// click may not propagate through Mantine's Modal portal reliably.
		const form = slugInput.closest("form")!;
		fireEvent.submit(form);

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

describe("ProjectsSidePanel delete flow", () => {
	const baseWorkspaces = [
		{
			id: "me",
			kind: 0,
			display_name: "Personal",
			slug: null,
			email: null,
			parent_subject_id: null,
			color: null,
			owner_user_id: "user-1",
			disabled_at: null,
			created_at: "2026-01-01T00:00:00.000Z",
			updated_at: "2026-01-01T00:00:00.000Z",
		},
		{
			id: "ws-team",
			kind: 1,
			display_name: "Team",
			slug: "team",
			email: null,
			parent_subject_id: null,
			color: "#3b82f6",
			owner_user_id: "user-1",
			disabled_at: null,
			created_at: "2026-01-01T00:00:00.000Z",
			updated_at: "2026-01-01T00:00:00.000Z",
		},
	];

	beforeEach(() => {
		mockRefresh.mockResolvedValue(undefined);
		mockUseProjects.mockReturnValue({
			workspaces: baseWorkspaces,
			loading: false,
			error: null,
			refresh: mockRefresh,
		});
	});

	it("shows the delete affordance on every row including the personal scope", async () => {
		vi.spyOn(window, "confirm").mockReturnValue(false);
		renderWithMantine(<ProjectsSidePanel />);

		// The × button is rendered for the USER-kind personal row too —
		// the server enforces the "cannot delete personal scope" rule
		// (v1/15 §6 #15), the client no longer hides the affordance.
		expect(await screen.findByTestId("project-delete-me")).toBeTruthy();
		expect(screen.getByTestId("project-delete-ws-team")).toBeTruthy();
	});

	it("attempts deletion of the personal scope and surfaces the server rejection as an alert", async () => {
		const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
		vi.spyOn(window, "confirm").mockReturnValue(true);
		mockDeleteWorkspace.mockRejectedValueOnce(new Error("personal scope protected"));

		renderWithMantine(<ProjectsSidePanel />);
		const user = userEvent.setup();
		await user.click(await screen.findByTestId("project-delete-me"));

		await waitFor(() =>
			expect(mockDeleteWorkspace).toHaveBeenCalledWith("me"),
		);
		expect(alertSpy).toHaveBeenCalledWith(
			"Failed to delete: personal scope protected",
		);
		// No refresh on failure; the panel stays intact.
		expect(mockRefresh).not.toHaveBeenCalled();
	});

	it("deletes a non-personal workspace and refreshes the list", async () => {
		vi.spyOn(window, "confirm").mockReturnValue(true);
		mockDeleteWorkspace.mockResolvedValue(undefined);

		renderWithMantine(<ProjectsSidePanel />);
		const user = userEvent.setup();
		await user.click(await screen.findByTestId("project-delete-ws-team"));

		await waitFor(() =>
			expect(mockDeleteWorkspace).toHaveBeenCalledWith("ws-team"),
		);
		expect(mockRefresh).toHaveBeenCalledTimes(1);
	});

	it("does not delete when the user cancels the confirmation dialog", async () => {
		vi.spyOn(window, "confirm").mockReturnValue(false);

		renderWithMantine(<ProjectsSidePanel />);
		const user = userEvent.setup();
		await user.click(await screen.findByTestId("project-delete-ws-team"));

		expect(mockDeleteWorkspace).not.toHaveBeenCalled();
	});
});