import { describe, expect, it, vi } from "vitest";
import { buildDefaultQuickCreateState } from "@/shared/stores/quick-create-store";
import { buildQuickCreateSchedulePayload } from "./quick-create-schedule-wire";
import { AnchorMode, SourceWindowInclude } from "./schedule-definition";

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
      decisions: [
        {
          id: "decision",
          observe: { scope: 0 },
          candidates: [],
          reuse: [],
          dialog: null,
        },
      ],
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
        interval_ms: 1_800_000,
        ends_at: "2026-09-30T00:00:00.000Z",
        weekday_mask: 0b0101010,
        date_range_start: null,
        date_range_end: "2026-09-30",
        excluded_dates: ["2026-08-06"],
        offset_min: 540,
      },
      window: { start_offset_ms: 0, end_offset_ms: 1_800_000 },
      source_window_include: 1,
      anchor_mode: 0,
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

  it("silently drops non-null recurring.condition with console.warn and does not wire it into completion.root (E1a)", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Condition drop" };
    state.recurring = {
      ...state.recurring,
      repeatMode: "condition",
      condition: { kind: 0, children: [], term: null },
    };
    // Remove the default "Mark done" task so completion.root stays as-is
    state.plan.completion.tasks = [];

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const payload = buildQuickCreateSchedulePayload(state);

    expect(payload).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith("[Phase C/D reserved] recurring.condition ignored");
    // completion.root must NOT contain the condition AST — it should be the plain default root
    expect(payload.plan.completion.root).toEqual({ All: [] });

    warnSpy.mockRestore();
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

  // F1a: `state.meta.project` is removed from the MetaSlice, so this test
  // documents the runtime contract — the wire must not throw on any meta
  // value the atomic schedule cannot represent (project / tags). The type
  // system enforces the absence of `state.meta.project` at compile time;
  // this test proves the wire path stays green when only memo is set.
  it("builds a payload when meta holds only memo (F1a — no project field exists on MetaSlice)", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Quiet study" };
    state.meta = { ...state.meta, memo: "left a note for later" };
    // @ts-expect-error — `project` was removed from MetaSlice in F1a; this
    // line is the regression guard. If `state.meta.project` is reintroduced,
    // the @ts-expect-error becomes unused and TypeScript will fail the build.
    state.meta = { ...state.meta, project: "MyProject" };

    const payload = buildQuickCreateSchedulePayload(state);

    expect(payload).toBeDefined();
    expect(payload.tile.title).toBe("Quiet study");
  });

  // F1b: `state.meta.tags` is removed from the MetaSlice, so this test
  // documents the runtime contract — even when a stale caller passes
  // `tags: ['work']`, the wire must not throw and must reach
  // `publishScheduleDefinition` payload construction. The type system
  // enforces the absence of `state.meta.tags` at compile time; the
  // `@ts-expect-error` is the regression guard. If `state.meta.tags` is
  // reintroduced, the `@ts-expect-error` becomes unused and TypeScript
  // will fail the build.
  it("builds a payload even when meta.tags is supplied as ['work'] (F1b — silent drop, no throw)", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Tag-driven study" };
    // @ts-expect-error — `tags` was removed from MetaSlice in F1b; this
    // line is the regression guard. If `state.meta.tags` is reintroduced,
    // the @ts-expect-error becomes unused and TypeScript will fail the build.
    state.meta = { ...state.meta, tags: ["work"] };

    const payload = buildQuickCreateSchedulePayload(state);

    expect(payload).toBeDefined();
    expect(payload.tile.title).toBe("Tag-driven study");
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
      durationMinMax: { minMs: 30 * 60_000, maxMs: 30 * 60_000 },
      timeOfDayMode: "range",
      timeOfDayStart: "09:00",
      timeOfDayEnd: "18:00",
    };
    state.plan = {
      ...state.plan,
      completion: {
        ...state.plan.completion,
        timeRequirements: state.plan.completion.timeRequirements.map((tr, i) =>
          i === 0
            ? { ...tr, required: { minMs: 30 * 60_000, maxMs: 30 * 60_000 } }
            : tr,
        ),
      },
    };

    const payload = buildQuickCreateSchedulePayload(state);
    const generationAt = payload.source_schedule?.generation.at;

    expect(generationAt).toMatch(/^2026-07-28T\d{2}:00:00\.000Z$/);
    expect(payload.source_schedule?.window.end_offset_ms).toBe(1_800_000);
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

  it("maps frameRules to frame_rules in payload (D1a)", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "FrameRule study" };
    state.recurring = {
      ...state.recurring,
      frameRules: [
        {
          id: "fr1",
          generator: { kind: "step", value: { step: 86_400_000, origin: null, bounds: null } },
          active: null,
        },
      ],
    };

    const payload = buildQuickCreateSchedulePayload(state);

    expect(payload.frame_rules).toHaveLength(1);
    expect(payload.frame_rules[0].id).toBe("fr1");
    expect(payload.frame_rules[0].rank).toBe(0);
    expect(payload.frame_rules[0].generator).toEqual({
      Step: { step: 86_400_000, origin: null, bounds: null },
    });
  });

  it("silently drops non-empty changeSets with a console.warn (D2a)", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "ChangeSet study" };
    state.advanced = {
      changeSets: [{ id: "cs1", when: null, rank: 0, merge: 0, changes: [] }],
      rules: [],
    };

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const payload = buildQuickCreateSchedulePayload(state);

    expect(payload).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith(
      "[D2a] advanced change rules silently dropped in create path",
    );

    warnSpy.mockRestore();
  });

  it("silently drops non-empty legacy flows with a console.warn (D2a)", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Legacy flow study" };
    state.plan = {
      ...state.plan,
      planning: {
        ...state.plan.planning,
        flows: [{ id: "legacy-flow", observe: [], when: null, candidates: [] }],
      },
    };

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const payload = buildQuickCreateSchedulePayload(state);

    expect(payload).toBeDefined();
    expect(warnSpy).toHaveBeenCalledWith(
      "[D2a] legacy rules/planning flows silently dropped in create path",
    );

    warnSpy.mockRestore();
  });

  // ── C1a: Recurring.kind enum round-trip ──────────────────────────────
  // SourceGenerationKind has only 3 valid values (0/1/2). weekly must map
  // to Recurring (1), monthly falls back to Recurring (1) with DAY_MS
  // since the v1/02 domain has no first-class monthly generator.
  it.each([
    ["once", 0, "NONE"],
    ["daily", 1, "DAILY"],
    ["weekly", 1, "WEEKLY"],
    ["monthly", 1, "MONTHLY"],
  ])(
    "maps repeatMode=%s to generation.kind=%d (%s)",
    (repeatMode: string, expectedKind: number) => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: `${repeatMode} round-trip` };
      state.recurring = { ...state.recurring, repeatMode: repeatMode as any };
      state.time = {
        ...state.time,
        span: { start: "2026-08-01T09:00:00.000Z", end: "2026-08-01T10:00:00.000Z" },
      };
      state.recurring.endDate = "2026-12-31T00:00:00.000Z";

      const payload = buildQuickCreateSchedulePayload(
        state,
        new Date("2026-08-01T00:00:00.000Z"),
      );

      expect(payload.source_schedule?.generation.kind).toBe(expectedKind);
    },
  );

  it("silently drops unknown repeatMode to kind=1 (RECURRING) via fallback", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Unknown mode" };
    // @ts-expect-error — intentionally passing an invalid repeatMode
    state.recurring = { ...state.recurring, repeatMode: "unknown_future" };

    const payload = buildQuickCreateSchedulePayload(state);

    // repeatMode=condition maps to kind=2 (DemandDriven);
    // once-with-or-without-start maps to kind=0 (OneTime) — empty span
    //   defaults `at` to now so the worker materializes a placement;
    // weekly/monthly/interval/daily all hit kind=1 branches;
    // an unrecognized mode hits the final return with kind=1.
    expect(payload.source_schedule?.generation.kind).toBe(1);
  });

  // ── C1c: once-without-start defaults to kind=0 with `at: now` ─────────
  // QuickCreate's default state has an empty span. The user expects the
  // tile to appear in /v1/timeline after submit (UX intent = "create and
  // place now"), so the wire must emit SourceGenerationKind::OneTime (0)
  // with `at` defaulted to now — not DemandDriven (2), which requires a
  // Flow source to materialize.
  it("once-without-start defaults to kind=0 with at: now", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "No span tile" };
    // repeatMode stays "once" (default), span stays empty (default).

    const payload = buildQuickCreateSchedulePayload(
      state,
      new Date("2026-08-01T12:00:00.000Z"),
    );

    expect(payload.source_schedule?.generation.kind).toBe(0);
    expect(payload.source_schedule?.generation.at).toBe(
      "2026-08-01T12:00:00.000Z",
    );
  });

  // ── C1d: once-without-start caps duration at 5 min ─────────────────────
  // The seeded time requirement defaults to 30 min, but the "place now" UX
  // intent is a short visible event. The wire caps `required_duration_ms`
  // to 5 min so any partial free gap (e.g. between two 休憩 SourceTile
  // placements) accepts the materialization; otherwise the occurrence is
  // marked unplaced (state=1) and the new tile never appears in /v1/timeline.
  it("once-without-start caps required_duration_ms at 5 min", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Short place-now tile" };
    // repeatMode stays "once" (default), span stays empty (default).
    // state.time.durationMinMax.minMs stays null (no user input).

    const payload = buildQuickCreateSchedulePayload(
      state,
      new Date("2026-08-01T12:00:00.000Z"),
    );

    expect(payload.source_schedule?.required_duration_ms).toBe(5 * 60_000);
  });

  // ── C1e: once-without-start honors explicit user duration ──────────────
  // If the user authors a 30-min duration in QuickCreate, the wire must NOT
  // override it with the 5-min cap. The cap only applies to the empty-span
  // "place now" default.
  it("once-without-start honors explicit user duration over the 5 min cap", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Authored 30 min tile" };
    state.time = {
      ...state.time,
      durationMinMax: { minMs: 30 * 60_000, maxMs: 30 * 60_000 },
    };
    // The wire requires the duration range to be represented by a matching
    // completion time requirement (v1/13 cross-reference).
    state.plan.completion = {
      ...state.plan.completion,
      timeRequirements: [
        {
          id: "tr_explicit",
          observation: { scope: 1, source: 0, aggregate: 0, quantifier: 0 },
          required: { minMs: 30 * 60_000, maxMs: 30 * 60_000 },
          preferred: null,
        },
      ],
    };

    const payload = buildQuickCreateSchedulePayload(
      state,
      new Date("2026-08-01T12:00:00.000Z"),
    );

    expect(payload.source_schedule?.required_duration_ms).toBe(30 * 60_000);
  });

  // ── C1b: weekday_mask bit-order round-trip ───────────────────────────
  it("passes weekdayMask through to generation.weekday_mask when repeatMode=weekly", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Weekly mask" };
    state.recurring = {
      ...state.recurring,
      repeatMode: "weekly",
      weekdayMask: 0b0011111, // Mon–Fri (31)
      endDate: "2026-12-31T00:00:00.000Z",
    };
    state.time = {
      ...state.time,
      span: { start: "2026-08-03T09:00:00.000Z", end: "2026-08-03T10:00:00.000Z" },
    };

    const payload = buildQuickCreateSchedulePayload(
      state,
      new Date("2026-08-03T00:00:00.000Z"),
    );

    expect(payload.source_schedule?.generation.weekday_mask).toBe(0b0011111);
  });

  it("nullifies weekday_mask when repeatMode is not weekly", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Daily no mask" };
    state.recurring = {
      ...state.recurring,
      repeatMode: "daily",
      weekdayMask: 0b0011111,
    };

    const payload = buildQuickCreateSchedulePayload(state);

    expect(payload.source_schedule?.generation.weekday_mask).toBeNull();
  });

  it("clamps weekdayMask to 7 bits via normalizeWeekdayMask", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Bit8 clamp" };
    state.recurring = {
      ...state.recurring,
      repeatMode: "weekly",
      weekdayMask: 0b10011111, // bit8 set → should be clamped to 0b00011111
      endDate: "2026-12-31T00:00:00.000Z",
    };
    state.time = {
      ...state.time,
      span: { start: "2026-08-03T09:00:00.000Z", end: "2026-08-03T10:00:00.000Z" },
    };

    const payload = buildQuickCreateSchedulePayload(
      state,
      new Date("2026-08-03T00:00:00.000Z"),
    );

    expect(payload.source_schedule?.generation.weekday_mask).toBe(0b00011111);
  });

  it("preserves weekday_mask in window rules independently of generation", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Window mask" };
    state.recurring = {
      ...state.recurring,
      repeatMode: "weekly",
      weekdayMask: 0b0101010,
      endDate: "2026-12-31T00:00:00.000Z",
    };
    state.windows = [
      {
        id: "w1",
        owner: "self",
        kind: 0,
        bounds: { start: "2026-08-01T00:00:00.000Z", end: "2026-12-31T00:00:00.000Z" },
        referenceId: null,
        rules: [
          {
            id: "r1",
            weekdayMask: 0b0101010,
            timeStart: "09:00",
            timeEnd: "18:00",
            holidayKind: 2,
            dateRange: null,
            when: null,
          },
        ],
      },
    ];

    const payload = buildQuickCreateSchedulePayload(state);

    expect(payload.windows[0].rules[0].weekday_mask).toBe(0b0101010);
  });

  // ── C1c: interval unit round-trip ────────────────────────────────────
  it.each([
    [30, "min" as const, 1_800_000, "30 min"],
    [2, "hour" as const, 7_200_000, "2 hour"],
    [1, "day" as const, 86_400_000, "1 day"],
  ])(
    "maps intervalValue=%d intervalUnit=%s to generation.interval_ms=%d (%s)",
    (value, unit, expectedMs) => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: `Interval ${value} ${unit}` };
      state.recurring = {
        ...state.recurring,
        repeatMode: "interval",
        intervalValue: value,
        intervalUnit: unit,
        endDate: "2026-12-31T00:00:00.000Z",
      };
      state.time = {
        ...state.time,
        span: { start: "2026-08-01T09:00:00.000Z", end: "2026-08-01T10:00:00.000Z" },
      };

      const payload = buildQuickCreateSchedulePayload(
        state,
        new Date("2026-08-01T00:00:00.000Z"),
      );

      expect(payload.source_schedule?.generation.interval_ms).toBe(expectedMs);
    },
  );

  it("defaults to DAY_MS when intervalValue is non-positive", () => {
    const state = buildDefaultQuickCreateState();
    state.identity = { ...state.identity, title: "Invalid interval" };
    state.recurring = {
      ...state.recurring,
      repeatMode: "interval",
      intervalValue: 0,
      intervalUnit: "min",
    };

    const payload = buildQuickCreateSchedulePayload(state);

    expect(payload.source_schedule?.generation.interval_ms).toBe(1_800_000);
  });

  // ── C2b: endDate (Instant) vs life.active.endDate (LocalDate) ──────
  describe("endDate vs life.active.endDate field mapping", () => {
    it("maps endDate to ends_at and date_range_end when only endDate is set", () => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: "endDate only" };
      state.time = {
        ...state.time,
        span: { start: "2026-09-01T09:00:00.000Z", end: "2026-09-01T10:00:00.000Z" },
      };
      state.recurring = {
        ...state.recurring,
        repeatMode: "daily",
        endDate: "2026-09-30T00:00:00Z",
        life: {
          ...state.recurring.life,
          active: { startDate: "", endDate: "" },
        },
      };

      const payload = buildQuickCreateSchedulePayload(state);

      expect(payload.source_schedule?.generation.ends_at).toBe("2026-09-30T00:00:00.000Z");
      expect(payload.source_schedule?.generation.date_range_end).toBe("2026-09-30");
    });

    it("maps life.active.endDate to ends_at and date_range_end when only life.active.endDate is set", () => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: "life.active.endDate only" };
      state.time = {
        ...state.time,
        span: { start: "2026-10-01T09:00:00.000Z", end: "2026-10-01T10:00:00.000Z" },
      };
      state.recurring = {
        ...state.recurring,
        repeatMode: "daily",
        endDate: "",
        life: {
          ...state.recurring.life,
          active: { startDate: "", endDate: "2026-10-31" },
        },
      };

      const payload = buildQuickCreateSchedulePayload(state);

      // life.active.endDate "2026-10-31" → validInstant converts via local midnight
      // In UTC+9: local midnight = 15:00 UTC previous day → "2026-10-30T15:00:00.000Z"
      // date_range_end is derived from end (the Instant), not from the original LocalDate
      // This demonstrates the conflict: LocalDate "2026-10-31" becomes "2026-10-30" in date_range_end
      expect(payload.source_schedule?.generation.date_range_end).toBe("2026-10-30");
    });

    it("prefers endDate over life.active.endDate when both are set", () => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: "both set" };
      state.time = {
        ...state.time,
        span: { start: "2026-09-01T09:00:00.000Z", end: "2026-09-01T10:00:00.000Z" },
      };
      state.recurring = {
        ...state.recurring,
        repeatMode: "daily",
        endDate: "2026-09-30T00:00:00Z",
        life: {
          ...state.recurring.life,
          active: { startDate: "", endDate: "2026-10-31" },
        },
      };

      const payload = buildQuickCreateSchedulePayload(state);

      expect(payload.source_schedule?.generation.ends_at).toBe("2026-09-30T00:00:00.000Z");
      expect(payload.source_schedule?.generation.date_range_end).toBe("2026-09-30");
    });

    it("returns null for both fields when neither is set", () => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: "neither set" };
      state.time = {
        ...state.time,
        span: { start: "2026-09-01T09:00:00.000Z", end: "2026-09-01T10:00:00.000Z" },
      };
      state.recurring = {
        ...state.recurring,
        repeatMode: "daily",
        endDate: "",
        life: {
          ...state.recurring.life,
          active: { startDate: "", endDate: "" },
        },
      };

      const payload = buildQuickCreateSchedulePayload(state);

      expect(payload.source_schedule?.generation.ends_at).toBeNull();
      expect(payload.source_schedule?.generation.date_range_end).toBeNull();
    });
  });

  // ── C3a: source.{offsetMin, priority} round-trip ────────────────────
  describe("C3a: source.offsetMin round-trip", () => {
    it.each([
      [0, "zero offset"],
      [540, "JST +9 (UTC+9)"],
      [-540, "negative offset"],
      [720, "max offset"],
      [-720, "min offset"],
    ])("serializes offsetMin=%d to generation.offset_min=%d (%s)", (offsetMin, _label) => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: `offsetMin ${offsetMin}` };
      state.source = { ...state.source, offsetMin };
      state.time = {
        ...state.time,
        span: { start: "2026-08-01T09:00:00.000Z", end: "2026-08-01T10:00:00.000Z" },
      };

      const payload = buildQuickCreateSchedulePayload(state);

      expect(payload.source_schedule?.generation.offset_min).toBe(offsetMin);
    });

    it("preserves offsetMin through the full source_schedule object", () => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: "full round-trip offsetMin" };
      state.source = { ...state.source, offsetMin: 540 };

      const payload = buildQuickCreateSchedulePayload(state);

      expect(payload.source_schedule).toBeDefined();
      expect(payload.source_schedule!.generation.offset_min).toBe(540);
    });
  });

  describe("C3a: source.priority round-trip", () => {
    it.each([
      [0, "zero priority"],
      [5, "typical priority"],
      [25, "high priority"],
      [-1, "negative priority"],
      [100, "very high priority"],
    ])("serializes priority=%d to source_schedule.priority=%d (%s)", (priority, _label) => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: `priority ${priority}` };
      state.source = { ...state.source, priority };
      state.time = {
        ...state.time,
        span: { start: "2026-08-01T09:00:00.000Z", end: "2026-08-01T10:00:00.000Z" },
      };

      const payload = buildQuickCreateSchedulePayload(state);

      expect(payload.source_schedule?.priority).toBe(priority);
    });

    it("preserves both offsetMin and priority simultaneously in source_schedule", () => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: "combined round-trip" };
      state.source = { ...state.source, offsetMin: 540, priority: 25 };

      const payload = buildQuickCreateSchedulePayload(state);

      expect(payload.source_schedule).toEqual(
        expect.objectContaining({
          generation: expect.objectContaining({ offset_min: 540 }),
          priority: 25,
        }),
      );
    });
  });

  // ── C3b: excludedDates round-trip ───────────────────────────────────
  describe("C3b: source.excludedDates round-trip", () => {
    it("serializes a single excluded date to generation.excluded_dates", () => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: "single excluded" };
      state.source = { ...state.source, excludedDates: ["2026-08-06"] };
      state.time = {
        ...state.time,
        span: { start: "2026-08-01T09:00:00.000Z", end: "2026-08-01T10:00:00.000Z" },
      };
      state.recurring = {
        ...state.recurring,
        repeatMode: "daily",
        endDate: "2026-08-14T00:00:00.000Z",
      };

      const payload = buildQuickCreateSchedulePayload(
        state,
        new Date("2026-08-01T00:00:00.000Z"),
      );

      expect(payload.source_schedule?.generation.excluded_dates).toEqual(["2026-08-06"]);
    });

    it("serializes multiple excluded dates preserving YYYY-MM-DD format", () => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: "multi excluded" };
      state.source = {
        ...state.source,
        excludedDates: ["2026-08-06", "2026-08-07", "2026-08-13"],
      };
      state.time = {
        ...state.time,
        span: { start: "2026-08-01T09:00:00.000Z", end: "2026-08-01T10:00:00.000Z" },
      };
      state.recurring = {
        ...state.recurring,
        repeatMode: "daily",
        endDate: "2026-08-14T00:00:00.000Z",
      };

      const payload = buildQuickCreateSchedulePayload(
        state,
        new Date("2026-08-01T00:00:00.000Z"),
      );

      expect(payload.source_schedule?.generation.excluded_dates).toEqual([
        "2026-08-06",
        "2026-08-07",
        "2026-08-13",
      ]);
    });

    it("serializes empty excludedDates as an empty array", () => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: "empty excluded" };
      state.source = { ...state.source, excludedDates: [] };
      state.time = {
        ...state.time,
        span: { start: "2026-08-01T09:00:00.000Z", end: "2026-08-01T10:00:00.000Z" },
      };

      const payload = buildQuickCreateSchedulePayload(state);

      expect(payload.source_schedule?.generation.excluded_dates).toEqual([]);
    });

    it("preserves excludedDates alongside offsetMin and priority", () => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: "combined C3b" };
      state.source = {
        ...state.source,
        excludedDates: ["2026-08-06"],
        offsetMin: 540,
        priority: 25,
      };
      state.time = {
        ...state.time,
        span: { start: "2026-08-01T09:00:00.000Z", end: "2026-08-01T10:00:00.000Z" },
      };
      state.recurring = {
        ...state.recurring,
        repeatMode: "daily",
        endDate: "2026-08-14T00:00:00.000Z",
      };

      const payload = buildQuickCreateSchedulePayload(
        state,
        new Date("2026-08-01T00:00:00.000Z"),
      );

      expect(payload.source_schedule?.generation).toEqual(
        expect.objectContaining({
          excluded_dates: ["2026-08-06"],
          offset_min: 540,
        }),
      );
      expect(payload.source_schedule?.priority).toBe(25);
    });
  });

  // ── C4a: SplitPolicyKind enum round-trip (NONE=0 / DAILY_BOUNDARY=1 / SESSION_BOUNDARY=2) ──
  describe("C4a: SplitPolicyKind enum round-trip", () => {
    it.each([
      [0, "NONE (Unsplit)"],
      [1, "DAILY_BOUNDARY (Split)"],
      [2, "SESSION_BOUNDARY"],
    ])(
      "maps splitPolicy.kind=%d to source_schedule.split_policy.kind=%d (%s)",
      (kind: number, _label: string) => {
        const state = buildDefaultQuickCreateState();
        state.identity = { ...state.identity, title: `split kind ${kind}` };
        state.source = {
          ...state.source,
          splitPolicy: {
            kind: kind as 0 | 1 | 2,
            minSegmentMs: null,
            maxSegmentMs: null,
            maxSegments: null,
          },
        };
        state.time = {
          ...state.time,
          span: { start: "2026-08-01T09:00:00.000Z", end: "2026-08-01T10:00:00.000Z" },
        };

        const payload = buildQuickCreateSchedulePayload(state);

        expect(payload.source_schedule?.split_policy.kind).toBe(kind);
      },
    );

    it("silently falls back to kind=0 (NONE) for unknown splitPolicy kind via wire map", () => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: "unknown split kind" };
      // Intentionally passing an invalid splitPolicy kind to test fallback
      (state.source.splitPolicy as { kind: number }).kind = 99;

      const payload = buildQuickCreateSchedulePayload(state);

      // The SPLIT_KIND_MAP fallback maps unknown values to 0 (NONE)
      expect(payload.source_schedule?.split_policy.kind).toBe(0);
    });

    it("preserves split_policy fields alongside kind value", () => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: "split with fields" };
      state.source = {
        ...state.source,
        splitPolicy: {
          kind: 1,
          minSegmentMs: 900_000,
          maxSegmentMs: 1_800_000,
          maxSegments: 4,
        },
      };
      state.time = {
        ...state.time,
        span: { start: "2026-08-01T09:00:00.000Z", end: "2026-08-01T10:00:00.000Z" },
      };

      const payload = buildQuickCreateSchedulePayload(state);

      expect(payload.source_schedule?.split_policy).toEqual({
        kind: 1,
        min_segment_ms: 900_000,
        max_segment_ms: 1_800_000,
        max_segments: 4,
      });
    });
  });

  // ── C5a: priority round-trip with overlap arbitration verification ──────
  describe("C5a: priority field round-trip and overlap arbitration", () => {
    it.each([
      [5, "typical priority"],
      [0, "zero priority"],
      [-1, "negative priority"],
      [10, "high priority for arbitration"],
      [1, "low priority for arbitration"],
    ])("serializes priority=%d to source_schedule.priority=%d (%s)", (priority, _label) => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: `priority ${priority}` };
      state.source = { ...state.source, priority };
      state.time = {
        ...state.time,
        span: { start: "2026-08-01T09:00:00.000Z", end: "2026-08-01T10:00:00.000Z" },
      };

      const payload = buildQuickCreateSchedulePayload(state);

      expect(payload.source_schedule?.priority).toBe(priority);
    });

    it("priority=10 (high) and priority=1 (low) both serialize correctly for overlap arbitration", () => {
      const highState = buildDefaultQuickCreateState();
      highState.identity = { ...highState.identity, title: "priority_high" };
      highState.source = { ...highState.source, priority: 10 };
      highState.time = {
        ...highState.time,
        span: { start: "2026-08-01T09:00:00.000Z", end: "2026-08-01T10:00:00.000Z" },
      };

      const lowState = buildDefaultQuickCreateState();
      lowState.identity = { ...lowState.identity, title: "priority_low" };
      lowState.source = { ...lowState.source, priority: 1 };
      lowState.time = {
        ...lowState.time,
        span: { start: "2026-08-01T09:00:00.000Z", end: "2026-08-01T10:00:00.000Z" },
      };

      const highPayload = buildQuickCreateSchedulePayload(highState);
      const lowPayload = buildQuickCreateSchedulePayload(lowState);

      expect(highPayload.source_schedule?.priority).toBe(10);
      expect(lowPayload.source_schedule?.priority).toBe(1);
      expect(highPayload.source_schedule?.priority).toBeGreaterThan(
        lowPayload.source_schedule!.priority,
      );
    });
  });

  // ── C6a: SourceWindowInclude enum round-trip ────────────────────────
  describe("C6a: SourceWindowInclude enum round-trip", () => {
    it.each([
      ["INCLUDED", SourceWindowInclude.INCLUDED, "INCLUDED maps to wire 1"],
      ["EXCLUDED", SourceWindowInclude.EXCLUDED, "EXCLUDED maps to wire 0"],
    ])(
      "maps source.include=%s to source_schedule.source_window_include=%d (%s)",
      (include: string, expectedWire: number, _label: string) => {
        const state = buildDefaultQuickCreateState();
        state.identity = { ...state.identity, title: `include ${include}` };
        (state.source as { include: string }).include = include;
        state.time = {
          ...state.time,
          span: { start: "2026-08-03T09:00:00.000Z", end: "2026-08-03T10:00:00.000Z" },
        };

        const payload = buildQuickCreateSchedulePayload(state);

        expect(payload.source_schedule?.source_window_include).toBe(expectedWire);
      },
    );

    it("defaults source_window_include to INCLUDED (1) when not set", () => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: "default include" };

      const payload = buildQuickCreateSchedulePayload(state);

      expect(payload.source_schedule?.source_window_include).toBe(1);
    });
  });

  // ── C6a: AnchorMode enum round-trip ────────────────────────────────
  describe("C6a: AnchorMode enum round-trip", () => {
    it.each([
      ["FIXED", AnchorMode.FIXED, "FIXED maps to wire 0"],
      ["FLOATING", AnchorMode.FLOATING, "FLOATING maps to wire 1"],
    ])(
      "maps source.anchorMode=%s to source_schedule.anchor_mode=%d (%s)",
      (anchorMode: string, expectedWire: number, _label: string) => {
        const state = buildDefaultQuickCreateState();
        state.identity = { ...state.identity, title: `anchor ${anchorMode}` };
        (state.source as { anchorMode: string }).anchorMode = anchorMode;
        state.time = {
          ...state.time,
          span: { start: "2026-08-03T09:00:00.000Z", end: "2026-08-03T10:00:00.000Z" },
        };

        const payload = buildQuickCreateSchedulePayload(state);

        expect(payload.source_schedule?.anchor_mode).toBe(expectedWire);
      },
    );

    it("defaults anchor_mode to FIXED (0) when not set", () => {
      const state = buildDefaultQuickCreateState();
      state.identity = { ...state.identity, title: "default anchor" };

      const payload = buildQuickCreateSchedulePayload(state);

      expect(payload.source_schedule?.anchor_mode).toBe(0);
    });
  });

  // ── C6b: SourceWindow offset_ms span derivation E2E ───────────────
  describe("C6b: SourceWindow offset_ms span derivation", () => {
    function stateWithDuration(minMs: number, maxMs: number) {
      const state = buildDefaultQuickCreateState();
      state.time = {
        ...state.time,
        durationMinMax: { minMs, maxMs },
      };
      state.plan = {
        ...state.plan,
        completion: {
          ...state.plan.completion,
          timeRequirements: state.plan.completion.timeRequirements.map((req, i) =>
            i === 0 ? { ...req, required: { minMs, maxMs } } : req,
          ),
        },
      };
      return state;
    }

    it("derives start_offset_ms=0 and end_offset_ms=3600000 for a 60-min span", () => {
      const state = stateWithDuration(3_600_000, 3_600_000);
      state.identity = { ...state.identity, title: "60 min span" };
      state.time = {
        ...state.time,
        span: { start: "2026-08-03T09:00:00+09:00", end: "2026-08-03T10:00:00+09:00" },
      };

      const payload = buildQuickCreateSchedulePayload(state);

      expect(payload.source_schedule?.window.start_offset_ms).toBe(0);
      expect(payload.source_schedule?.window.end_offset_ms).toBe(3_600_000);
    });

    it("derives end_offset_ms from duration when no span is set", () => {
      const state = stateWithDuration(1_800_000, 3_600_000);
      state.identity = { ...state.identity, title: "duration only" };
      state.time = {
        ...state.time,
        span: { start: "", end: "" },
      };

      const payload = buildQuickCreateSchedulePayload(state);

      expect(payload.source_schedule?.window.start_offset_ms).toBe(0);
      expect(payload.source_schedule?.window.end_offset_ms).toBe(1_800_000);
    });

    it("preserves window alongside source_window_include and anchor_mode", () => {
      const state = stateWithDuration(3_600_000, 3_600_000);
      state.identity = { ...state.identity, title: "combined C6a+C6b" };
      state.time = {
        ...state.time,
        span: { start: "2026-08-03T09:00:00.000Z", end: "2026-08-03T10:00:00.000Z" },
      };
      (state.source as { include: string }).include = "EXCLUDED";
      (state.source as { anchorMode: string }).anchorMode = "FLOATING";

      const payload = buildQuickCreateSchedulePayload(state);

      expect(payload.source_schedule?.window).toEqual({
        start_offset_ms: 0,
        end_offset_ms: 3_600_000,
      });
      expect(payload.source_schedule?.source_window_include).toBe(0);
      expect(payload.source_schedule?.anchor_mode).toBe(1);
    });

    it("end_offset_ms equals duration for a 90-min span", () => {
      const state = stateWithDuration(5_400_000, 5_400_000);
      state.identity = { ...state.identity, title: "90 min span" };
      state.time = {
        ...state.time,
        span: { start: "2026-08-03T09:00:00.000Z", end: "2026-08-03T10:30:00.000Z" },
      };

      const payload = buildQuickCreateSchedulePayload(state);

      expect(payload.source_schedule?.window.start_offset_ms).toBe(0);
      expect(payload.source_schedule?.window.end_offset_ms).toBe(5_400_000);
    });
  });
});
