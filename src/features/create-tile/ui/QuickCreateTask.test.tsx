/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLocaleStore } from "@/shared/stores/locale-store";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { QuickCreateTask } from "./QuickCreateTask";
import { renderWithMantine } from "@/test/render-with-mantine";

vi.mock("@/shared/hooks/use-workspaces", () => ({
  useWorkspaces: vi.fn(),
  orderWorkspaceTree: (items: unknown[]) =>
    (items as Array<{ id: string; display_name: string }>).map((w, depth) => ({
      workspace: w,
      depth,
    })),
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
      timeModel: "duration_only",
      schedulableWindow: { start: "", end: "" },
      span: { start: "", end: "" },
      durationMinMax: { minMs: 30 * 60_000, maxMs: 30 * 60_000 },
      whenMode: "none",
      timeOfDayMode: "unspecified",
      timeOfDayStart: "",
      timeOfDayEnd: "",
      referenceId: null,
      referenceLabel: "",
      splitPolicy: "unsplit",
    },
    meta: { ownerSubjectId: null, memo: "", isLabelOnly: false },
  });
}

describe("QuickCreateTask", () => {
  beforeEach(() => {
    // Pin the locale to English so the test stays decoupled from the
    // default ja locale; otherwise labels like "分割しない" don't match
    // the English assertions (e.g. /keep continuous/i).
    useLocaleStore.setState({ locale: "en" });
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

  it("renders the duration select with the default 30 min option", () => {
    renderWithMantine(<QuickCreateTask />);
    expect(screen.getByTestId("task-duration-select")).toBeInTheDocument();
  });

  it("applies the duration when a select option is chosen", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateTask />);

    await user.click(screen.getByTestId("task-duration-select"));
    // Mantine renders the Select's listbox with `display: none` even
    // after the toggle click in jsdom — the dropdown's options exist in
    // the DOM but aren't yet "accessible" by role. `hidden: true` is
    // required to reach them.
    const hourOption = screen.getAllByRole("option", {
      name: "1 hour",
      hidden: true,
    })[0];
    await user.click(hourOption);

    const { durationMinMax } = useQuickCreateStore.getState().time;
    expect(durationMinMax.minMs).toBe(60 * 60_000);
    expect(durationMinMax.maxMs).toBe(60 * 60_000);
  });

  it("reflects the default duration as the selected option on first render", () => {
    renderWithMantine(<QuickCreateTask />);
    // Mantine Select renders the selected option's label in the input value
    expect(screen.getByTestId("task-duration-select")).toHaveValue("30 min");
  });

  it("shows a Custom number input when the Custom option is selected", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateTask />);

    // Custom field is hidden until the user picks "Custom…"
    expect(screen.queryByTestId("task-duration-manual")).not.toBeInTheDocument();

    // Click on the Select wrapper to open the dropdown, then pick Custom.
    const select = screen.getByTestId("task-duration-select");
    await user.click(select);
    // Disambiguate from the TimeSuggestionInput's "Custom…" option by
    // matching the Duration Select's sentinel value.
    const customOptions = screen.getAllByRole("option", {
      name: "Custom…",
      hidden: true,
    });
    const durationCustom = customOptions.find(
      (el) => el.getAttribute("value") === "__custom_duration__",
    );
    if (!durationCustom) throw new Error("Duration Custom option not found");
    await user.click(durationCustom);

    // The manual input appears and is seeded with the previous value (30).
    const manual = screen.getByTestId("task-duration-manual") as HTMLInputElement;
    expect(manual).toBeInTheDocument();
    // NumberInput renders the suffix (" min") alongside the numeric
    // value; we only care about the numeric portion here.
    expect(manual.value).toMatch(/^30\b/);
  });

  it("renders the manual number input when the stored duration is not a preset", () => {
    // A non-preset value (45 min) on first render lands the UI in the
    // Custom branch so the manual input is visible without the user
    // having to pick Custom from the dropdown.
    useQuickCreateStore.setState((prev) => ({
      ...prev,
      time: {
        ...prev.time,
        durationMinMax: { minMs: 45 * 60_000, maxMs: 45 * 60_000 },
      },
    }));

    renderWithMantine(<QuickCreateTask />);

    const manual = screen.getByTestId("task-duration-manual") as HTMLInputElement;
    expect(manual).toBeInTheDocument();
    // NumberInput renders the suffix (" min") alongside the numeric
    // value; we only care about the numeric portion here.
    expect(manual.value).toMatch(/^45\b/);
  });

  it("writes a custom minute value to time.durationMinMax when the manual input changes", async () => {
    const user = userEvent.setup();

    // Seed a custom value before opening the dropdown so isDurationPreset
    // is false on first render and the manual input is visible.
    useQuickCreateStore.setState((prev) => ({
      ...prev,
      time: {
        ...prev.time,
        durationMinMax: { minMs: 45 * 60_000, maxMs: 45 * 60_000 },
      },
    }));

    renderWithMantine(<QuickCreateTask />);

    const manual = screen.getByTestId("task-duration-manual") as HTMLInputElement;
    expect(manual).toBeInTheDocument();
    await user.clear(manual);
    await user.type(manual, "75");

    const { durationMinMax } = useQuickCreateStore.getState().time;
    expect(durationMinMax.minMs).toBe(75 * 60_000);
    expect(durationMinMax.maxMs).toBe(75 * 60_000);
  });

  it("renders the due-date and due-time inputs always visible", async () => {
    renderWithMantine(<QuickCreateTask />);

    expect(screen.getByTestId("task-due-date")).toBeInTheDocument();
    expect(screen.getByTestId("task-due-time")).toBeInTheDocument();
  });

  it("renders the duration select above the due-date input (UX reorder 2026-08-14)", () => {
    renderWithMantine(<QuickCreateTask />);

    const duration = screen.getByTestId("task-duration-select");
    const dueDate = screen.getByTestId("task-due-date");
    // DOCUMENT_POSITION_FOLLOWING (4) means `duration` precedes `dueDate`
    // in document order — the natural reading order for task creation.
    expect(duration.compareDocumentPosition(dueDate) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("renders the split policy row between duration and due-date", () => {
    renderWithMantine(<QuickCreateTask />);

    const duration = screen.getByTestId("task-duration-select");
    const splitPolicy = screen.getByTestId("task-split-policy");
    const dueDate = screen.getByTestId("task-due-date");
    // duration precedes splitPolicy precedes dueDate.
    expect(duration.compareDocumentPosition(splitPolicy) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(splitPolicy.compareDocumentPosition(dueDate) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("defaults the split policy to Keep continuous", () => {
    renderWithMantine(<QuickCreateTask />);

    expect(useQuickCreateStore.getState().time.splitPolicy).toBe("unsplit");
    const keep = screen.getByRole("radio", { name: /keep continuous/i });
    expect((keep as HTMLInputElement).checked).toBe(true);
  });

  it("clicking Allow split updates time.splitPolicy to \"split\"", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateTask />);

    expect(useQuickCreateStore.getState().time.splitPolicy).toBe("unsplit");

    await user.click(screen.getByRole("radio", { name: /allow split/i }));

    expect(useQuickCreateStore.getState().time.splitPolicy).toBe("split");
  });

  it("clicking Keep continuous updates time.splitPolicy back to \"unsplit\"", async () => {
    const user = userEvent.setup();
    // Seed the store with split=true so the second click is a real change.
    useQuickCreateStore.setState((prev) => ({
      ...prev,
      time: { ...prev.time, splitPolicy: "split" as const },
    }));

    renderWithMantine(<QuickCreateTask />);

    await user.click(screen.getByRole("radio", { name: /keep continuous/i }));

    expect(useQuickCreateStore.getState().time.splitPolicy).toBe("unsplit");
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

    // The sub-panel's heading has a stable `id` regardless of locale —
    // assert by id to avoid coupling the test to a specific translation.
    expect(document.getElementById("task-details-heading")).toBeInTheDocument();
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

  it("renders the shared SubtasksSection in the main body", () => {
    renderWithMantine(<QuickCreateTask />);
    expect(screen.getByTestId("task-subtasks")).toBeInTheDocument();
  });

  it("writes a new subtask to the store from the main body section", async () => {
    const user = userEvent.setup();
    renderWithMantine(<QuickCreateTask />);

    // The new SubtasksSection uses a Modal for adding tasks, not an
    // inline input. Click the add button to open the modal, type into
    // the modal title input, then submit.
    await user.click(screen.getByTestId("task-subtasks-add"));
    const input = screen.getByTestId("task-subtasks-modal-title");
    await user.type(input, "Sub-task from main body");
    await user.click(screen.getByTestId("task-subtasks-modal-submit"));

    const tasks = useQuickCreateStore.getState().plan.completion.tasks;
    expect(tasks.at(-1)?.content.title).toBe("Sub-task from main body");
  });
});
