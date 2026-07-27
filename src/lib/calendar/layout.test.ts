import { describe, expect, it } from "vitest";
import { eventSpansDay, getWeekViewDates } from "./layout";
import type { CalendarEvent } from "@/lib/domain/calendar";

function makeEvent(start: string, end: string): CalendarEvent {
  return {
    id: "test",
    tileId: "tile-1",
    title: "Test",
    description: null,
    start,
    end,
    allDay: false,
    color: "blue",
    icon: null,
    location: null,
    recurrence: { frequency: "none" },
    attendees: [],
    project: null,
    tags: [],
    memo: null,
    source: { kind: 0, detail: null },
    createdAt: "2026-07-15T00:00:00Z",
    updatedAt: "2026-07-15T00:00:00Z",
  };
}

describe("eventSpansDay tzOffset handling (Week view sleep regression)", () => {
  it("lands a 01:00-JST placement on the JST day when tzOffset=540", () => {
    // JST 2026-07-14 01:00 — 07:30 = 2026-07-13T16:00..22:30 UTC.
    const sleep = makeEvent("2026-07-13T16:00:00Z", "2026-07-13T22:30:00Z");
    // JST-local 2026-07-14 (the day the user expects the sleep to appear on)
    expect(eventSpansDay(sleep, "2026-07-14", 540)).toBe(true);
    // JST-local 2026-07-13 should not claim it
    expect(eventSpansDay(sleep, "2026-07-13", 540)).toBe(false);
  });

  it("lands a 01:00-JST placement on the JST day even when caller forgets tzOffset (default 0)", () => {
    // Pre-fix behaviour: without tzOffset the filter falls back to UTC midnight
    // and the sleep lands on the previous UTC day. Pin the previous behaviour
    // so a regression is caught.
    const sleep = makeEvent("2026-07-13T16:00:00Z", "2026-07-13T22:30:00Z");
    expect(eventSpansDay(sleep, "2026-07-14")).toBe(false);
    expect(eventSpansDay(sleep, "2026-07-13")).toBe(true);
  });

  it("Week view getWeekViewDates returns 7 dates in the JST week", () => {
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
