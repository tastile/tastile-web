import type { QuickCreateState } from "@/shared/stores/quick-create-store";
import { tasksForSubmission } from "@/shared/stores/quick-create-store";
import { uuidv7 } from "@/tile/model/v1/envelope";
import type { FrameRule } from "@/tile/model/v1/tile";
import { convertCondition, toWireSetPlanBody } from "./plan-wire";
import {
  type AnchorModeCode,
  type Condition,
  type PublishScheduleDefinitionPayload,
  type SourceWindowIncludeCode,
  type WindowRule,
} from "./schedule-definition";

type QuickCreateScheduleState = Pick<
  QuickCreateState,
  "identity" | "plan" | "time" | "windows" | "source" | "recurring" | "advanced" | "meta"
>;

const DAY_MS = 86_400_000;
const DEFAULT_INTERVAL_MS = 30 * 60_000;

const MIN_MS = 60_000;
const HOUR_MS = 60 * MIN_MS;

const SPLIT_KIND_MAP: Record<number, number> = { 0: 0, 1: 1, 2: 2 } as const;

const INCLUDE_MAP: Record<string, SourceWindowIncludeCode> = {
  INCLUDED: 1,
  EXCLUDED: 0,
} as const;

const ANCHOR_MAP: Record<string, AnchorModeCode> = {
  FIXED: 0,
  FLOATING: 1,
} as const;

function intervalAuthoredMs(value: number, unit: "min" | "hour" | "day"): number {
  if (!Number.isFinite(value) || value <= 0) return DEFAULT_INTERVAL_MS;
  if (unit === "min") return value * MIN_MS;
  if (unit === "hour") return value * HOUR_MS;
  return value * DAY_MS;
}

function normalizeWeekdayMask(mask: number): number {
  // core v1/05: bit0=Mon ... bit6=Sun.  Accept and re-emit as-is,
  // but clamp to 7 bits so bit8+ noise never leaks into the wire.
  return mask & 0b1111111;
}

export function validInstant(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`).toISOString();
  }
  return Number.isNaN(Date.parse(value)) ? null : new Date(value).toISOString();
}

export function datePart(value: string | null | undefined): string | null {
  if (value && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return validInstant(value)?.slice(0, 10) ?? null;
}

function minuteOfDay(value: string | null): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

function authoredInstant(
  state: QuickCreateScheduleState,
  boundary: "start" | "end",
): string | null {
  const raw = state.time.span[boundary];
  if (!raw) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return validInstant(raw);
  const time =
    state.time.timeOfDayMode === "range"
      ? boundary === "start"
        ? state.time.timeOfDayStart || "00:00"
        : state.time.timeOfDayEnd || "23:59"
      : boundary === "start"
        ? "00:00"
        : "23:59";
  const local = new Date(`${raw}T${time}:00`);
  return Number.isNaN(local.getTime()) ? null : local.toISOString();
}

function requiredDuration(state: QuickCreateScheduleState): number {
  const minimum = state.time.durationMinMax.minMs;
  if (minimum !== null && minimum > 0) return minimum;
  const requirement = state.plan.completion.timeRequirements.find(
    (item) => item.required.minMs !== null && item.required.minMs > 0,
  );
  return requirement?.required.minMs ?? 60_000;
}

function sourceGeneration(state: QuickCreateScheduleState, now: Date) {
  const start =
    authoredInstant(state, "start") ?? validInstant(state.recurring.life.active.startDate);
  const end =
    validInstant(state.recurring.endDate) ?? validInstant(state.recurring.life.active.endDate);
  const common = {
    weekday_mask:
      state.recurring.repeatMode === "weekly"
        ? normalizeWeekdayMask(state.recurring.weekdayMask)
        : null,
    date_range_start: datePart(state.recurring.life.active.startDate),
    date_range_end: datePart(end),
    excluded_dates: state.source.excludedDates,
    offset_min: state.source.offsetMin,
  };

  if (
    state.recurring.repeatMode === "condition" ||
    (!start && state.recurring.repeatMode === "once")
  ) {
    return { kind: 2 as const, ...common };
  }
  if (state.recurring.repeatMode === "once") {
    return { kind: 0 as const, at: start, ...common };
  }
  if (state.recurring.repeatMode === "weekly") {
    return {
      kind: 1 as const,
      starts_at: start ?? now.toISOString(),
      // Weekly authoring honors the user-authored interval (per
      // C-recurring-source.md 変更手順 step 3: "Round-trip 30 min →
      // 1800000 ms"). The weekday_mask filter happens server-side in
      // SourceGenerationKind::Recurring expansion (v1/02).
      interval_ms: intervalAuthoredMs(
        state.recurring.intervalValue,
        state.recurring.intervalUnit,
      ),
      ends_at: end,
      ...common,
    };
  }
  if (state.recurring.repeatMode === "monthly") {
    // monthly has no first-class domain support in SourceGenerationKind
    // (valid: 0 OneTime / 1 Recurring / 2 DemandDriven per v1/02). Map
    // monthly to Recurring with DAY_MS so the wire stays valid; the
    // server will expand daily and the date_range_* bounds cap the run.
    // A future CalendarGenerator unit=monthly wire is the proper fix.
    return {
      kind: 1 as const,
      starts_at: start ?? now.toISOString(),
      interval_ms: DAY_MS,
      ends_at: end,
      ...common,
    };
  }

  return {
    kind: 1 as const,
    starts_at: start ?? now.toISOString(),
    interval_ms:
      state.recurring.repeatMode === "interval"
        ? intervalAuthoredMs(state.recurring.intervalValue, state.recurring.intervalUnit)
        : DAY_MS,
    ends_at: end,
    ...common,
  };
}

function sourceWindow(state: QuickCreateScheduleState, duration: number) {
  return { start_offset_ms: 0, end_offset_ms: duration };
}

function windowRule(
  rule: QuickCreateScheduleState["windows"][number]["rules"][number],
  window: QuickCreateScheduleState["windows"][number],
): WindowRule {
  return {
    id: rule.id,
    weekday_mask: rule.weekdayMask,
    time_start_min: minuteOfDay(rule.timeStart),
    time_end_min: minuteOfDay(rule.timeEnd),
    holiday_kind: rule.holidayKind ?? 2,
    date_range: rule.dateRange
      ? { start: rule.dateRange.startDate, end: rule.dateRange.endDate }
      : null,
    offset_min: 0,
    label_placement: window.kind === 1 ? window.referenceId : null,
    parent_placement: window.kind === 2 ? window.referenceId : null,
    gap_left_condition_id: null,
    gap_right_condition_id: null,
    gap_size: null,
  };
}

function publishWindows(
  state: QuickCreateScheduleState,
): PublishScheduleDefinitionPayload["windows"] {
  return state.windows.flatMap((window, index) => {
    if (!window.bounds.start || !window.bounds.end) {
      throw new Error(`window ${index + 1} requires both bounds`);
    }
    const start = validInstant(window.bounds.start);
    const end = validInstant(window.bounds.end);
    if (!start || !end) {
      throw new Error(`window ${index + 1} bounds must be valid RFC3339 timestamps`);
    }
    if (Date.parse(start) >= Date.parse(end)) {
      throw new Error(`window ${index + 1} start must be before end`);
    }
    if ((window.kind === 1 || window.kind === 2) && !window.referenceId) {
      throw new Error(`window ${index + 1} requires a concrete placement reference`);
    }
    if (window.kind === 0 && window.referenceId) {
      throw new Error(`calendar window ${index + 1} cannot have a placement reference`);
    }
    if (window.kind === 3) {
      throw new Error(`gap window ${index + 1} requires authored anchor conditions`);
    }
    for (const rule of window.rules) {
      if (rule.timeStart && minuteOfDay(rule.timeStart) === null) {
        throw new Error(`window ${index + 1} has an invalid start time`);
      }
      if (rule.timeEnd && minuteOfDay(rule.timeEnd) === null) {
        throw new Error(`window ${index + 1} has an invalid end time`);
      }
      if (
        rule.dateRange &&
        (!rule.dateRange.startDate ||
          !rule.dateRange.endDate ||
          rule.dateRange.startDate > rule.dateRange.endDate)
      ) {
        throw new Error(`window ${index + 1} has an invalid date range`);
      }
    }
    return [
      {
        kind: window.kind as 0 | 1 | 2 | 3,
        bounds: { start, end },
        rules: window.rules.map((rule) => windowRule(rule, window)),
      },
    ];
  });
}

function minimumGapCondition(
  minimumGapMs: number,
): PublishScheduleDefinitionPayload["flows"][number]["candidates"][number]["when"] {
  const always = { All: [] };
  const anchor = { when: always, pick: { kind: 0, at: null } };
  const size = { min: Math.max(0, minimumGapMs), max: Number.MAX_SAFE_INTEGER };
  return {
    Term: {
      Gap: {
        scope: {
          kind: 2,
          parent: null,
          gap: { left: anchor, right: anchor, size },
        },
        left_anchor: anchor,
        right_anchor: anchor,
        size,
      },
    },
  };
}

function mapFrameRule(rule: FrameRule): PublishScheduleDefinitionPayload["frame_rules"][number] {
  const active = rule.active ? (convertCondition(rule.active) as Condition) : null;
  const gen = rule.generator;
  let generator: PublishScheduleDefinitionPayload["frame_rules"][number]["generator"];
  switch (gen.kind) {
    case "step":
      generator = { Step: { step: gen.value.step, origin: gen.value.origin, bounds: gen.value.bounds } };
      break;
    case "reference":
      generator = { Reference: { reference_id: gen.value.referenceId, align: gen.value.align } };
      break;
    case "calendar":
      generator = {
        Calendar: { unit: gen.value.unit, weekday_mask: gen.value.weekdayMask, holiday_kind: gen.value.holidayKind },
      };
      break;
    case "transform":
      generator = {
        Transform: { source_frame_id: gen.value.sourceFrameId, shift: gen.value.shift, scale: gen.value.scale },
      };
      break;
  }
  return { id: rule.id, active, rank: 0, generator };
}

export function buildQuickCreateSchedulePayload(
  state: QuickCreateScheduleState,
  now = new Date(),
): PublishScheduleDefinitionPayload {
  for (const [index, relation] of state.source.relations.entries()) {
    if (!relation.referencedSourceTileId) {
      throw new Error(`relation ${index + 1} requires a referenced Source`);
    }
    if (relation.splitPolicy.requiredTotalDurationMs <= 0) {
      throw new Error(`relation ${index + 1} requires a positive total duration`);
    }
    if (
      relation.splitPolicy.kind === "split" &&
      ((relation.splitPolicy.minSegmentMs ?? 0) <= 0 ||
        (relation.splitPolicy.maxSegmentMs ?? 0) < (relation.splitPolicy.minSegmentMs ?? 0))
    ) {
      throw new Error(`relation ${index + 1} has an invalid split range`);
    }
  }
  for (const [index, flow] of state.source.flowSequences.entries()) {
    if (flow.observes.length === 0) {
      throw new Error(`flow ${index + 1} requires at least one observed event`);
    }
    if (flow.steps.length === 0 || flow.steps.some((step) => step.emitDurationMs <= 0)) {
      throw new Error(`flow ${index + 1} requires positive sequence steps`);
    }
  }
  if (state.identity.description && state.meta.memo.trim()) {
    throw new Error("description and memo cannot both be represented by atomic schedule publish");
  }
  // ChangeSet / advanced rules: not yet wired to create-path.
  // Silently ignore — edit-path handles these via separate commands.
  if (state.advanced.changeSets.length > 0 || state.advanced.rules.length > 0) {
    console.warn("[D2a] advanced change rules silently dropped in create path");
  }
  // Legacy rules / planning.flows: not wired to create-path.
  // Source flow sequences (state.source.flowSequences) are the canonical
  // create-path flows and are handled separately below.
  // frameRules ARE wired (D1a) and mapped into frame_rules below.
  if (state.recurring.rules.length > 0 || state.plan.planning.flows.length > 0) {
    console.warn("[D2a] legacy rules/planning flows silently dropped in create path");
  }
  const durationIsPreserved = state.plan.completion.timeRequirements.some(
    (requirement) =>
      requirement.required.minMs === state.time.durationMinMax.minMs &&
      requirement.required.maxMs === state.time.durationMinMax.maxMs,
  );
  if (
    (state.time.durationMinMax.minMs !== null || state.time.durationMinMax.maxMs !== null) &&
    !durationIsPreserved
  ) {
    throw new Error("duration range must be represented by a completion time requirement");
  }
  const submittedTasks = tasksForSubmission(state.plan.completion.tasks);
  const completionRoot =
    state.plan.completion.root.children.length === 0 && submittedTasks.length > 0
      ? {
          ...state.plan.completion.root,
          children: submittedTasks.map((task) => task.complete),
        }
      : state.plan.completion.root;
  // E1a: recurring.condition is not yet wired to the schedule publish
  // payload. Silently drop it with a dev-visible warning so in-memory
  // state from hydration / devtools does not silently vanish.
  if (state.recurring.condition !== null) {
    console.warn("[Phase C/D reserved] recurring.condition ignored");
  }
  const planRoot = completionRoot;
  const plan = toWireSetPlanBody({
    ...state.plan,
    completion: {
      ...state.plan.completion,
      root: planRoot,
      timeRequirements: state.plan.completion.timeRequirements.map((requirement, index) =>
        index === 0
          ? {
              ...requirement,
              preferred:
                state.source.preferredDurationMinMax.minMs === null &&
                state.source.preferredDurationMinMax.maxMs === null
                  ? null
                  : state.source.preferredDurationMinMax,
            }
          : requirement,
      ),
      tasks: submittedTasks,
    },
  });
  const duration = requiredDuration(state);
  const authoredStart = authoredInstant(state, "start");
  const horizonStart = authoredStart ?? now.toISOString();
  const authoredHorizonEnd =
    validInstant(state.recurring.endDate) ??
    validInstant(state.recurring.life.active.endDate) ??
    authoredInstant(state, "end");
  const horizonEnd =
    authoredHorizonEnd && Date.parse(authoredHorizonEnd) > Date.parse(horizonStart)
      ? authoredHorizonEnd
      : new Date(Date.parse(horizonStart) + 90 * DAY_MS).toISOString();
  const referenceTargets = plan.references.flatMap((value, index) => {
    const wireReference = value as { id: string; target?: number };
    const storeReference = state.plan.references[index];
    if (
      wireReference.target !== 0 ||
      storeReference?.target.kind !== 0 ||
      !storeReference.target.referenceId
    ) {
      return [];
    }
    return [
      {
        source_reference_id: wireReference.id,
        target: { Plan: storeReference.target.referenceId },
      },
    ];
  });
  const sourceClientLocalId = uuidv7();

  return {
    source_client_local_id: sourceClientLocalId,
    source_schedule: {
      required_duration_ms: duration,
      generation: sourceGeneration(state, now),
      window: sourceWindow(state, duration),
      source_window_include: INCLUDE_MAP[state.source.include] ?? 1,
      anchor_mode: ANCHOR_MAP[state.source.anchorMode] ?? 0,
      split_policy: {
        kind: (SPLIT_KIND_MAP[state.source.splitPolicy.kind] ?? 0) as 0 | 1 | 2,
        min_segment_ms: state.source.splitPolicy.minSegmentMs,
        max_segment_ms: state.source.splitPolicy.maxSegmentMs,
        max_segments: state.source.splitPolicy.maxSegments,
      },
      priority: state.source.priority,
    },
    source_horizon: { start: horizonStart, end: horizonEnd },
    tile: {
      title: state.identity.title.trim(),
      description: state.identity.description ?? (state.meta.memo.trim() || null),
      color: state.identity.visual.color || null,
      icon: state.identity.visual.icon || null,
      external_id: state.identity.externalId,
    },
    plan: {
      role: plan.role,
      references: plan.references as PublishScheduleDefinitionPayload["plan"]["references"],
      completion: plan.completion as PublishScheduleDefinitionPayload["plan"]["completion"],
      planning: {
        placement_rules: plan.planning.placement_rules,
        nesting_rules: plan.planning.nesting_rules,
      },
      metrics: plan.metrics,
      decisions: plan.decisions,
    },
    reference_targets: referenceTargets,
    windows: publishWindows(state),
    frame_rules: state.recurring.frameRules.map(mapFrameRule),
    recurrence: null,
    flows: state.source.flowSequences.map((flow) => {
      const firstDuration = flow.steps[0]?.emitDurationMs ?? duration;
      const gapCondition = minimumGapCondition(flow.minimumGapMs);
      const candidateCondition = flow.candidateWhen
        ? ({
            All: [
              convertCondition(flow.candidateWhen),
              gapCondition,
            ] as PublishScheduleDefinitionPayload["flows"][number]["candidates"][number]["when"][],
          } as PublishScheduleDefinitionPayload["flows"][number]["candidates"][number]["when"])
        : gapCondition;
      return {
        observes: flow.observes,
        when: flow.when
          ? (convertCondition(
              flow.when,
            ) as PublishScheduleDefinitionPayload["flows"][number]["when"])
          : null,
        candidates: [
          {
            when: candidateCondition,
            rank: flow.rank,
            outputs: [
              {
                ProposeNewPlanPlacementSequence: {
                  proposal: {
                    span: {
                      start: horizonStart,
                      end: new Date(Date.parse(horizonStart) + firstDuration).toISOString(),
                    },
                  },
                  sequence_steps: flow.steps.map((step) => ({
                    wait_before_ms: step.waitBeforeMs,
                    emit_duration_ms: step.emitDurationMs,
                  })),
                },
              },
            ],
          },
        ],
      };
    }),
    relations: state.source.relations.map((relation) => {
      const referenced = {
        kind: "existing" as const,
        source_tile_id: relation.referencedSourceTileId,
      };
      const duration_expression =
        relation.durationKind === "fixed"
          ? { Fixed: { duration_ms: relation.fixedDurationMs ?? duration } }
          : relation.durationKind === "reference"
            ? { ReferenceSpan: { referenced_source_ref: referenced } }
            : ("SubjectSpan" as const);
      const split_policy =
        relation.splitPolicy.kind === "split"
          ? {
              Split: {
                required_total_duration_ms: relation.splitPolicy.requiredTotalDurationMs,
                min_segment_ms: relation.splitPolicy.minSegmentMs ?? duration,
                max_segment_ms: relation.splitPolicy.maxSegmentMs ?? duration,
              },
            }
          : {
              Unsplit: {
                required_total_duration_ms: relation.splitPolicy.requiredTotalDurationMs,
              },
            };
      return {
        client_local_id: relation.id,
        subject_source_ref: {
          kind: "local" as const,
          client_local_id: sourceClientLocalId,
        },
        referenced_source_ref: referenced,
        kind: relation.kind,
        point: relation.point,
        offset_ms: relation.offsetMs,
        ordering: relation.ordering,
        duration_expression,
        split_policy,
        correlation_scope: relation.correlationScope,
        lifecycle_filter: relation.lifecycleFilter,
        eligible_through_revision: relation.eligibleThroughRevision,
        summary_priority: relation.summaryPriority,
      };
    }),
  };
}
