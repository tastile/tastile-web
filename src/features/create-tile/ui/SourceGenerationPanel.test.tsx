// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { renderWithMantine as render } from "@/test/render-with-mantine";
import { ConditionKind } from "@/tile/model/v1/constants";
import type { ConditionNode } from "@/tile/model/v1/condition";
import { describe, expect, it, vi } from "vitest";

import {
  RECURRING_CONDITION_DISABLED_TOOLTIP,
  SourceGenerationPanel,
} from "./SourceGenerationPanel";
import { defaultTerm } from "./default-term";

describe("SourceGenerationPanel", () => {
  // The panel is prop-driven and store-agnostic (does not import
  // useQuickCreateStore), so there is no module-level state to reset
  // between tests. Each render constructs fresh mocks via vi.fn().

  it("renders the recurrence authoring surface without crashing", () => {
    const setField = vi.fn();
    const { container } = render(
      <SourceGenerationPanel
        recurring={{ repeatMode: "once", weekdayMask: 0, endDate: "", intervalValue: 30, intervalUnit: "min", condition: null }}
        setField={setField}
        locale="en"
        t={(key) => key}
      />,
    );
    expect(container.querySelector('[data-testid="recurring-mode-tabs"]')).not.toBeNull();
  });

  it("toggles weekday chips by flipping the corresponding bit in recurring.weekdayMask", () => {
    const setField = vi.fn();
    render(
      <SourceGenerationPanel
        recurring={{ repeatMode: "weekly", weekdayMask: 0, endDate: "", intervalValue: 30, intervalUnit: "min", condition: null }}
        setField={setField}
        locale="en"
        t={(key) => key}
      />,
    );

    // Sunday is bit 0 → click should XOR (0 ^ 1) = 1
    fireEvent.click(screen.getByTestId("recurring-weekday-0"));
    expect(setField).toHaveBeenCalledWith("recurring.weekdayMask", 1);

    // Wednesday is bit 3 → click should XOR (0 ^ 8) = 8
    fireEvent.click(screen.getByTestId("recurring-weekday-3"));
    expect(setField).toHaveBeenCalledWith("recurring.weekdayMask", 8);
  });

  it("hides the weekday row when repeatMode is not weekly", () => {
    render(
      <SourceGenerationPanel
        recurring={{ repeatMode: "daily", weekdayMask: 0, endDate: "", intervalValue: 30, intervalUnit: "min", condition: null }}
        setField={vi.fn()}
        locale="en"
        t={(key) => key}
      />,
    );
    expect(screen.queryByTestId("recurring-weekday-row")).toBeNull();
  });

  it("switches repeatMode and promotes identity.kind to RECURRING when leaving 'once'", () => {
    const setField = vi.fn();
    render(
      <SourceGenerationPanel
        recurring={{ repeatMode: "once", weekdayMask: 0, endDate: "", intervalValue: 30, intervalUnit: "min", condition: null }}
        setField={setField}
        locale="en"
        t={(key) => key}
      />,
    );

    const tabs = screen.getByTestId("recurring-mode-tabs");
    // The SegmentedControl renders inputs — fire a change on the "daily" value.
    const dailyInput = tabs.querySelector('input[value="daily"]') as HTMLInputElement | null;
    expect(dailyInput).not.toBeNull();
    fireEvent.click(dailyInput!);

    expect(setField).toHaveBeenCalledWith("recurring.repeatMode", "daily");
    expect(setField).toHaveBeenCalledWith("identity.kind", 0);
  });
});

// ---------------------------------------------------------------------------
// Issue #49 (E1b) — recurring.condition affordance must stay visible but be
// fully non-interactive until ConditionEditor ships in Phase 4. The AC is:
//
//   1. tooltip text is exactly `Condition editor ships in Phase 4`.
//   2. data-testid="recurring-condition-affordance" is `disabled`.
//   3. clicking the affordance does NOT mutate `recurring.condition`
//      (the submit path is unaffected — silent drop is avoided).
//   4. ARIA wiring is in place: `aria-disabled="true"` + `aria-describedby`
//      pointing at an element containing the tooltip text, so screen
//      readers announce the disabled reason.
//   5. the affordance itself only appears when repeatMode === "condition".
//
// The panel exposes two branches: (a) no condition yet → single disabled
// "Add condition" Button; (b) condition present → wrapper <div> with a
// disabled "Remove condition" Button + a disabled ConditionEditor inside.
// We cover both so a future refactor cannot accidentally re-enable one
// branch while the other stays locked.
// ---------------------------------------------------------------------------

const conditionNode: ConditionNode = {
  kind: ConditionKind.TERM,
  // The wrapper renders <ConditionEditor aria-disabled ...> so onChange
  // never fires in practice. We just need a TERM node that mounts without
  // crashing — defaultTerm("calendar") is the smallest legal payload.
  children: [],
  term: defaultTerm("calendar"),
};

const conditionBaseProps = {
  weekdayMask: 0,
  endDate: "",
  intervalValue: 30,
  intervalUnit: "min" as const,
};

function renderConditionPanel(
  recurring: {
    repeatMode: "once" | "daily" | "weekly" | "interval" | "condition";
    weekdayMask: number;
    endDate: string;
    intervalValue: number;
    intervalUnit: "min" | "hour" | "day";
    condition: ConditionNode | null;
  },
  // The panel types setField as `(path: string, value: unknown) => void`;
  // a loose `Mock` signature prevents TypeScript from narrowing it to a
  // matching function shape. `ReturnType<typeof vi.fn>` widens to
  // `Mock<...>` which doesn't satisfy the contextual signature, so we
  // accept the precise function shape and let vitest infer the mock impl.
  setField: (path: string, value: unknown) => void,
) {
  return render(
    <SourceGenerationPanel
      recurring={recurring}
      setField={setField}
      locale="en"
      t={(key) => key}
    />,
  );
}

describe("SourceGenerationPanel — E1b recurring.condition affordance (issue #49)", () => {
  it("does not render the affordance unless repeatMode === 'condition'", () => {
    renderConditionPanel(
      { repeatMode: "once", condition: null, ...conditionBaseProps },
      vi.fn(),
    );
    expect(screen.queryByTestId("recurring-condition-affordance")).toBeNull();

    renderConditionPanel(
      { repeatMode: "weekly", condition: null, ...conditionBaseProps },
      vi.fn(),
    );
    expect(screen.queryByTestId("recurring-condition-affordance")).toBeNull();
  });

  it("renders the disabled affordance with the exact Phase 4 tooltip text (no condition yet)", () => {
    renderConditionPanel(
      { repeatMode: "condition", condition: null, ...conditionBaseProps },
      vi.fn(),
    );

    const affordance = screen.getByTestId("recurring-condition-affordance");
    // AC #2: native disabled attribute on the interactive element. We
    // assert via the DOM attribute directly so this works regardless of
    // whether jest-dom matchers are installed in the test environment.
    expect((affordance as HTMLElement).hasAttribute("disabled")).toBe(true);
    // AC #1: tooltip text is the exact AC string.
    expect(RECURRING_CONDITION_DISABLED_TOOLTIP).toBe("Condition editor ships in Phase 4");
    // AC #4: aria-disabled + aria-describedby wired so screen readers
    // can announce why the control is locked.
    expect(affordance.getAttribute("aria-disabled")).toBe("true");
    const describedBy = affordance.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const reasonEl = describedBy ? document.getElementById(describedBy) : null;
    expect(reasonEl).not.toBeNull();
    expect(reasonEl!.textContent).toContain("Condition editor ships in Phase 4");
  });

  it("clicking the disabled affordance does NOT call setField('recurring.condition', …)", () => {
    const setField = vi.fn();
    renderConditionPanel(
      { repeatMode: "condition", condition: null, ...conditionBaseProps },
      setField,
    );

    const affordance = screen.getByTestId("recurring-condition-affordance");
    fireEvent.click(affordance);
    fireEvent.keyDown(affordance, { key: "Enter" });
    fireEvent.keyUp(affordance, { key: " " });

    // AC #3: the submit path is unaffected — no `recurring.condition` write.
    const conditionCalls = setField.mock.calls.filter(
      ([path]) => typeof path === "string" && path.startsWith("recurring.condition"),
    );
    expect(conditionCalls).toEqual([]);
    expect(setField).not.toHaveBeenCalledWith(
      "recurring.condition",
      expect.anything(),
    );
  });

  it("when a condition already exists, the affordance stays disabled and still surfaces the tooltip reason", () => {
    const setField = vi.fn();
    renderConditionPanel(
      { repeatMode: "condition", condition: conditionNode, ...conditionBaseProps },
      setField,
    );

    const affordance = screen.getByTestId("recurring-condition-affordance");
    // Wrapper div branch — still announces disabled.
    expect(affordance.getAttribute("aria-disabled")).toBe("true");
    const describedBy = affordance.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    const reasonEl = describedBy ? document.getElementById(describedBy) : null;
    expect(reasonEl).not.toBeNull();
    expect(reasonEl!.textContent).toContain("Condition editor ships in Phase 4");
    // The wrapper also carries the data-condition-disabled hook for E2E.
    expect(affordance.getAttribute("data-condition-disabled")).toBe("true");

    // Inner "remove condition" button is disabled and clicks are no-ops.
    const removeButton = screen.getByRole("button", { name: "条件を外す" });
    expect((removeButton as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(removeButton);
    const conditionCalls = setField.mock.calls.filter(
      ([path]) => typeof path === "string" && path.startsWith("recurring.condition"),
    );
    expect(conditionCalls).toEqual([]);
  });
});
