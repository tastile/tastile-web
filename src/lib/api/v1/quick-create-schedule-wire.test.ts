import { describe, expect, it } from "vitest";
import { buildDefaultQuickCreateState } from "@/lib/stores/quick-create-store";
import { buildQuickCreateSchedulePayload } from "./quick-create-schedule-wire";

describe("buildQuickCreateSchedulePayload", () => {
  it("preserves every authored schedule value in one SourceScheduleDefinition payload", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = {
      ...state.identity,
      kind: 1,
      title: "  Applied mathematics  ",
      description: "Exam preparation",
      externalId: "external-study",
      visual: { color: "#123456", icon: "book" },
    };
    state.time = {
      ...state.time,
      span: { start: "2026-07-28T01:00:00.000Z", end: "2026-07-28T04:00:00.000Z" },
      durationMinMax: { minMs: 1_800_000, maxMs: 3_600_000 },
    };
    state.recurring = {
      ...state.recurring,
      repeatMode: "weekly",
      weekdayMask: 0b0101010,
      endDate: "2026-09-30T00:00:00.000Z",
    };
    state.windows = [
      {
        id: "ignored-server-owned-window-id",
        owner: "self",
        kind: 0,
        bounds: { start: "2026-07-28T01:00:00.000Z", end: "2026-09-30T00:00:00.000Z" },
        referenceId: null,
        rules: [
          {
            id: "01900000-0000-7000-8000-000000000001",
            weekdayMask: 0b0101010,
            timeStart: "09:15",
            timeEnd: "18:45",
            holidayKind: 2,
            dateRange: { startDate: "2026-07-28", endDate: "2026-09-30" },
            when: null,
          },
        ],
      },
    ];
    state.plan = {
      ...state.plan,
      completion: {
        ...state.plan.completion,
        timeRequirements: state.plan.completion.timeRequirements.map((requirement, index) =>
          index === 0
            ? {
                ...requirement,
                required: { minMs: 1_800_000, maxMs: 3_600_000 },
              }
            : requirement,
        ),
      },
      references: [
        {
          id: "01900000-0000-7000-8000-000000000002",
          target: {
            kind: 0,
            contextKind: null,
            referenceId: "01900000-0000-7000-8000-000000000003",
            conditionId: null,
          },
          pick: { kind: 0, momentId: null },
        },
      ],
      decisions: [{ id: "decision", kind: 0, when: null, prompt: "When?", options: [] }],
    };

    const payload = buildQuickCreateSchedulePayload(state, new Date("2026-07-28T00:00:00.000Z"));

    expect(payload.tile).toEqual({
      title: "Applied mathematics",
      description: "Exam preparation",
      color: "#123456",
      icon: "book",
      external_id: "external-study",
    });
    expect(payload.source_client_local_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(payload.source_horizon).toEqual({
      start: "2026-07-28T01:00:00.000Z",
      end: "2026-09-30T00:00:00.000Z",
    });
    expect(payload.source_schedule).toEqual({
      required_duration_ms: 1_800_000,
      generation: {
        kind: 1,
        starts_at: "2026-07-28T01:00:00.000Z",
        interval_ms: 86_400_000,
        ends_at: "2026-09-30T00:00:00.000Z",
        weekday_mask: 0b0101010,
        date_range_start: null,
        date_range_end: "2026-09-30",
        excluded_dates: [],
        offset_min: null,
      },
      window: { start_offset_ms: 0, end_offset_ms: 10_800_000 },
      split_policy: {
        kind: 0,
        min_segment_ms: null,
        max_segment_ms: null,
        max_segments: null,
      },
      priority: 0,
    });
    expect(payload.windows[0].rules[0]).toMatchObject({
      weekday_mask: 0b0101010,
      time_start_min: 555,
      time_end_min: 1125,
      holiday_kind: 2,
      date_range: { start: "2026-07-28", end: "2026-09-30" },
    });
    expect(payload.plan.completion.tasks).toHaveLength(1);
    expect(payload.plan.completion.root).toEqual({
      All: [payload.plan.completion.tasks[0].complete],
    });
    expect(payload.plan.decisions).toHaveLength(1);
    expect(payload.plan.references[0]).toMatchObject({
      target: 0,
      pick: { kind: 0, at: null },
    });
    expect(payload.reference_targets).toEqual([
      {
        source_reference_id: "01900000-0000-7000-8000-000000000002",
        target: { Plan: "01900000-0000-7000-8000-000000000003" },
      },
    ]);
    expect(payload.recurrence).toBeNull();
  });

  it("uses demand-driven SourceGeneration instead of TileKind.RECURRING for condition mode", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Conditional study", kind: 1 };
    state.recurring = { ...state.recurring, repeatMode: "condition" };

    const payload = buildQuickCreateSchedulePayload(state);

    expect(payload.source_schedule?.generation.kind).toBe(2);
    expect(payload.recurrence).toBeNull();
  });

  it("rejects authored values that the atomic contract cannot represent instead of dropping them", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Tagged study" };
    state.meta = { ...state.meta, tags: ["exam"] };

    expect(() => buildQuickCreateSchedulePayload(state)).toThrow(
      "projects and tags are not supported by atomic schedule publish",
    );
  });

  it("combines date-only UI spans with the authored time-of-day range as RFC3339 instants", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Calendar study" };
    state.time = {
      ...state.time,
      span: { start: "2026-07-28", end: "2026-07-28" },
      timeOfDayMode: "range",
      timeOfDayStart: "09:00",
      timeOfDayEnd: "18:00",
    };

    const payload = buildQuickCreateSchedulePayload(state);
    const generationAt = payload.source_schedule?.generation.at;

    expect(generationAt).toMatch(/^2026-07-28T\d{2}:00:00\.000Z$/);
    expect(payload.source_schedule?.window.end_offset_ms).toBe(9 * 60 * 60_000);
    expect(payload.source_horizon?.start).toBe(generationAt);
    expect(payload.source_horizon?.end).toMatch(/^2026-07-28T\d{2}:00:00\.000Z$/);
  });
});
