/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { QuickCreateTask } from "./QuickCreateTask";
import { renderWithMantine } from "@/test/render-with-mantine";

vi.mock("@/shared/hooks/use-workspaces", () => ({
  useWorkspaces: vi.fn(),
}));

import { useWorkspaces } from "@/shared/hooks/use-workspaces";

const mockUseWorkspaces = vi.mocked(useWorkspaces);

// Mantine's Autosize Textarea calls scrollIntoView on mount.
if (
  typeof Element !== "undefined" &&
  typeof Element.prototype.scrollIntoView !== "function"
) {
  Element.prototype.scrollIntoView = function scrollIntoView() {};
}

// Mantine's Autosize listens on `document.fonts` for font-loading events.
// jsdom does not implement the Font Loading API, so stub the interface.
if (
  typeof document !== "undefined" &&
  typeof (document as { fonts?: unknown }).fonts === "undefined"
) {
  (document as unknown as { fonts: { addEventListener: () => void; removeEventListener: () => void } }).fonts = {
    addEventListener: () => {},
    removeEventListener: () => {},
  };
}

function resetStore() {
  useQuickCreateStore.setState({
    isOpen: true,
    mode: "create",
    editingId: null,
    editingTileId: null,
    workflowKind: "task",
    identity: {
      kind: 0,
      title: "",
      description: null,
      externalId: null,
      visual: { color: "#3b82f6", icon: "check-circle" },
    },
    time: {
      span: { start: "", end: "" },
      durationMinMax: { minMs: 30 * 60_000, maxMs: 30 * 60_000 },
      whenMode: "none",
      timeOfDayMode: "unspecified",
      timeOfDayStart: "",
      timeOfDayEnd: "",
      referenceId: null,
      referenceLabel: "",
    },
    meta: { ownerSubjectId: null, memo: "", isLabelOnly: false },
  });
}

describe("QuickCreateTask", () => {
  beforeEach(() => {
    resetStore();
    mockUseWorkspaces.mockReturnValue({
      workspaces: [],
      loading: false,
      error: null,
      refresh: vi.fn().mockResolvedValue(undefined),
    });
  });

  afterEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  it("renders the title input with the current identity.title", () => {
    renderWithMantine(<QuickCreateTask />);
    const titleInput = screen.getByTestId("task-title") as HTMLInputElement;
    expect(titleInput).toBeInTheDocument();
    expect(titleInput.value).toBe("");
  });

  it("writes the typed title to identity.title in the store", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateTask />);

    const titleInput = screen.getByTestId("task-title");
    await user.type(titleInput, "Buy milk");

    expect(useQuickCreateStore.getState().identity.title).toBe("Buy milk");
  });

  it("renders duration preset chips", () => {
    renderWithMantine(<QuickCreateTask />);
    expect(screen.getByTestId("task-duration-preset-15")).toBeInTheDocument();
    expect(screen.getByTestId("task-duration-preset-30")).toBeInTheDocument();
    expect(screen.getByTestId("task-duration-preset-60")).toBeInTheDocument();
    expect(screen.getByTestId("task-duration-preset-90")).toBeInTheDocument();
    expect(screen.getByTestId("task-duration-preset-120")).toBeInTheDocument();
  });

  it("applies a preset duration when its chip is clicked", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateTask />);

    await user.click(screen.getByTestId("task-duration-preset-60"));

    const { durationMinMax } = useQuickCreateStore.getState().time;
    expect(durationMinMax.minMs).toBe(60 * 60_000);
    expect(durationMinMax.maxMs).toBe(60 * 60_000);
  });

  it("reflects the default duration as the active preset on first render", () => {
    renderWithMantine(<QuickCreateTask />);
    // durationMinMax = 30min by default → preset-30 chip should be the filled one
    const preset30 = screen.getByTestId("task-duration-preset-30");
    expect(preset30.getAttribute("data-variant")).toBe("filled");
  });

  it("renders the due-date and due-time inputs always visible", async () => {
    renderWithMantine(<QuickCreateTask />);

    expect(screen.getByTestId("task-due-date")).toBeInTheDocument();
    expect(screen.getByTestId("task-due-time")).toBeInTheDocument();
  });

  it("writes the memo to meta.memo as the user types", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateTask />);

    const memoInput = screen.getByTestId("task-memo");
    await user.type(memoInput, "remember");

    expect(useQuickCreateStore.getState().meta.memo).toBe("remember");
  });

  it("exposes the open-details button that opens the task details sub-panel", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateTask />);

    await user.click(screen.getByTestId("task-open-details"));

    // Sub-panel heading becomes visible in the document
    expect(screen.getByRole("heading", { name: /task details/i })).toBeInTheDocument();
  });

  it("closes the panel via the close button (calls store.close)", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateTask />);

    await user.click(screen.getByTestId("quick-create-task-close"));

    expect(useQuickCreateStore.getState().isOpen).toBe(false);
  });

  it("renders the workflow batch and project picker", () => {
    renderWithMantine(<QuickCreateTask />);
    expect(screen.getByTestId("workflow-batch-task")).toBeInTheDocument();
    expect(screen.getByTestId("task-project-picker")).toBeInTheDocument();
  });
});
