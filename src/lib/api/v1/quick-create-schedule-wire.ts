import { uuidv7 } from "@/lib/domain/v1/envelope";
import type { QuickCreateState } from "@/lib/stores/quick-create-store";
import { tasksForSubmission } from "@/lib/stores/quick-create-store";
import { toWireSetPlanBody } from "./plan-wire";
import type { PublishScheduleDefinitionPayload, WindowRule } from "./schedule-definition";

type QuickCreateScheduleState = Pick<
  QuickCreateState,
  "identity" | "plan" | "time" | "windows" | "recurring" | "advanced" | "meta"
>;

const DAY_MS = 86_400_000;
const DEFAULT_INTERVAL_MS = 30 * 60_000;

function validInstant(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return new Date(`${value}T00:00:00`).toISOString();
  }
  return Number.isNaN(Date.parse(value)) ? null : new Date(value).toISOString();
}

function datePart(value: string | null | undefined): string | null {
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

function sourceGeneration(state: QuickCreateScheduleState) {
  const start =
    authoredInstant(state, "start") ?? validInstant(state.recurring.life.active.startDate);
  const end =
    validInstant(state.recurring.endDate) ?? validInstant(state.recurring.life.active.endDate);
  const common = {
    weekday_mask: state.recurring.repeatMode === "weekly" ? state.recurring.weekdayMask : null,
    date_range_start: datePart(state.recurring.life.active.startDate),
    date_range_end: datePart(end),
    excluded_dates: [] as string[],
    offset_min: null,
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

  return {
    kind: 1 as const,
    starts_at: start ?? new Date().toISOString(),
    // Weekly authoring is a daily expansion filtered by weekday_mask. A
    // seven-day step would only ever visit the weekday of starts_at.
    interval_ms: state.recurring.repeatMode === "interval" ? DEFAULT_INTERVAL_MS : DAY_MS,
    ends_at: end,
    ...common,
  };
}

function sourceWindow(state: QuickCreateScheduleState, duration: number) {
  const start = authoredInstant(state, "start");
  const end = authoredInstant(state, "end");
  const spanMs = start && end ? Date.parse(end) - Date.parse(start) : duration;
  return { start_offset_ms: 0, end_offset_ms: Math.max(duration, spanMs) };
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

export function buildQuickCreateSchedulePayload(
  state: QuickCreateScheduleState,
  now = new Date(),
): PublishScheduleDefinitionPayload {
  if (state.meta.project || state.meta.tags.length > 0) {
    throw new Error("projects and tags are not supported by atomic schedule publish");
  }
  if (state.identity.description && state.meta.memo.trim()) {
    throw new Error("description and memo cannot both be represented by atomic schedule publish");
  }
  if (state.advanced.changeSets.length > 0 || state.advanced.rules.length > 0) {
    throw new Error("advanced change rules are not supported by atomic schedule publish");
  }
  if (
    state.recurring.frameRules.length > 0 ||
    state.recurring.rules.length > 0 ||
    state.plan.planning.flows.length > 0
  ) {
    throw new Error(
      "legacy recurring and flow rules are not supported by SourceScheduleDefinition",
    );
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
  const plan = toWireSetPlanBody({
    ...state.plan,
    completion: {
      ...state.plan.completion,
      root: completionRoot,
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

  return {
    source_client_local_id: uuidv7(),
    source_schedule: {
      required_duration_ms: duration,
      generation: sourceGeneration(state),
      window: sourceWindow(state, duration),
      split_policy: {
        kind: 0,
        min_segment_ms: null,
        max_segment_ms: null,
        max_segments: null,
      },
      priority: 0,
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
    windows: state.windows
      .filter(
        (window) =>
          validInstant(window.bounds.start) !== null &&
          validInstant(window.bounds.end) !== null &&
          Date.parse(window.bounds.start) < Date.parse(window.bounds.end),
      )
      .map((window) => ({
        kind: window.kind as 0 | 1 | 2 | 3,
        bounds: window.bounds,
        rules: window.rules.map((rule) => windowRule(rule, window)),
      })),
    recurrence: null,
    flows: [],
    relations: [],
  };
}
