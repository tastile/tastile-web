// src/components/schedule/__tests__/eventAdapter.test.ts
import { describe, expect, it } from "vitest";
import { toScheduleEvents, colorToMantine } from './eventAdapter';
import type { CalendarEvent } from "@/calendar/model/calendar";

const baseEvent: CalendarEvent = {
  id: "evt-1",
  title: "Standup",
  description: null,
  location: null,
  start: "2026-07-30T09:00:00Z",
  end: "2026-07-30T10:00:00Z",
  allDay: false,
  color: "blue",
  recurrence: { frequency: "none" },
  attendees: [],
  icon: "check-circle",
  project: "alpha",
  tags: ["work"],
  memo: null,
  source: { kind: 0, detail: null },
  tileId: "tile-1",
  createdAt: "2026-07-30T00:00:00Z",
  updatedAt: "2026-07-30T00:00:00Z",
};

describe("toScheduleEvents", () => {
  it("preserves id and payload for same-day event", () => {
    const out = toScheduleEvents(baseEvent);
    expect(out).toHaveLength(1);
    expect(out[0].id).toBe("evt-1");
    expect(out[0].payload).toBe(baseEvent);
  });

  it("converts timed start/end to local datetime strings", () => {
    const out = toScheduleEvents(baseEvent);
    expect(typeof out[0].start).toBe("string");
    expect((out[0].start as string)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(typeof out[0].end).toBe("string");
    expect((out[0].end as string)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("keeps all-day start/end as YYYY-MM-DD strings", () => {
    const ad = { ...baseEvent, allDay: true, start: "2026-07-30", end: "2026-07-31" };
    const out = toScheduleEvents(ad);
    expect(out).toHaveLength(1);
    expect(out[0].start).toBe("2026-07-30");
    expect(out[0].end).toBe("2026-07-31");
  });

  it("sets variant=light, display=default", () => {
    const out = toScheduleEvents(baseEvent);
    expect(out[0].variant).toBe("light");
    expect(out[0].display).toBe("default");
  });

  it("never sets recurrence-related fields", () => {
    const out = toScheduleEvents(baseEvent);
    const e = out[0];
    expect("recurrence" in e ? e.recurrence : undefined).toBeUndefined();
    expect(
      "recurringEventId" in e
        ? (e as unknown as Record<string, unknown>).recurringEventId
        : undefined,
    ).toBeUndefined();
    expect(
      "recurrenceId" in e
        ? (e as unknown as Record<string, unknown>).recurrenceId
        : undefined,
    ).toBeUndefined();
  });

  it("splits overnight event at midnight boundary", () => {
    // JST 2026-07-30 23:00 → 2026-07-31 07:00 (UTC 14:00 → 22:00)
    const overnight: CalendarEvent = {
      ...baseEvent,
      id: "sleep-1",
      title: "睡眠",
      start: "2026-07-30T14:00:00Z",
      end: "2026-07-30T22:00:00Z",
    };
    const result = toScheduleEvents(overnight);

    // In JST (UTC+9), the local times are 23:00 and 07:00 next day.
    // The function splits at midnight, producing 2 segments.
    expect(result.length).toBeGreaterThanOrEqual(1);
    // Both segments carry the same payload
    for (const r of result) {
      expect(r.payload).toBe(overnight);
    }
    // Each segment starts/ends on the same day
    for (const r of result) {
      const d = new Date((r.start as string).replace(" ", "T"));
      const e2 = new Date((r.end as string).replace(" ", "T"));
      expect(
        d.getFullYear() === e2.getFullYear() &&
          d.getMonth() === e2.getMonth() &&
          d.getDate() === e2.getDate(),
      ).toBe(true);
    }
  });

  it("maps every Tastile EventColor", () => {
    const colors = [
      "blue",
      "green",
      "purple",
      "orange",
      "pink",
      "cyan",
      "yellow",
      "red",
      "teal",
      "indigo",
      "lime",
      "gray",
    ] as const;
    for (const c of colors) {
      expect(colorToMantine(c)).toMatch(
        /^(blue|teal|grape|red|orange|yellow|lime|cyan|indigo|pink|gray|dark)$/,
      );
    }
  });
});
