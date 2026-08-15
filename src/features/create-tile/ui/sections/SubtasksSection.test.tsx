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

function resetEmptyTasks() {
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

  it("renders the underline add affine when there are no tasks", () => {
    resetEmptyTasks();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);
    expect(screen.getByTestId("subtasks-test-id-add")).toBeInTheDocument();
  });

  it("renders the empty hint and CTA when no tasks exist", () => {
    resetEmptyTasks();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);
    expect(screen.getByTestId("subtasks-test-id-empty")).toBeInTheDocument();
    expect(
      screen.getByTestId("subtasks-test-id-empty-hint"),
    ).toBeInTheDocument();
    expect(screen.getByTestId("subtasks-test-id-add-first")).toBeInTheDocument();
  });

  it("opens the add modal when the underline affine is clicked", async () => {
    const user = userEvent.setup();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);

    await user.click(screen.getByTestId("subtasks-test-id-add"));
    expect(
      screen.getByTestId("subtasks-test-id-modal-root"),
    ).toBeInTheDocument();
  });

  it("opens the add modal when the empty-state CTA is clicked", async () => {
    resetEmptyTasks();
    const user = userEvent.setup();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);

    await user.click(screen.getByTestId("subtasks-test-id-add-first"));
    expect(
      screen.getByTestId("subtasks-test-id-modal-root"),
    ).toBeInTheDocument();
  });

  it("creates a new task with the modal's title field", async () => {
    const user = userEvent.setup();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);

    await user.click(screen.getByTestId("subtasks-test-id-add"));
    const titleInput = screen.getByTestId(
      "subtasks-test-id-modal-title",
    ) as HTMLInputElement;
    await user.type(titleInput, "Write tests");
    await user.click(screen.getByTestId("subtasks-test-id-modal-submit"));

    const tasks = useQuickCreateStore.getState().plan.completion.tasks;
    expect(tasks.length).toBe(2);
    const created = tasks.find((task) => task.content.title === "Write tests");
    expect(created).toBeDefined();
    expect(created?.done).toBe(false);
  });

  it("does not submit the modal when the title is blank", async () => {
    const user = userEvent.setup();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);

    await user.click(screen.getByTestId("subtasks-test-id-add"));
    const submit = screen.getByTestId("subtasks-test-id-modal-submit");
    expect(submit).toBeDisabled();
  });

  it("opens the modal in edit mode via the menu's Edit item", async () => {
    const user = userEvent.setup();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);

    fireEvent.click(
      screen.getByTestId("subtasks-test-id-row-task_seed-menu-trigger"),
    );
    await user.click(
      document.body.querySelector<HTMLElement>(
        '[data-testid="subtasks-test-id-row-task_seed-menu-edit"]',
      ) as HTMLElement,
    );

    const titleInput = screen.getByTestId(
      "subtasks-test-id-modal-title",
    ) as HTMLInputElement;
    expect(titleInput.value).toBe("Mark done");
  });

  it("updates the existing task when the edit modal is submitted", async () => {
    const user = userEvent.setup();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);

    fireEvent.click(
      screen.getByTestId("subtasks-test-id-row-task_seed-menu-trigger"),
    );
    await user.click(
      document.body.querySelector<HTMLElement>(
        '[data-testid="subtasks-test-id-row-task_seed-menu-edit"]',
      ) as HTMLElement,
    );

    const titleInput = screen.getByTestId(
      "subtasks-test-id-modal-title",
    ) as HTMLInputElement;
    await user.clear(titleInput);
    await user.type(titleInput, "Renamed");
    await user.click(screen.getByTestId("subtasks-test-id-modal-submit"));

    const tasks = useQuickCreateStore.getState().plan.completion.tasks;
    expect(tasks.length).toBe(1);
    expect(tasks[0]?.id).toBe("task_seed");
    expect(tasks[0]?.content.title).toBe("Renamed");
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
      fireEvent.keyDown(document.activeElement ?? document.body, {
        key: "Escape",
      });
    };
    checkRow("task_a", true, false);
    checkRow("task_b", false, false);
    checkRow("task_c", false, true);
  });
});

describe("TaskDefinitionEditorModal", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "en" });
    resetStore();
  });

  afterEach(() => {
    resetStore();
    useLocaleStore.setState({ locale: "ja" });
    vi.clearAllMocks();
  });

  it("accepts a note and an order rule on submit", async () => {
    const user = userEvent.setup();
    renderWithMantine(<SubtasksSection testId="modal-test-id" />);

    await user.click(screen.getByTestId("modal-test-id-add"));
    const titleInput = screen.getByTestId(
      "modal-test-id-modal-title",
    ) as HTMLInputElement;
    await user.type(titleInput, "Structured");

    const noteInput = screen.getByTestId(
      "modal-test-id-modal-note",
    ) as HTMLTextAreaElement;
    await user.type(noteInput, "Why this matters");

    await user.click(screen.getByTestId("modal-test-id-modal-order-add"));

    const taskId = useQuickCreateStore.getState().plan.completion.tasks[0]?.id;
    // The new task can't be its own target, so the picker falls back to
    // the existing "Mark done" task seeded by the default store. We
    // verify the rule was added by length + that the order list
    // rendered.
    expect(
      screen.getByTestId("modal-test-id-modal-order-list"),
    ).toBeInTheDocument();
    expect(taskId).toBeDefined();

    await user.click(screen.getByTestId("modal-test-id-modal-submit"));

    const stored = useQuickCreateStore
      .getState()
      .plan.completion.tasks.find((task) => task.content.title === "Structured");
    expect(stored).toBeDefined();
    expect(stored?.content.note).toBe("Why this matters");
    expect(stored?.order.length).toBe(1);
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
