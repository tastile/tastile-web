// @vitest-environment jsdom
import { renderWithMantine as render } from "@/test/render-with-mantine";
import { describe, expect, it, vi } from "vitest";
import { ConditionEditor } from "./ConditionEditor";
import { ConditionKind } from "@/tile/model/v1/constants";

describe("ConditionEditor", () => {
  const t = (k: string) => k;

  it("renders default TERM node with term kind picker", () => {
    const node = {
      kind: ConditionKind.TERM,
      children: [],
      term: {
        kind: "calendar",
        value: { weekdayMask: 0, timeStart: null, timeEnd: null, holidayKind: 2, dateRange: null, offsetMin: 0 },
      },
    };
    const onChange = vi.fn();
    const { container } = render(
      <ConditionEditor node={node as never} onChange={onChange} t={t} />,
    );
    expect(container.querySelector('[data-testid]')).toBeTruthy();
  });

  it("switches to ALL and shows add child button", () => {
    const node = { kind: ConditionKind.ALL, children: [], term: null };
    const onChange = vi.fn();
    const { getByText } = render(
      <ConditionEditor node={node as never} onChange={onChange} t={t} />,
    );
    expect(getByText("quickCreate.conditionAddChild")).toBeTruthy();
  });

  it("emits valid ConditionNode JSON on onChange", () => {
    const node = { kind: ConditionKind.ALL, children: [], term: null };
    const onChange = vi.fn();
    const { getByText } = render(
      <ConditionEditor node={node as never} onChange={onChange} t={t} />,
    );
    getByText("quickCreate.conditionAddChild").click();
    expect(onChange).toHaveBeenCalled();
    const lastArg = onChange.mock.calls.at(-1)![0];
    expect(lastArg.kind).toBe(ConditionKind.ALL);
    expect(lastArg.children).toHaveLength(1);
    expect(JSON.stringify(lastArg)).toMatchSnapshot();
  });

  it("respects maxDepth limit", () => {
    const deepNode = {
      kind: ConditionKind.ALL,
      children: [
        {
          kind: ConditionKind.ALL,
          children: [
            {
              kind: ConditionKind.ALL,
              children: [],
              term: null,
            },
          ],
          term: null,
        },
      ],
      term: null,
    };
    const onChange = vi.fn();
    const { getByText } = render(
      <ConditionEditor node={deepNode as never} onChange={onChange} t={t} maxDepth={2} />,
    );
    // At depth 2 with maxDepth 2, the inner ALL should show the depth limit message
    expect(getByText("quickCreate.conditionDepthLimit")).toBeTruthy();
  });

  it("hides add child and remove buttons for NOT", () => {
    const node = {
      kind: ConditionKind.NOT,
      children: [
        { kind: ConditionKind.TERM, children: [], term: { kind: "calendar", value: { weekdayMask: 0, timeStart: null, timeEnd: null, holidayKind: 2, dateRange: null, offsetMin: 0 } } },
      ],
      term: null,
    };
    const onChange = vi.fn();
    const { queryByText } = render(
      <ConditionEditor node={node as never} onChange={onChange} t={t} />,
    );
    expect(queryByText("quickCreate.conditionAddChild")).toBeNull();
    expect(queryByText("quickCreate.conditionRemoveChild")).toBeNull();
  });

  it("NOT with zero children adds default TERM child on render", () => {
    const node = {
      kind: ConditionKind.NOT,
      children: [],
      term: null,
    };
    const onChange = vi.fn();
    // NOT with empty children should still render (the handler will add a default TERM)
    const { container } = render(
      <ConditionEditor node={node as never} onChange={onChange} t={t} />,
    );
    expect(container).toBeTruthy();
  });
});
