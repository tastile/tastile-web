import { RecurringState } from "@/shared/model/v1/constants";
import type {
  RecurringSlice,
  SourceAuthoringSlice,
  TimeSlice,
} from "@/shared/stores/quick-create-store";
import type { SourceScheduleWire } from "./source-tiles";

const DAY_MS = 86_400_000;
const MIN_MS = 60_000;
const HOUR_MS = 60 * MIN_MS;

/** Store slices the recurring editor owns and the schedule wire can express. */
export interface SourceScheduleStorePatch {
  recurring: Partial<RecurringSlice>;
  time: Partial<TimeSlice>;
  source: Partial<SourceAuthoringSlice>;
}

function intervalMsToAuthored(ms: number | null): { value: number; unit: "min" | "hour" | "day" } {
  const value = ms !== null && Number.isFinite(ms) && ms > 0 ? ms : DAY_MS;
  if (value % DAY_MS === 0) return { value: value / DAY_MS, unit: "day" };
  if (value % HOUR_MS === 0) return { value: value / HOUR_MS, unit: "hour" };
  return { value: Math.max(1, Math.round(value / MIN_MS)), unit: "min" };
}

function offsetToHHMM(offsetMs: number): string | null {
  if (!Number.isFinite(offsetMs) || offsetMs < 0 || offsetMs >= DAY_MS || offsetMs % MIN_MS !== 0) {
    return null;
  }
  const total = offsetMs / MIN_MS;
  const hour = Math.floor(total / 60);
  const minute = total % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function isoDate(value: string | null | undefined): string {
  if (!value) return "";
  const ms = Date.parse(value);
  return Number.isNaN(ms) ? "" : new Date(ms).toISOString();
}

function repeatModeFor(generation: SourceScheduleWire["generation"]): RecurringSlice["repeatMode"] {
  switch (generation.kind) {
    case 0:
      return "once";
    case 2:
      return "condition";
    case 3:
      return "monthly";
    case 1:
    default:
      if (generation.weekday_mask) return "weekly";
      if (generation.interval_ms === DAY_MS) return "daily";
      return "interval";
  }
}

/**
 * Reverse of `buildSourceScheduleDefinition`: maps a persisted
 * `SourceScheduleDefinition` back onto the QuickCreate store slices the
 * recurring editor owns. Fields the schedule cannot express (relations,
 * flow sequences, plan internals) are intentionally untouched — callers
 * carry those from the server definition verbatim.
 *
 * Ambiguity note: `{start_offset_ms: 0, end_offset_ms: required_duration_ms}`
 * is emitted for every non-window time model, so it hydrates as
 * `duration_only`. A server window that ends exactly at the required
 * duration cannot be distinguished from an authored `window_with_duration`
 * ending at the same offset; `duration_only` is the conservative choice
 * because it reproduces the identical wire window on resubmit.
 */
export function scheduleToStorePatch(schedule: SourceScheduleWire): SourceScheduleStorePatch {
  const { generation } = schedule;
  const required = schedule.required_duration_ms;
  const recurring: Partial<RecurringSlice> = {
    repeatMode: repeatModeFor(generation),
    weekdayMask: generation.weekday_mask ?? 0,
    endDate: isoDate(generation.ends_at),
    life: {
      active: {
        startDate: isoDate(generation.starts_at ?? generation.date_range_start),
        endDate: isoDate(generation.ends_at ?? generation.date_range_end),
      },
      state: RecurringState.ACTIVE,
      changed: { at: "", actor: { id: "self", kind: 0, ownerId: null } },
    },
    monthlyKind: null,
    monthlyDayOfMonth: null,
    monthlyWeekOfMonth: null,
    monthlyWeekday: null,
  };

  const interval = intervalMsToAuthored(generation.interval_ms);
  recurring.intervalValue = interval.value;
  recurring.intervalUnit = interval.unit;

  const monthly = generation.monthly_rule ?? null;
  if (monthly) {
    if (monthly.kind === 0 && monthly.day_of_month != null) {
      recurring.monthlyKind = "by_day";
      recurring.monthlyDayOfMonth = monthly.day_of_month;
    } else if (monthly.kind === 1 && monthly.week_of_month != null && monthly.weekday != null) {
      recurring.monthlyKind = "by_weekday";
      recurring.monthlyWeekOfMonth = monthly.week_of_month;
      // Forward maps store Sunday-first 0-6 to ISO 1-7 with only
      // Sunday special-cased (0 -> 7); reverse is the exact inverse.
      recurring.monthlyWeekday = monthly.weekday === 7 ? 0 : monthly.weekday;
    }
  }

  const time: Partial<TimeSlice> = {
    durationMinMax: { minMs: required, maxMs: required },
    span: { start: "", end: "" },
  };
  if (generation.kind === 0 && generation.at) {
    const atMs = Date.parse(generation.at);
    if (!Number.isNaN(atMs)) {
      time.span = {
        start: generation.at,
        end: new Date(atMs + required).toISOString(),
      };
    }
  }

  const { start_offset_ms: winStart, end_offset_ms: winEnd } = schedule.window;
  const windowStartHHMM = offsetToHHMM(winStart);
  const windowEndHHMM = offsetToHHMM(winEnd);
  const hasAuthoredWindow =
    windowStartHHMM !== null &&
    windowEndHHMM !== null &&
    winStart > 0 &&
    !(winStart === 0 && winEnd === required) &&
    winEnd !== DAY_MS;
  if (hasAuthoredWindow && windowStartHHMM && windowEndHHMM) {
    time.timeModel = "window_with_duration";
    time.schedulableWindow = { start: windowStartHHMM, end: windowEndHHMM };
  } else {
    time.timeModel = "duration_only";
    time.schedulableWindow = { start: "", end: "" };
  }

  const source: Partial<SourceAuthoringSlice> = {
    excludedDates: [...(generation.excluded_dates ?? [])],
    offsetMin: generation.offset_min ?? -new Date().getTimezoneOffset(),
    splitPolicy: {
      kind: (schedule.split_policy.kind === 2 ? 2 : schedule.split_policy.kind === 1 ? 1 : 0) as
        | 0
        | 1
        | 2,
      minSegmentMs: schedule.split_policy.min_segment_ms,
      maxSegmentMs: schedule.split_policy.max_segment_ms,
      maxSegments: schedule.split_policy.max_segments,
    },
    priority: schedule.priority,
  };

  return { recurring, time, source };
}
