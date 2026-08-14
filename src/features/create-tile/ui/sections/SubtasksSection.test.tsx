/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLocaleStore } from "@/shared/stores/locale-store";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { renderWithMantine } from "@/test/render-with-mantine";
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
          },
        ],
      },
      planning: { placementRules: [], nestingRules: [], flows: [] },
      metrics: [],
      decisions: [],
    },
  });
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

  it("removes a task when the per-row delete button is clicked", async () => {
    const user = userEvent.setup();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);

    expect(useQuickCreateStore.getState().plan.completion.tasks.length).toBe(1);
    await user.click(screen.getByTestId("subtasks-test-id-remove-task_seed"));
    expect(useQuickCreateStore.getState().plan.completion.tasks.length).toBe(0);
  });

  it("does not add an empty task when the input is blank", async () => {
    actResetEmptyTasks();
    const user = userEvent.setup();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);

    await user.click(screen.getByTestId("subtasks-test-id-add"));
    expect(useQuickCreateStore.getState().plan.completion.tasks.length).toBe(0);
  });

  it("renders the empty hint when no tasks exist", () => {
    actResetEmptyTasks();
    renderWithMantine(<SubtasksSection testId="subtasks-test-id" />);
    expect(screen.getByTestId("subtasks-test-id-empty")).toBeInTheDocument();
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

