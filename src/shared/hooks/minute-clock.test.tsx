// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { MinuteClockProvider, useMinuteClock } from "./minute-clock";

function ClockProbe() {
  const now = useMinuteClock();
  return <span data-testid="value">{now ?? "none"}</span>;
}

describe("MinuteClockProvider", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exposes the current epoch milliseconds to consumers", () => {
    const { getByTestId } = render(
      <MinuteClockProvider>
        <ClockProbe />
      </MinuteClockProvider>,
    );
    const expected = new Date("2026-01-01T00:00:00.000Z").getTime();
    expect(getByTestId("value").textContent).toBe(String(expected));
  });

  it("updates the exposed value every 60 seconds", () => {
    const { getByTestId } = render(
      <MinuteClockProvider>
        <ClockProbe />
      </MinuteClockProvider>,
    );
    const initial = new Date("2026-01-01T00:00:00.000Z").getTime();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(getByTestId("value").textContent).toBe(String(initial + 60_000));

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(getByTestId("value").textContent).toBe(String(initial + 120_000));
  });

  it("clears the interval on unmount so it does not keep firing", () => {
    const clearIntervalSpy = vi.spyOn(window, "clearInterval");
    const { unmount } = render(
      <MinuteClockProvider>
        <ClockProbe />
      </MinuteClockProvider>,
    );
    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
  });
});
