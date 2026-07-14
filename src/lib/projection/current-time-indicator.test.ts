import { describe, expect, it } from "vitest";
import { getCurrentTimeIndicatorPosition } from "@/lib/projection/current-time-indicator";

describe("getCurrentTimeIndicatorPosition", () => {
  it("converts the current local time into a single scaled pixel offset", () => {
    const nowMs = Date.parse("2026-06-21T10:30:00.000Z");

    const position = getCurrentTimeIndicatorPosition(nowMs, 540);

    expect(position.todayIso).toBe("2026-06-21");
    expect(position.minutesFromMidnight).toBe(1170);
    expect(position.topPx).toBe(1755);
  });

  it("rolls the local date when the timezone offset crosses midnight", () => {
    const nowMs = Date.parse("2026-06-21T23:30:00.000Z");

    const position = getCurrentTimeIndicatorPosition(nowMs, 120);

    expect(position.todayIso).toBe("2026-06-22");
    expect(position.minutesFromMidnight).toBe(90);
    expect(position.topPx).toBe(135);
  });
});
