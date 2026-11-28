import { describe, expect, it } from "vitest";
import { buildDefaultQuickCreateState } from "@/shared/stores/quick-create-store";
import { buildSourceScheduleDefinition } from "./quick-create-schedule-wire";
import { scheduleToStorePatch } from "./source-tile-edit";
import type { SourceScheduleWire } from "./source-tiles";

const baseSchedule: SourceScheduleWire = {
  required_duration_ms: 1_800_000,
  generation: {
    kind: 1,
    at: null,
    starts_at: "2026-07-01T00:00:00.000Z",
    interval_ms: 86_400_000,
    ends_at: "2026-12-31T00:00:00.000Z",
    weekday_mask: null,
    date_range_start: "2026-07-01",
    date_range_end: "2026-12-31",
    excluded_dates: ["2026-07-16"],
    offset_min: 540,
  },
  window: { start_offset_ms: 0, end_offset_ms: 1_800_000 },
  split_policy: { kind: 0, min_segment_ms: null, max_segment_ms: null, max_segments: null },
  priority: 3,
};

function stateWithPatch(schedule: SourceScheduleWire) {
  const state = buildDefaultQuickCreateState();
  const patch = scheduleToStorePatch(schedule);
  return {
    ...state,
    recurring: { ...state.recurring, ...patch.recurring, life: { ...state.recurring.life, ...patch.recurring.life } },
    time: { ...state.time, ...patch.time },
    source: { ...state.source, ...patch.source },
  };
}

describe("scheduleToStorePatch", () => {
  it("maps a daily recurring generation back to store slices", () => {
    const patch = scheduleToStorePatch(baseSchedule);
    expect(patch.recurring.repeatMode).toBe("daily");
    expect(patch.recurring.intervalValue).toBe(1);
    expect(patch.recurring.intervalUnit).toBe("day");
    expect(patch.recurring.weekdayMask).toBe(0);
    expect(patch.recurring.endDate).toBe("2026-12-31T00:00:00.000Z");
    expect(patch.source.excludedDates).toEqual(["2026-07-16"]);
    expect(patch.source.offsetMin).toBe(540);
    expect(patch.source.priority).toBe(3);
    expect(patch.time.timeModel).toBe("duration_only");
    expect(patch.time.durationMinMax).toEqual({ minMs: 1_800_000, maxMs: 1_800_000 });
  });

  it("maps weekly mask and monthly rules", () => {
    const weekly = scheduleToStorePatch({
      ...baseSchedule,
      generation: { ...baseSchedule.generation, weekday_mask: 0b0000110, interval_ms: 604_800_000 },
    });
    expect(weekly.recurring.repeatMode).toBe("weekly");
    expect(weekly.recurring.weekdayMask).toBe(0b0000110);

    const monthly = scheduleToStorePatch({
      ...baseSchedule,
      generation: {
        ...baseSchedule.generation,
        kind: 3,
        interval_ms: null,
        monthly_rule: { kind: 1, week_of_month: 2, weekday: 1 },
      },
    });
    expect(monthly.recurring.repeatMode).toBe("monthly");
    expect(monthly.recurring.monthlyKind).toBe("by_weekday");
    expect(monthly.recurring.monthlyWeekOfMonth).toBe(2);
    expect(monthly.recurring.monthlyWeekday).toBe(1); // ISO Mon=1 -> store Sunday-first 1
  });

  it("maps one-time generation.at into the authored span", () => {
    const patch = scheduleToStorePatch({
      ...baseSchedule,
      generation: {
        ...baseSchedule.generation,
        kind: 0,
        at: "2026-08-01T09:00:00.000Z",
        starts_at: null,
        interval_ms: null,
        ends_at: null,
      },
    });
    expect(patch.recurring.repeatMode).toBe("once");
    expect(patch.time.span.start).toBe("2026-08-01T09:00:00.000Z");
    expect(patch.time.span.end).toBe("2026-08-01T09:30:00.000Z");
  });

  it("detects an authored schedulable window from minute-of-day offsets", () => {
    const patch = scheduleToStorePatch({
      ...baseSchedule,
      window: { start_offset_ms: 9 * 3_600_000, end_offset_ms: 17 * 3_600_000 },
    });
    expect(patch.time.timeModel).toBe("window_with_duration");
    expect(patch.time.schedulableWindow).toEqual({ start: "09:00", end: "17:00" });
  });
});

describe("schedule round-trip", () => {
  it("reproduces the server schedule for unedited store state", () => {
    const rebuilt = buildSourceScheduleDefinition(stateWithPatch(baseSchedule), new Date("2026-07-20T00:00:00Z"));
    expect(rebuilt.required_duration_ms).toBe(baseSchedule.required_duration_ms);
    expect(rebuilt.priority).toBe(baseSchedule.priority);
    expect(rebuilt.generation).toMatchObject({
      kind: 1,
      starts_at: "2026-07-01T00:00:00.000Z",
      interval_ms: 86_400_000,
      ends_at: "2026-12-31T00:00:00.000Z",
      excluded_dates: ["2026-07-16"],
      offset_min: 540,
    });
    expect(rebuilt.window).toEqual(baseSchedule.window);
    expect(rebuilt.split_policy).toMatchObject({ kind: 0 });
  });
});
