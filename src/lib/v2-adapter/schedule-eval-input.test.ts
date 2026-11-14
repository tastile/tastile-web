import { describe, expect, it } from "vitest";

import {
  deriveV2SchedulerInput,
  type V2ScheduleEvalState,
} from "./schedule-eval-input";

const NOW = Date.parse("2026-11-14T00:00:00.000Z");
const DAY = 86_400_000;

function baseState(
  overrides: Partial<V2ScheduleEvalState> = {},
): V2ScheduleEvalState {
  return {
    repeatMode: "daily",
    intervalValue: 1,
    intervalUnit: "day",
    recurringStart: null,
    recurringEnd: null,
    spanStart: null,
    spanEnd: null,
    durationMinMs: 1_800_000,
    durationMaxMs: 1_800_000,
    requirementMinMs: null,
    requirementMaxMs: null,
    windowBounds: [],
    nowMs: NOW,
    ...overrides,
  };
}

describe("deriveV2SchedulerInput", () => {
  it("maps daily recurrence to a DAY_MS step", () => {
    const result = deriveV2SchedulerInput(baseState());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.step_ms).toBe(DAY);
    expect(result.input.span_ms).toBe(1_800_000);
  });

  it("maps interval recurrence through the authored interval", () => {
    const result = deriveV2SchedulerInput(
      baseState({ repeatMode: "interval", intervalValue: 90, intervalUnit: "min" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.step_ms).toBe(90 * 60_000);
  });

  it("falls back to the wire default interval for non-positive values", () => {
    const result = deriveV2SchedulerInput(
      baseState({ repeatMode: "interval", intervalValue: 0, intervalUnit: "day" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.step_ms).toBe(30 * 60_000);
  });

  it("approximates monthly like the v1 wire (daily step)", () => {
    const result = deriveV2SchedulerInput(baseState({ repeatMode: "monthly" }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.step_ms).toBe(DAY);
  });

  it.each(["once", "condition", "unknown"])(
    "rejects non-recurring repeatMode %s",
    (repeatMode) => {
      const result = deriveV2SchedulerInput(baseState({ repeatMode }));
      expect(result).toEqual({ ok: false, reason: "unsupported_repeat" });
    },
  );

  it("rejects when no duration is authored anywhere", () => {
    const result = deriveV2SchedulerInput(
      baseState({
        durationMinMs: null,
        durationMaxMs: null,
        requirementMinMs: null,
        requirementMaxMs: null,
      }),
    );
    expect(result).toEqual({ ok: false, reason: "missing_duration" });
  });

  it("falls back to completion requirement duration", () => {
    const result = deriveV2SchedulerInput(
      baseState({
        durationMinMs: null,
        durationMaxMs: null,
        requirementMinMs: 3_600_000,
        requirementMaxMs: null,
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.span_ms).toBe(3_600_000);
  });

  it("uses the first fully-bound window as bounds", () => {
    const result = deriveV2SchedulerInput(
      baseState({
        windowBounds: [
          { start: "", end: "" },
          {
            start: "2026-11-15T09:00:00",
            end: "2026-11-15T18:00:00",
          },
        ],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.bounds_start).toBe(
      Date.parse("2026-11-15T09:00:00"),
    );
    expect(result.input.bounds_end).toBe(Date.parse("2026-11-15T18:00:00"));
  });

  it("defaults bounds to null when no window is fully bound", () => {
    const result = deriveV2SchedulerInput(
      baseState({
        windowBounds: [{ start: "2026-11-15T09:00:00", end: "" }],
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.bounds_start).toBeNull();
    expect(result.input.bounds_end).toBeNull();
  });

  it("defaults the horizon to now + 14d without authored dates", () => {
    const result = deriveV2SchedulerInput(baseState());
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.range_start_ms).toBe(NOW);
    expect(result.input.range_end_ms).toBe(NOW + 14 * DAY);
  });

  it("honors authored span dates for the horizon", () => {
    const result = deriveV2SchedulerInput(
      baseState({
        spanStart: "2026-11-20",
        spanEnd: "2026-11-25",
      }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.range_start_ms).toBe(
      Date.parse("2026-11-20T00:00:00"),
    );
    expect(result.input.range_end_ms).toBe(Date.parse("2026-11-25T00:00:00"));
  });

  it("clamps a past authored start to now", () => {
    const result = deriveV2SchedulerInput(
      baseState({ spanStart: "2026-01-01", spanEnd: "2026-01-02" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.range_start_ms).toBe(NOW);
    expect(result.input.range_end_ms).toBe(NOW + 14 * DAY);
  });

  it("caps the horizon at the recurring end date", () => {
    const result = deriveV2SchedulerInput(
      baseState({ recurringEnd: "2026-11-20" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.range_end_ms).toBe(Date.parse("2026-11-20T00:00:00"));
  });

  it("derives origin from the recurring start anchor", () => {
    const result = deriveV2SchedulerInput(
      baseState({ recurringStart: "2026-11-01T08:30:00" }),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.input.origin).toBe(Date.parse("2026-11-01T08:30:00"));
  });
});
