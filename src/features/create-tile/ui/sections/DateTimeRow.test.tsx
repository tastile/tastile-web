/** @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useLocaleStore } from "@/shared/stores/locale-store";
import { renderWithMantine } from "@/test/render-with-mantine";
import { DateTimeRow } from "./DateTimeRow";

// jsdom does not implement `scrollTo` on HTMLElements; Mantine's Combobox
// dropdown calls it during scroll-into-view. Without this polyfill the
// component throws on open.
if (typeof HTMLElement !== "undefined") {
  Object.defineProperties(HTMLElement.prototype, {
    scrollIntoView: {
      configurable: true,
      value: () => {},
    },
    scrollTo: {
      configurable: true,
      value: () => {},
    },
  });
}

describe("DateTimeRow", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "en" });
  });

  afterEach(() => {
    useLocaleStore.setState({ locale: "ja" });
  });

  it("renders only the date input when timeValue is undefined", () => {
    renderWithMantine(
      <DateTimeRow
        dateValue=""
        onDateChange={vi.fn()}
        dateTestId="dt-date"
        timeTestId="dt-time"
      />,
    );

    expect(screen.getByTestId("dt-date")).toBeInTheDocument();
    expect(screen.queryByTestId("dt-time")).toBeNull();
  });

  it("renders both inputs when timeValue and onTimeChange are provided", () => {
    renderWithMantine(
      <DateTimeRow
        dateValue=""
        onDateChange={vi.fn()}
        timeValue=""
        onTimeChange={vi.fn()}
        dateTestId="dt-date"
        timeTestId="dt-time"
      />,
    );

    expect(screen.getByTestId("dt-date")).toBeInTheDocument();
    expect(screen.getByTestId("dt-time")).toBeInTheDocument();
  });

  it("calls onDateChange with an ISO string when the date changes", async () => {
    const user = userEvent.setup();
    const onDateChange = vi.fn();

    renderWithMantine(
      <DateTimeRow
        dateValue=""
        onDateChange={onDateChange}
        dateTestId="dt-date"
        ariaLabelDate="Date"
      />,
    );

    const input = screen.getByLabelText("Date");
    // Mantine's DateInput expects a dateParser-friendly string; the
    // accepted free-form date is typed, then committed on blur.
    await user.type(input, "2026-08-15");
    await user.tab();

    expect(onDateChange).toHaveBeenCalled();
    const arg = onDateChange.mock.calls.at(-1)?.[0] as string;
    expect(arg).toMatch(/^2026-08-15T/);
    // Confirm round-tripping through `new Date` yields the typed day.
    expect(new Date(arg).toISOString().slice(0, 10)).toBe("2026-08-15");
  });

  it("calls onTimeChange with an HH:MM string when time blurs", async () => {
    const user = userEvent.setup();
    const onTimeChange = vi.fn();

    renderWithMantine(
      <DateTimeRow
        dateValue=""
        onDateChange={vi.fn()}
        timeValue=""
        onTimeChange={onTimeChange}
        timeTestId="dt-time"
        ariaLabelTime="Time"
      />,
    );

    const input = screen.getByLabelText("Time");
    await user.type(input, "10:07");
    await user.tab();

    expect(onTimeChange).toHaveBeenCalledWith("10:07");
  });
});
