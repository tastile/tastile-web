import { describe, expect, it } from "vitest";
import { buildDefaultQuickCreateState } from "@/shared/stores/quick-create-store";
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
    state.source = {
      ...state.source,
      offsetMin: 540,
      excludedDates: ["2026-08-06"],
      preferredDurationMinMax: { minMs: 2_400_000, maxMs: 3_000_000 },
      splitPolicy: {
        kind: 1,
        minSegmentMs: 900_000,
        maxSegmentMs: 1_800_000,
        maxSegments: 4,
      },
      priority: 25,
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
        excluded_dates: ["2026-08-06"],
        offset_min: 540,
      },
      window: { start_offset_ms: 0, end_offset_ms: 10_800_000 },
      split_policy: {
        kind: 1,
        min_segment_ms: 900_000,
        max_segment_ms: 1_800_000,
        max_segments: 4,
      },
      priority: 25,
    });
    expect(payload.windows[0].rules[0]).toMatchObject({
      weekday_mask: 0b0101010,
      time_start_min: 555,
      time_end_min: 1125,
      holiday_kind: 2,
      date_range: { start: "2026-07-28", end: "2026-09-30" },
    });
    expect(payload.plan.completion.tasks).toHaveLength(1);
    expect(payload.plan.completion.time_requirements[0]?.preferred).toEqual({
      min: 2_400_000,
      max: 3_000_000,
    });
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

  it("publishes a peer Source relation atomically without parent/child fields", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "AtCoder ABC" };
    state.source = {
      ...state.source,
      relations: [
        {
          id: "01900000-0000-7000-8000-000000000010",
          referencedSourceTileId: "01900000-0000-7000-8000-000000000011",
          referencedTitle: "Focus span",
          kind: 0,
          point: 0,
          offsetMs: 0,
          ordering: { primary: 1, point: 0, direction: 0 },
          durationKind: "reference",
          fixedDurationMs: null,
          splitPolicy: {
            kind: "split",
            requiredTotalDurationMs: 5_400_000,
            minSegmentMs: 900_000,
            maxSegmentMs: 2_700_000,
          },
          correlationScope: 1,
          lifecycleFilter: 1,
          eligibleThroughRevision: 8,
          summaryPriority: 100,
        },
      ],
    };

    const payload = buildQuickCreateSchedulePayload(state);
    const relation = payload.relations?.[0];

    expect(relation).toMatchObject({
      client_local_id: "01900000-0000-7000-8000-000000000010",
      subject_source_ref: {
        kind: "local",
        client_local_id: payload.source_client_local_id,
      },
      referenced_source_ref: {
        kind: "existing",
        source_tile_id: "01900000-0000-7000-8000-000000000011",
      },
      kind: 0,
      ordering: { primary: 1, point: 0, direction: 0 },
      duration_expression: {
        ReferenceSpan: {
          referenced_source_ref: {
            kind: "existing",
            source_tile_id: "01900000-0000-7000-8000-000000000011",
          },
        },
      },
      split_policy: {
        Split: {
          required_total_duration_ms: 5_400_000,
          min_segment_ms: 900_000,
          max_segment_ms: 2_700_000,
        },
      },
    });
    expect(relation).not.toHaveProperty("parent");
    expect(relation).not.toHaveProperty("child");
  });

  it("uses demand-driven SourceGeneration instead of TileKind.RECURRING for condition mode", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Conditional study", kind: 1 };
    state.recurring = { ...state.recurring, repeatMode: "condition" };

    const payload = buildQuickCreateSchedulePayload(state);

    expect(payload.source_schedule?.generation.kind).toBe(2);
    expect(payload.recurrence).toBeNull();
  });

  it("publishes generic wait/emit Flow sequences without a use-case discriminator", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Renamed workflow" };
    state.source = {
      ...state.source,
      flowSequences: [
        {
          id: "01900000-0000-7000-8000-000000000020",
          observes: ["PlacementCreated", "ExecutionFinished"],
          when: null,
          candidateWhen: null,
          minimumGapMs: 20 * 60_000,
          rank: 7,
          cycle: false,
          resetOnInterrupt: false,
          steps: [
            { id: "a", waitBeforeMs: 15 * 60_000, emitDurationMs: 5 * 60_000 },
            { id: "b", waitBeforeMs: 90 * 60_000, emitDurationMs: 30 * 60_000 },
          ],
        },
      ],
    };

    const payload = buildQuickCreateSchedulePayload(
      state,
      new Date("2026-07-29T00:00:00.000Z"),
    );

    expect(payload.flows).toHaveLength(1);
    expect(payload.flows[0]).toMatchObject({
      observes: ["PlacementCreated", "ExecutionFinished"],
      when: null,
      candidates: [
        {
          rank: 7,
          outputs: [
            {
              ProposeNewPlanPlacementSequence: {
                sequence_steps: [
                  { wait_before_ms: 900_000, emit_duration_ms: 300_000 },
                  { wait_before_ms: 5_400_000, emit_duration_ms: 1_800_000 },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(JSON.stringify(payload.flows)).not.toContain("break");
    expect(JSON.stringify(payload.flows)).not.toContain("sleep");
  });

  it("preserves placement rule rank, effect and duration range", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Flexible task" };
    state.plan = {
      ...state.plan,
      planning: {
        ...state.plan.planning,
        placementRules: [
          {
            id: "01900000-0000-7000-8000-000000000030",
            when: null,
            rank: 12,
            effect: {
              kind: 2,
              scope: { kind: 0, parent: null, gap: null },
              span: { minMs: 900_000, maxMs: 2_700_000 },
              score: null,
              record: null,
            },
          },
        ],
      },
    };

    const payload = buildQuickCreateSchedulePayload(state);

    expect(payload.plan.planning.placement_rules).toEqual([
      {
        id: "01900000-0000-7000-8000-000000000030",
        when: null,
        rank: 12,
        effect: {
          kind: 2,
          scope: { kind: 0, parent: null, gap: null },
          span: { min: 900_000, max: 2_700_000 },
          score: null,
          record: null,
        },
      },
    ]);
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

  it("rejects a completely empty window draft instead of silently dropping it", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Draft window" };
    state.windows = [
      {
        id: "draft",
        owner: "self",
        kind: 0,
        bounds: { start: "", end: "" },
        rules: [],
        referenceId: null,
      },
    ];

    expect(() => buildQuickCreateSchedulePayload(state)).toThrow(
      /window 1 requires both bounds/,
    );
  });

  it("survives when state.windows is empty (no windows authored)", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "No windows" };
    state.windows = [];

    expect(buildQuickCreateSchedulePayload(state).windows).toEqual([]);
  });

  it.each([
    [{ start: "2026-07-28T01:00:00.000Z", end: "" }, "both bounds"],
    [{ start: "not-a-date", end: "2026-07-28T02:00:00.000Z" }, "valid RFC3339"],
    [
      { start: "2026-07-28T03:00:00.000Z", end: "2026-07-28T02:00:00.000Z" },
      "before end",
    ],
  ])("rejects an authored invalid window instead of dropping it: %j", (bounds, message) => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Invalid window" };
    state.windows = [
      {
        id: "invalid",
        owner: "self",
        kind: 0,
        bounds,
        rules: [],
        referenceId: null,
      },
    ];

    expect(() => buildQuickCreateSchedulePayload(state)).toThrow(message);
  });

  it("uses the injected clock for recurring generation without an authored start", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Daily study" };
    state.recurring = { ...state.recurring, repeatMode: "daily" };

    const payload = buildQuickCreateSchedulePayload(
      state,
      new Date("2026-07-28T12:34:56.000Z"),
    );

    expect(payload.source_schedule?.generation.starts_at).toBe("2026-07-28T12:34:56.000Z");
  });

  it("rejects incomplete relations and empty flow sequences", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Invalid graph" };
    state.source.relations = [
      {
        id: "relation",
        referencedSourceTileId: "",
        referencedTitle: "",
        kind: 0,
        point: 0,
        offsetMs: 0,
        ordering: { primary: 1, point: 0, direction: 0 },
        durationKind: "subject",
        fixedDurationMs: null,
        splitPolicy: {
          kind: "unsplit",
          requiredTotalDurationMs: 30 * 60_000,
          minSegmentMs: null,
          maxSegmentMs: null,
        },
        correlationScope: 0,
        lifecycleFilter: 0,
        eligibleThroughRevision: 1,
        summaryPriority: 0,
      },
    ];

    expect(() => buildQuickCreateSchedulePayload(state)).toThrow(
      "relation 1 requires a referenced Source",
    );

    state.source.relations = [];
    state.source.flowSequences = [
      {
        id: "flow",
        observes: ["PlacementCreated"],
        when: null,
        candidateWhen: null,
        minimumGapMs: 0,
        rank: 0,
        cycle: false,
        resetOnInterrupt: false,
        steps: [],
      },
    ];
    expect(() => buildQuickCreateSchedulePayload(state)).toThrow(
      "flow 1 requires positive sequence steps",
    );
  });
});
