// @vitest-environment jsdom
import { renderWithMantine as render } from "@/test/render-with-mantine";
import "@testing-library/jest-dom/vitest";
import { describe, expect, it, vi } from "vitest";
import { TaskDefinitionEditor } from "./TaskDefinitionEditor";

const mockReorderTasks = vi.fn();
const mockRemoveTask = vi.fn();

vi.mock("@/shared/stores/quick-create-store", () => ({
  useQuickCreateStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      plan: {
        completion: {
          tasks: [
            {
              id: "task_1",
              content: { title: "First task", note: null },
              show: null,
              complete: {
                kind: 3,
                children: [],
                term: { kind: "task", value: { taskId: "task_1", state: 2 } },
              },
              order: [],
            },
            {
              id: "task_2",
              content: { title: "Second task", note: null },
              show: null,
              complete: {
                kind: 3,
                children: [],
                term: { kind: "task", value: { taskId: "task_2", state: 2 } },
              },
              order: [],
            },
          ],
        },
      },
      addTask: vi.fn(),
      removeTask: mockRemoveTask,
      reorderTasks: mockReorderTasks,
      setTaskField: vi.fn(),
    }),
}));

describe("TaskDefinitionEditor", () => {
  const t = (k: string) => k;

  it("renders task rows", () => {
    const { getAllByTestId } = render(<TaskDefinitionEditor t={t} />);
    expect(getAllByTestId("task-row")).toHaveLength(2);
  });

  it("shows add task button", () => {
    const { getByTestId } = render(<TaskDefinitionEditor t={t} />);
    expect(getByTestId("add-task-button")).toBeTruthy();
  });

  it("renders task title inputs", () => {
    const { getAllByTestId } = render(<TaskDefinitionEditor t={t} />);
    expect(getAllByTestId("task-title-input")).toHaveLength(2);
  });

  it("renders move up/down buttons for each task", () => {
    const { getAllByTestId } = render(<TaskDefinitionEditor t={t} />);
    const moveUpButtons = getAllByTestId("task-move-up");
    const moveDownButtons = getAllByTestId("task-move-down");
    expect(moveUpButtons).toHaveLength(2);
    expect(moveDownButtons).toHaveLength(2);
  });

  it("disables move up button for first task", () => {
    const { getAllByTestId } = render(<TaskDefinitionEditor t={t} />);
    const moveUpButtons = getAllByTestId("task-move-up");
    expect(moveUpButtons[0]).toBeDisabled();
    expect(moveUpButtons[1]).not.toBeDisabled();
  });

  it("disables move down button for last task", () => {
    const { getAllByTestId } = render(<TaskDefinitionEditor t={t} />);
    const moveDownButtons = getAllByTestId("task-move-down");
    expect(moveDownButtons[0]).not.toBeDisabled();
    expect(moveDownButtons[1]).toBeDisabled();
  });
});
