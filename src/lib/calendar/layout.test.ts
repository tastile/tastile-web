import { describe, expect, it } from "vitest";
import { getDayViewWindow, getModeRange, getWeekViewDates } from "./layout";

describe("getWeekViewDates (Week view Sun..Sat)", () => {
  it("returns 7 dates in the JST week", () => {
    // Anchor 2026-07-15 (Wed JST). With tzOffset=540, the Sun..Sat grid
    // should be 2026-07-12 .. 2026-07-18.
    const days = getWeekViewDates("scope", "2026-07-15");
    expect(days).toEqual([
      "2026-07-12",
      "2026-07-13",
      "2026-07-14",
      "2026-07-15",
      "2026-07-16",
      "2026-07-17",
      "2026-07-18",
    ]);
  });

  it("Week view getWeekViewDates returns correct Sun..Sat when anchor is Sunday (JST)", () => {
    // Anchor 2026-07-19 (Sun JST). The grid must start on Jul 19 itself,
    // not the previous week. This was broken by getUTCDay() on a
    // timezone-shifted localMidnightMs returning 6 (Sat) instead of 0 (Sun).
    const days = getWeekViewDates("scope", "2026-07-19");
    expect(days).toEqual([
      "2026-07-19",
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
      "2026-07-25",
    ]);
  });

  it("Week view getWeekViewDates returns correct Sun..Sat when anchor is Saturday (JST)", () => {
    // Anchor 2026-07-25 (Sat JST). The grid must end on Jul 25 itself.
    const days = getWeekViewDates("scope", "2026-07-25");
    expect(days).toEqual([
      "2026-07-19",
      "2026-07-20",
      "2026-07-21",
      "2026-07-22",
      "2026-07-23",
      "2026-07-24",
      "2026-07-25",
    ]);
  });
});

describe("getModeRange year", () => {
  it("returns Jan 1 → Jan 1+1 for scope mode", () => {
    const r = getModeRange("year", "scope", "2026-07-30", 0);
    expect(r.start).toBe("2026-01-01");
    expect(r.end).toBe("2027-01-01");
  });
});

describe("getDayViewWindow (grid is always 24 h; only the origin moves)", () => {
  // 2026-07-30 03:20 local — deliberately near midnight so around/future
  // must reach into the previous / next calendar day.
  const now = new Date(2026, 6, 30, 3, 20, 0, 0).getTime();
  const anchor = "2026-07-30";
  const midnight = new Date(2026, 6, 30, 0, 0, 0, 0).getTime();
  const HOUR = 60 * 60 * 1000;

  it("scope: origin is local midnight, no shift", () => {
    const w = getDayViewWindow("scope", anchor, now);
    expect(w.originMs).toBe(midnight);
    expect(w.shiftMs).toBe(0);
  });

  it("around: origin is 12 h before now — i.e. the previous day", () => {
    const w = getDayViewWindow("around", anchor, now);
    expect(w.originMs).toBe(midnight + 3 * HOUR - 12 * HOUR);
    expect(new Date(w.originMs).getDate()).toBe(29);
    // an event at "now" lands 12 h into the virtual day
    expect(now + w.shiftMs - midnight).toBe(12 * HOUR + 20 * 60 * 1000);
  });

  it("future: origin is now (floored), window reaches into the next day", () => {
    const w = getDayViewWindow("future", anchor, now);
    expect(w.originMs).toBe(midnight + 3 * HOUR);
    expect(new Date(w.originMs + 24 * HOUR).getDate()).toBe(31);
  });

  it("every mode renders the same full 24 h grid", () => {
    for (const mode of ["scope", "around", "future"] as const) {
      const w = getDayViewWindow(mode, anchor, now);
      expect(w.startTime).toBe("00:00:00");
      expect(w.endTime).toBe("23:59:59");
    }
  });
});
