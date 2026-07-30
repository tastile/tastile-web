// src/components/schedule/__tests__/eventAdapter.test.ts
import { describe, expect, it } from "vitest";
import { toScheduleEvent, colorToMantine } from "../eventAdapter";
import type { CalendarEvent } from "@/lib/domain/calendar";

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

describe("toScheduleEvent", () => {
  it("preserves id and payload", () => {
    const out = toScheduleEvent(baseEvent);
    expect(out.id).toBe("evt-1");
    expect(out.payload).toBe(baseEvent);
  });

  it("converts timed start/end to local datetime strings", () => {
    const out = toScheduleEvent(baseEvent);
    // Returns YYYY-MM-DD HH:mm:ss in browser local time
    expect(typeof out.start).toBe("string");
    expect((out.start as string)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(typeof out.end).toBe("string");
    expect((out.end as string)).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
  });

  it("keeps all-day start/end as YYYY-MM-DD strings", () => {
    const ad = { ...baseEvent, allDay: true, start: "2026-07-30", end: "2026-07-31" };
    const out = toScheduleEvent(ad);
    expect(out.start).toBe("2026-07-30");
    expect(out.end).toBe("2026-07-31");
  });

  it("sets variant=light, display=default", () => {
    const out = toScheduleEvent(baseEvent);
    expect(out.variant).toBe("light");
    expect(out.display).toBe("default");
  });

  it("never sets recurrence-related fields", () => {
    const out = toScheduleEvent(baseEvent);
    expect("recurrence" in out ? out.recurrence : undefined).toBeUndefined();
    expect("recurringEventId" in out ? (out as unknown as Record<string, unknown>).recurringEventId : undefined).toBeUndefined();
    expect("recurrenceId" in out ? (out as unknown as Record<string, unknown>).recurrenceId : undefined).toBeUndefined();
  });

  it("maps every Tastile EventColor", () => {
    const colors = ["blue", "green", "purple", "orange", "pink", "cyan",
                    "yellow", "red", "teal", "indigo", "lime", "gray"] as const;
    for (const c of colors) {
      expect(colorToMantine(c)).toMatch(/^(blue|teal|grape|red|orange|yellow|lime|cyan|indigo|pink|gray|dark)$/);
    }
  });
});
