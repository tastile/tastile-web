// @vitest-environment jsdom
import { renderWithMantine as render } from "@/test/render-with-mantine";
import { describe, expect, it, vi } from "vitest";

import { ConditionPanel } from "./ConditionPanel";

describe("ConditionPanel", () => {
  it("renders the condition authoring surface without crashing", () => {
    const fakeRoot = { kind: 0, children: [], term: null };
    expect(() =>
      render(
        <ConditionPanel
          root={fakeRoot as never}
          setField={() => {}}
          t={(k) => k}
          tileOptions={[]}
        />,
      ),
    ).not.toThrow();
  });

  it("mounts the completion-condition-box with the builder-logic Select inside", () => {
    const setField = vi.fn();
    const fakeRoot = { kind: 0, children: [], term: null };
    const { container } = render(
      <ConditionPanel
        root={fakeRoot as never}
        setField={setField}
        t={(k) => k}
        tileOptions={[]}
      />,
    );
    expect(container.querySelector('[data-testid="completion-condition-box"]')).not.toBeNull();
    expect(container.querySelector('[data-testid="completion-logic-select"]')).not.toBeNull();
  });

  it("does not call setField on a passive mount", () => {
    // The ConditionPanel wires ConditionEditor's onChange directly to
    // setField("plan.completion.root", next); it must NOT fabricate changes
    // on its own during mount. SourceGenerationPanel.test.tsx follows the
    // same pattern — passive mount = no setField invocations.
    const setField = vi.fn();
    const fakeRoot = { kind: 0, children: [], term: null };
    render(
      <ConditionPanel
        root={fakeRoot as never}
        setField={setField}
        t={(k) => k}
        tileOptions={[]}
      />,
    );
    expect(setField).not.toHaveBeenCalled();
  });
});
