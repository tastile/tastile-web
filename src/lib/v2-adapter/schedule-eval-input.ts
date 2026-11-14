import { validInstant } from "@/shared/api/v1/quick-create-schedule-wire";

import type { SchedulerEvalInput } from "./scheduler-eval";

// G4 (web#215): derives the strict SchedulerEvalInput port set for
// POST /api/v2/scheduler/evaluate from the QuickCreate schedule state.
// The mapping mirrors quick-create-schedule-wire.ts so the v2 preview
// reflects the same recurrence interval / horizon the v1 wire would emit.
// Anything that cannot be derived faithfully returns a typed reason
// instead of fabricating input.

const MIN_MS = 60_000;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 86_400_000;
// Mirrors DEFAULT_INTERVAL_MS in quick-create-schedule-wire.ts: the v1
// wire falls back to 30 min for non-positive authored intervals, so the
// v2 preview uses the same effective step rather than rejecting the form.
const DEFAULT_INTERVAL_MS = 30 * MIN_MS;
const EVAL_HORIZON_MS = 14 * DAY_MS;

type V2EvalUnsupportedReason =
  | "unsupported_repeat"
  | "missing_duration"
  | "expired_recurrence";

export interface V2ScheduleEvalState {
  repeatMode: string;
  intervalValue: number;
  intervalUnit: "min" | "hour" | "day";
  recurringStart: string | null;
  recurringEnd: string | null;
  spanStart: string | null;
  spanEnd: string | null;
  durationMinMs: number | null;
  durationMaxMs: number | null;
  requirementMinMs: number | null;
  requirementMaxMs: number | null;
  windowBounds: ReadonlyArray<{ start: string; end: string }>;
  nowMs: number;
}

export type V2EvalDerivation =
  | { ok: true; input: SchedulerEvalInput }
  | { ok: false; reason: V2EvalUnsupportedReason };

function intervalAuthoredMs(
  value: number,
  unit: "min" | "hour" | "day",
): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_INTERVAL_MS;
  if (unit === "min") return value * MIN_MS;
  if (unit === "hour") return value * HOUR_MS;
  return value * DAY_MS;
}

function stepMsFor(state: V2ScheduleEvalState): number | null {
  switch (state.repeatMode) {
    case "daily":
      // The v1 wire emits DAY_MS for plain daily recurrence.
      return DAY_MS;
    case "weekly":
    case "interval":
      return intervalAuthoredMs(state.intervalValue, state.intervalUnit);
    case "monthly":
      // v1 has no first-class monthly generator; the wire approximates it
      // as daily recurrence bounded by date_range_*. The v2 preview uses
      // the same effective step.
      return DAY_MS;
    default:
      // "once" / "condition" are not recurring schedules; v2 occurrence
      // evaluation does not apply.
      return null;
  }
}

function spanMsFor(state: V2ScheduleEvalState): number | null {
  const candidates = [
    state.durationMinMs,
    state.durationMaxMs,
    state.requirementMinMs,
    state.requirementMaxMs,
  ];
  for (const value of candidates) {
    if (typeof value === "number" && Number.isFinite(value) && value > 0) {
      return Math.round(value);
    }
  }
  return null;
}

function instantMs(value: string | null | undefined): number | null {
  const iso = validInstant(value);
  if (!iso) return null;
  const ms = Date.parse(iso);
  return Number.isFinite(ms) ? Math.floor(ms) : null;
}

function boundsFor(
  state: V2ScheduleEvalState,
): { bounds_start: number | null; bounds_end: number | null } {
  for (const w of state.windowBounds) {
    const start = instantMs(w.start);
    const end = instantMs(w.end);
    if (start !== null && end !== null && end > start) {
      return { bounds_start: start, bounds_end: end };
    }
  }
  return { bounds_start: null, bounds_end: null };
}

export function deriveV2SchedulerInput(
  state: V2ScheduleEvalState,
): V2EvalDerivation {
  const step = stepMsFor(state);
  if (step === null) return { ok: false, reason: "unsupported_repeat" };
  const span = spanMsFor(state);
  if (span === null) return { ok: false, reason: "missing_duration" };

  const { bounds_start, bounds_end } = boundsFor(state);

  const originIso = validInstant(state.recurringStart);
  const origin = originIso ? Math.floor(Date.parse(originIso)) : null;

  // Evaluation horizon: prefer the authored date range, otherwise the
  // next 14 days from now. A past or empty authored start clamps to now
  // because v1 placements only materialize in the future anyway.
  const authoredStart = instantMs(state.spanStart);
  const rangeStart =
    authoredStart !== null ? Math.max(authoredStart, state.nowMs) : state.nowMs;
  const authoredEnd = instantMs(state.spanEnd);
  const recurringEnd = instantMs(state.recurringEnd);
  // An authored end at or before the range start means the recurrence
  // window has already closed. Extending the horizon past it would
  // propose occurrences the v1 wire would never emit, so report the
  // schedule as unsupported instead of fabricating input.
  if (
    (authoredEnd !== null && authoredEnd <= rangeStart) ||
    (recurringEnd !== null && recurringEnd <= rangeStart)
  ) {
    return { ok: false, reason: "expired_recurrence" };
  }
  let rangeEnd = authoredEnd ?? rangeStart + EVAL_HORIZON_MS;
  if (recurringEnd !== null) {
    rangeEnd = Math.min(rangeEnd, recurringEnd);
  }

  return {
    ok: true,
    input: {
      step_ms: step,
      span_ms: span,
      origin: origin !== null && Number.isFinite(origin) ? origin : null,
      bounds_start,
      bounds_end,
      range_start_ms: rangeStart,
      range_end_ms: rangeEnd,
    },
  };
}
