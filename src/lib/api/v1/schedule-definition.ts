import { type ApiClient, getRead, type Result, sendCommand } from "@/lib/api/v1/endpoints";
import { type CommandRequest, nowIso, uuidv7 } from "@/lib/domain/v1/envelope";

export const ScheduleReferenceUsage = {
  LABEL_SPAN: 1,
  PARENT_SPAN: 2,
  GAP_ANCHOR: 3,
} as const;
export type ScheduleReferenceUsageCode =
  (typeof ScheduleReferenceUsage)[keyof typeof ScheduleReferenceUsage];

export const WindowKind = {
  CALENDAR: 0,
  LABEL_SPAN: 1,
  PARENT_SPAN: 2,
  GAP: 3,
} as const;
export type WindowKindCode = (typeof WindowKind)[keyof typeof WindowKind];

export type Condition =
  | { All: Condition[] }
  | { Any: Condition[] }
  | { Not: Condition }
  | { Term: Record<string, unknown> };

export interface TimeRequirement {
  id: string;
  observation: {
    scope: number;
    source: number;
    aggregate: number;
    quantifier: number | null;
    reference: string | null;
  };
  required: { min: number | null; max: number | null };
  preferred: { min: number | null; max: number | null } | null;
}

/** Rust `RequirementState` uses serde's externally tagged enum strings. */
export type RequirementState = "Met" | "Unmet" | "Any";

export interface WindowRule {
  id: string;
  weekday_mask: number | null;
  time_start_min: number | null;
  time_end_min: number | null;
  holiday_kind: number;
  date_range: { start: string; end: string } | null;
  offset_min: number;
  label_placement: string | null;
  parent_placement: string | null;
  gap_left_condition_id: string | null;
  gap_right_condition_id: string | null;
  gap_size: { min: number | null; max: number | null } | null;
}

export interface PublishScheduleDefinitionPayload {
  tile: {
    title: string;
    description: string | null;
    color: string | null;
    icon: string | null;
    external_id: string | null;
  };
  plan: {
    role: number;
    references: Array<{
      id: string;
      target: number;
      pick: { kind: number; at: null };
      when: Condition | null;
    }>;
    completion: {
      root: Condition;
      time_requirements: TimeRequirement[];
      tasks: unknown[];
    };
    planning: { placement_rules: unknown[]; nesting_rules: unknown[] };
    metrics: unknown[];
    decisions: unknown[];
  };
  reference_targets: Array<{
    source_reference_id: string;
    target: { Placement: string } | { Plan: string } | { Execution: string };
  }>;
  windows: Array<{
    kind: WindowKindCode;
    bounds: { start: string; end: string };
    rules: WindowRule[];
  }>;
  recurrence: unknown | null;
  flows: Array<{
    observes: string[];
    when: Condition | null;
    candidates: Array<{
      when: Condition;
      rank: number;
      outputs: Array<{ ProposeNewPlanPlacement: { span: { start: string; end: string } } }>;
    }>;
  }>;
}

export interface PublishScheduleDefinitionOptions {
  client: ApiClient;
  payload: PublishScheduleDefinitionPayload;
}

export interface PublishScheduleDefinitionResult {
  ok: true;
  tileId: string;
  planId: string;
  windowsIds: string[];
  flowIds: string[];
}
export type PublishScheduleDefinitionFailure = {
  ok: false;
  error: import("@/lib/domain/v1/envelope").ApiError;
};

function envelope<T>(payload: T): CommandRequest<T> {
  return {
    expectedRevision: null,
    idempotencyKey: uuidv7(),
    occurredAt: nowIso(),
    payload,
  };
}

export async function publishScheduleDefinition(
  options: PublishScheduleDefinitionOptions,
): Promise<PublishScheduleDefinitionResult | PublishScheduleDefinitionFailure> {
  if (!options.payload.tile.title.trim()) {
    return {
      ok: false,
      error: { kind: 0, message: "title is required", currentRevision: null, violations: [] },
    };
  }
  const res = await sendCommand(
    options.client,
    "POST",
    "/v1/schedule-definitions",
    envelope(options.payload),
  );
  if (!res.ok) return { ok: false, error: res.error };
  const meta = res.data.aggregateMeta;
  const tileId = res.data.aggregate?.id;
  const planId = meta?.planId ?? null;
  if (!tileId || !planId) {
    return {
      ok: false,
      error: {
        kind: 7,
        message: "publish response missing tile/plan aggregate ids",
        currentRevision: null,
        violations: [],
      },
    };
  }
  return {
    ok: true,
    tileId,
    planId,
    windowsIds: meta?.windowIds ?? [],
    flowIds: meta?.flowIds ?? [],
  };
}

export interface ReferenceCatalogItem {
  placement_id: string;
  tile_id: string;
  plan_id: string;
  title: string;
  span_start: string;
  span_end: string;
  role: number;
}

export function listReferenceCatalog(
  client: ApiClient,
  _ownerSubjectId: string,
  usage: ScheduleReferenceUsageCode,
): Promise<Result<ReferenceCatalogItem[]>> {
  return getRead<ReferenceCatalogItem[]>(client, `/v1/schedule-reference-catalog?usage=${usage}`);
}
