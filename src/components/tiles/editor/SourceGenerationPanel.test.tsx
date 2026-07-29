// @vitest-environment jsdom
import { fireEvent, screen } from "@testing-library/react";
import { renderWithMantine as render } from "@/test/render-with-mantine";
import { describe, expect, it, vi } from "vitest";

import { SourceGenerationPanel } from "./SourceGenerationPanel";

describe("SourceGenerationPanel", () => {
  // The panel is prop-driven and store-agnostic (does not import
  // useQuickCreateStore), so there is no module-level state to reset
  // between tests. Each render constructs fresh mocks via vi.fn().

  it("renders the recurrence authoring surface without crashing", () => {
    const setField = vi.fn();
    const { container } = render(
      <SourceGenerationPanel
        recurring={{ repeatMode: "once", weekdayMask: 0, endDate: "", intervalValue: 30, intervalUnit: "min" }}
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
        recurring={{ repeatMode: "weekly", weekdayMask: 0, endDate: "", intervalValue: 30, intervalUnit: "min" }}
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
        recurring={{ repeatMode: "daily", weekdayMask: 0, endDate: "", intervalValue: 30, intervalUnit: "min" }}
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
        recurring={{ repeatMode: "once", weekdayMask: 0, endDate: "", intervalValue: 30, intervalUnit: "min" }}
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
