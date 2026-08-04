// @vitest-environment jsdom
import { renderWithMantine as render } from "@/test/render-with-mantine";
import { describe, expect, it, vi } from "vitest";
import { TaskDefinitionEditor } from "./TaskDefinitionEditor";

vi.mock("@/shared/stores/quick-create-store", () => ({
  useQuickCreateStore: vi.fn((selector) => {
    const state = {
      plan: {
        completion: {
          tasks: [
            {
              id: "task_1",
              content: { title: "Mark done", note: null },
              show: null,
              complete: {
                kind: 3,
                children: [],
                term: { kind: "task", value: { taskId: "task_1", state: 2 } },
              },
              order: [],
            },
          ],
        },
      },
      addTask: vi.fn(),
      removeTask: vi.fn(),
      setTaskField: vi.fn(),
    };
    return selector(state);
  }),
}));

describe("TaskDefinitionEditor", () => {
  const t = (k: string) => k;

  it("renders task rows", () => {
    const { getAllByTestId } = render(<TaskDefinitionEditor t={t} />);
    expect(getAllByTestId("task-row")).toHaveLength(1);
  });

  it("shows add task button", () => {
    const { getByTestId } = render(<TaskDefinitionEditor t={t} />);
    expect(getByTestId("add-task-button")).toBeTruthy();
  });

  it("renders task title input", () => {
    const { getByTestId } = render(<TaskDefinitionEditor t={t} />);
    expect(getByTestId("task-title-input")).toBeTruthy();
  });
});
