/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLocaleStore } from "@/shared/stores/locale-store";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { renderWithMantine } from "@/test/render-with-mantine";
import { TaskDetailsSubPanel } from "../TaskDetailsSubPanel";
import { SubtasksSection } from "./SubtasksSection";

function resetStore() {
  // Seed a known plan shape so the component renders one titled task
  // (the "Mark done" default seeded by buildDefaultQuickCreateState).
  useQuickCreateStore.setState({
    plan: {
      role: 0,
      references: [],
      completion: {
        root: { kind: 0, children: [], term: null },
        timeRequirements: [],
        tasks: [
          {
            id: "task_seed",
            content: { title: "Mark done", note: null },
            show: null,
            complete: {
              kind: 0,
              children: [],
              term: { kind: "task", value: { taskId: "task_seed", state: 2 } },
            },
            order: [],
            done: false,
          },
        ],
      },
      planning: { placementRules: [], nestingRules: [], flows: [] },
      metrics: [],
      decisions: [],
    },
  });
}

function seedThreeTasks() {
  // Three titled tasks so reorder / disable / duplicate behaviour has
  // enough rows to exercise.
  useQuickCreateStore.setState((s) => ({
    plan: {
      ...s.plan,
      completion: {
        ...s.plan.completion,
        tasks: [
          {
            id: "task_a",
            content: { title: "First", note: null },
            show: null,
            complete: { kind: 0, children: [], term: null },
            order: [],
            done: false,
          },
          {
            id: "task_b",
            content: { title: "Second", note: null },
            show: null,
            complete: { kind: 0, children: [], term: null },
            order: [],
            done: false,
          },
          {
            id: "task_c",
            content: { title: "Third", note: null },
            show: null,
            complete: { kind: 0, children: [], term: null },
            order: [],
            done: false,
          },
        ],
      },
    },
  }));
}

describe("SubtasksSection", () => {
  beforeEach(() => {
    // Pin the locale to en so the English fallback strings are assertable.
    useLocaleStore.setState({ locale: "en" });
    resetStore();
  });

  afterEach(() => {
    resetStore();
    // Restore the ja default to keep other tests deterministic.
    useLocaleStore.setState({ locale: "ja" });
    vi.clearAllMocks();
  });

  it("renders the section root with the given testId", () => {
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);
    expect(screen.getByTestId("subtasks-test-id")).toBeInTheDocument();
  });

  it("renders the heading with the English fallback when the i18n key resolves to empty", () => {
    renderWithMantine(
      <SubtasksSection
        testId="subtasks-test-id"
        headingKey="quickCreate.__intentionally_missing__"
        fallbackHeading="Custom sub-tasks heading"
      />,
    );
    expect(screen.getByText("Custom sub-tasks heading")).toBeInTheDocument();
  });

  it("renders existing tasks from the store", () => {
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);
    const input = screen.getByDisplayValue("Mark done");
    expect(input).toBeInTheDocument();
  });

  it("renders the Add button when there are no tasks", () => {
    actResetEmptyTasks();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);
    expect(screen.getByTestId("subtasks-test-id-add")).toBeInTheDocument();
  });

  it("writes the new-task title to the store when the form is submitted", async () => {
    actResetEmptyTasks();
    const user = userEvent.setup();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);

    const input = screen.getByTestId("subtasks-test-id-new-subtask");
    await user.type(input, "Write tests");
    await user.click(screen.getByTestId("subtasks-test-id-add"));

    const tasks = useQuickCreateStore.getState().plan.completion.tasks;
    expect(tasks.length).toBe(1);
    expect(tasks[0]?.content.title).toBe("Write tests");
  });

  it("does not add an empty task when the input is blank", async () => {
    actResetEmptyTasks();
    const user = userEvent.setup();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);

    await user.click(screen.getByTestId("subtasks-test-id-add"));
    expect(useQuickCreateStore.getState().plan.completion.tasks.length).toBe(0);
  });

  it("renders the empty hint and CTA when no tasks exist", () => {
    actResetEmptyTasks();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);
    expect(screen.getByTestId("subtasks-test-id-empty")).toBeInTheDocument();
    expect(
      screen.getByTestId("subtasks-test-id-empty-hint"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("subtasks-test-id-add-first")).toBeInTheDocument();
  });

  it("focuses the add-input when the empty-state CTA is clicked", async () => {
    actResetEmptyTasks();
    const user = userEvent.setup();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);
    await user.click(screen.getByTestId("subtasks-test-id-add-first"));
    expect(screen.getByTestId("subtasks-test-id-new-subtask")).toHaveFocus();
  });

  it("removes a task when the menu's Delete item is clicked", async () => {
    const user = userEvent.setup();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);

    expect(useQuickCreateStore.getState().plan.completion.tasks.length).toBe(1);
    fireEvent.click(
      screen.getByTestId("subtasks-test-id-row-task_seed-menu-trigger"),
    );
    await user.click(
      document.body.querySelector<HTMLElement>(
        '[data-testid="subtasks-test-id-row-task_seed-menu-delete"]',
      ) as HTMLElement,
    );
    expect(useQuickCreateStore.getState().plan.completion.tasks.length).toBe(0);
  });

  it("toggles the done checkbox and updates the progress counter", async () => {
    const user = userEvent.setup();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);

    const checkbox = screen.getByTestId(
      "subtasks-test-id-row-task_seed-checkbox",
    );
    expect(checkbox).toHaveAttribute("aria-checked", "false");
    await user.click(checkbox);
    expect(useQuickCreateStore.getState().plan.completion.tasks[0]?.done).toBe(
      true,
    );
    expect(screen.getByTestId("subtasks-test-id-progress")).toHaveTextContent(
      "1/1 done",
    );
    expect(checkbox).toHaveAttribute("aria-checked", "true");
  });

  it("duplicates a task via the menu and resets done to false", async () => {
    const user = userEvent.setup();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);

    // Mark the seed task done first; the duplicate should still be undone.
    await user.click(
      screen.getByTestId("subtasks-test-id-row-task_seed-checkbox"),
    );
    expect(useQuickCreateStore.getState().plan.completion.tasks[0]?.done).toBe(
      true,
    );

    fireEvent.click(
      screen.getByTestId("subtasks-test-id-row-task_seed-menu-trigger"),
    );
    await user.click(
      document.body.querySelector<HTMLElement>(
        '[data-testid="subtasks-test-id-row-task_seed-menu-duplicate"]',
      ) as HTMLElement,
    );

    const tasks = useQuickCreateStore.getState().plan.completion.tasks;
    expect(tasks.length).toBe(2);
    const dup = tasks[1];
    expect(dup?.id).not.toBe("task_seed");
    expect(dup?.content.title).toBe("Mark done");
    expect(dup?.done).toBe(false);
  });

  it("moves a task down via the menu", async () => {
    seedThreeTasks();
    const user = userEvent.setup();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);

    fireEvent.click(
      screen.getByTestId("subtasks-test-id-row-task_a-menu-trigger"),
    );
    await user.click(
      document.body.querySelector<HTMLElement>(
        '[data-testid="subtasks-test-id-row-task_a-menu-move-down"]',
      ) as HTMLElement,
    );

    const ids = useQuickCreateStore
      .getState()
      .plan.completion.tasks.map((t) => t.id);
    expect(ids).toEqual(["task_b", "task_a", "task_c"]);
  });

  it("disables move-up on the first row and move-down on the last row", () => {
    seedThreeTasks();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);

    // Open each menu and check the disabled state of the items.
    const checkRow = (taskId: string, isFirst: boolean, isLast: boolean) => {
      fireEvent.click(
        screen.getByTestId(`subtasks-test-id-row-${taskId}-menu-trigger`),
      );
      const up = document.body.querySelector<HTMLElement>(
        `[data-testid="subtasks-test-id-row-${taskId}-menu-move-up"]`,
      );
      const down = document.body.querySelector<HTMLElement>(
        `[data-testid="subtasks-test-id-row-${taskId}-menu-move-down"]`,
      );
      if (!up || !down) {
        throw new Error(`menu items not found for ${taskId}`);
      }
      if (isFirst) expect(up).toHaveAttribute("data-disabled");
      else expect(up).not.toHaveAttribute("data-disabled");
      if (isLast) expect(down).toHaveAttribute("data-disabled");
      else expect(down).not.toHaveAttribute("data-disabled");
      // Close the menu by pressing Escape so the next row's trigger is
      // not blocked by a still-open dropdown.
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: "Escape",
      });
    };
    checkRow("task_a", true, false);
    checkRow("task_b", false, false);
    checkRow("task_c", false, true);
  });

  it("opens the note popover via the menu and persists the note on Save", async () => {
    const user = userEvent.setup();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);

    fireEvent.click(
      screen.getByTestId("subtasks-test-id-row-task_seed-menu-trigger"),
    );
    await user.click(
      document.body.querySelector<HTMLElement>(
        '[data-testid="subtasks-test-id-row-task_seed-menu-edit-note"]',
      ) as HTMLElement,
    );

    const textarea = screen.getByTestId(
      "subtasks-test-id-row-task_seed-note-textarea",
    ) as HTMLTextAreaElement;
    await user.type(textarea, "Why we need this");
    await user.click(
      screen.getByTestId("subtasks-test-id-row-task_seed-note-save"),
    );

    const task = useQuickCreateStore.getState().plan.completion.tasks[0];
    expect(task?.content.note).toBe("Why we need this");
  });

  it("renders the new row's title input focused after add", async () => {
    actResetEmptyTasks();
    const user = userEvent.setup();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);

    await user.type(
      screen.getByTestId("subtasks-test-id-new-subtask"),
      "Jump focus",
    );
    await user.click(screen.getByTestId("subtasks-test-id-add"));

    // The newly added row's title input (empty by default) should hold focus.
    const titleInputs = screen.getAllByTestId(/subtasks-test-id-row-.+-title$/);
    const focused = titleInputs.find((el) => el === document.activeElement);
    expect(focused).toBeDefined();
  });
});

describe("TaskDetailsSubPanel — SubtasksSection smoke", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "en" });
    resetStore();
  });

  afterEach(() => {
    resetStore();
    useLocaleStore.setState({ locale: "ja" });
    vi.clearAllMocks();
  });

  it("mounts the SubtasksSection inside the sub-panel", () => {
    // SubPanelShell only renders its body when `activePanel === panelKey`.
    // The smoke test seeds the panel key via the store, then asserts the
    // shared subtask section testid is reachable to prove the
    // deduplication wiring landed correctly.
    useQuickCreateStore.setState((s) => ({
      ...s,
      activePanel: "task-details",
    }));
    render(
      <TaskDetailsSubPanel
        opened
        onClose={() => {}}
        durationMinMs={null}
        durationMaxMs={null}
      />,
    );
    expect(
      screen.getByTestId("task-details-subtasks"),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId("task-details-subtasks-add"),
    ).toBeInTheDocument();
  });
});

function actResetEmptyTasks() {
  useQuickCreateStore.setState((s) => ({
    plan: {
      ...s.plan,
      completion: {
        ...s.plan.completion,
        tasks: [],
      },
    },
  }));
}
