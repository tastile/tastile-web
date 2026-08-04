// @vitest-environment jsdom
import { renderWithMantine as render } from "@/test/render-with-mantine";
import { ConditionKind } from "@/tile/model/v1/constants";
import type { CompletionSubPanelProps } from "./CompletionSubPanel";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CompletionSubPanel } from "./CompletionSubPanel";

vi.mock("@/features/create-tile/ui/ConditionPanel", () => ({
  ConditionPanel: () => <div data-testid="condition-panel" />,
}));

vi.mock("@/features/create-tile/ui/TaskDefinitionEditor", () => ({
  TaskDefinitionEditor: () => <div data-testid="task-definition-editor" />,
}));

const t = (k: string) => k;

type TimeReq = CompletionSubPanelProps["plan"]["completion"]["timeRequirements"][number];

function makeProps(overrides?: { timeRequirements?: TimeReq[] }) {
  const timeRequirements = overrides?.timeRequirements ?? [
    {
      id: "tr_1",
      required: { minMs: 30 * 60_000, maxMs: 90 * 60_000 },
      observation: { scope: 0 },
    } as TimeReq,
  ];
  return {
    activePanel: "completion" as const,
    setActivePanel: vi.fn(),
    isDesktop: true,
    t,
    plan: {
      completion: {
        root: { kind: ConditionKind.ALL, children: [], term: null },
        tasks: [],
        timeRequirements,
      },
    },
    setField: vi.fn(),
    tilePickerData: [],
    taskPickerData: [],
    requirementPickerData: [],
    time: { durationMinMax: { minMs: 30 * 60_000 } },
  };
}

describe("CompletionSubPanel — time requirements", () => {
  it("renders time requirement rows with min/max inputs", () => {
    render(<CompletionSubPanel {...makeProps()} />);
    expect(screen.getByTestId("completion-time-requirement-lines")).toBeTruthy();
    expect(screen.getByTestId("completion-time-line-0")).toBeTruthy();
    const minInput = screen.getByLabelText("quickCreate.minMsLabel");
    const maxInput = screen.getByLabelText("quickCreate.maxMsLabel");
    expect(minInput).toBeTruthy();
    expect(maxInput).toBeTruthy();
  });

  it("remove button removes a time requirement", async () => {
    const user = userEvent.setup();
    const props = makeProps();
    render(<CompletionSubPanel {...props} />);
    const removeBtn = screen.getByLabelText("quickCreate.removeItem");
    expect(removeBtn).toBeTruthy();
    await user.click(removeBtn);
    expect(props.setField).toHaveBeenCalledWith(
      "plan.completion.timeRequirements",
      [],
    );
  });

  it("shows warning icon when min > max", () => {
    render(
      <CompletionSubPanel
        {...makeProps({
          timeRequirements: [
            {
              id: "tr_bad",
              required: { minMs: 90 * 60_000, maxMs: 30 * 60_000 },
              observation: { scope: 0 },
            },
          ],
        })}
      />,
    );
    const row = screen.getByTestId("completion-time-line-0");
    expect(row.className).toContain("ring-danger");
  });

  it("no warning when min <= max", () => {
    render(<CompletionSubPanel {...makeProps()} />);
    const row = screen.getByTestId("completion-time-line-0");
    expect(row.className).not.toContain("ring-danger");
  });
});
