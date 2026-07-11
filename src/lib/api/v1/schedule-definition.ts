/**
 * v1 schedule-definition adapter — wraps `POST /v1/schedule-definitions` and
 * the reference catalog (`GET /v1/reference-catalog?usage=N`).
 *
 * The publish command atomically creates Tile + Plan + Window + Flow (and
 * reference bindings) without materializing a Placement baseline.  This is
 * the canonical write path for compositional scheduling; legacy
 * `createManualPlacementCommand` must NOT be used for flexible tasks.
 *
 * Numeric constants mirror v1 domain `PublishScheduleDefinitionPayload`:
 *   - `Plan.role`: 0=EXECUTABLE / 1=LABEL
 *   - `Reference.usage`: 1=LABEL_SPAN / 2=PARENT_SPAN / 3=GAP_ANCHOR
 *   - `Window.kind`: 0=CALENDAR / 1=LABEL_SPAN / 2=PARENT_SPAN / 3=GAP
 *   - `Flow.candidate.target_kind`: see AggregateKind (0=RECURRING /
 *     1=PLACEMENT / 2=EXECUTION / 3=SESSION)
 *
 * Plan §6 Phase 3 boundary: this adapter is a thin wire wrapper.  Domain
 * validation lives in tastile-core.  The editor projection is a separate
 * read model (Phase 2) and is not produced here.
 */

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

export interface ScheduleTileDraft {
  title: string;
  description?: string | null;
  color?: string | null;
  icon?: string | null;
  external_id?: string | null;
  /** numeric PlanRole (0=EXECUTABLE / 1=LABEL).  Server mirrors this on the
   * auto-created `v1_plan` row. */
  plan_role: number;
  tags?: string[];
  memo?: string | null;
}

export interface SchedulePlanDraft {
  /** Optional completion root condition id (UUIDv7) — resolved server-side
   * from the corresponding `v1_plan_completion` row. */
  completion_root_id?: string | null;
  /** Numeric references (e.g. [AGGREGATE:PLACEMENT_UUID]). */
  references?: Array<{ aggregate_kind: number; aggregate_id: string }>;
}

export interface ScheduleWindowDraft {
  kind: WindowKindCode;
  /** Bounds the server interprets according to `kind`:
   *  - CALENDAR: { date_start, date_end, weekday_mask, time_start, time_end }
   *  - LABEL_SPAN: { reference_id }
   *  - PARENT_SPAN: { reference_id }
   *  - GAP: { anchor_id, min_gap_minutes } */
  bounds: Record<string, unknown>;
}

export interface ScheduleFlowDraft {
  /** Numeric AggregateKind of the placement the flow proposes. */
  target_kind: number;
  /** Optional reference to a Plan this flow operates on. */
  plan_id?: string | null;
  /** Optional condition that must hold before the flow proposes. */
  when_condition_id?: string | null;
}

export interface ScheduleReferenceTargetBinding {
  /** Client-side reference id; the server maps it to the corresponding
   * `v1_plan_references` row. */
  source_reference_id: string;
  /** Concrete target (Placement / Tile / Plan UUID). */
  target_aggregate_kind: number;
  target_aggregate_id: string;
}

export interface PublishScheduleDefinitionPayload {
  tile: ScheduleTileDraft;
  plan: SchedulePlanDraft;
  reference_targets: ScheduleReferenceTargetBinding[];
  windows: ScheduleWindowDraft[];
  recurrence?: {
    generator_kind: number;
    step_ms?: number | null;
    bounds?: Record<string, unknown> | null;
    when_condition_id?: string | null;
  } | null;
  flows: ScheduleFlowDraft[];
}

export interface PublishScheduleDefinitionOptions {
  client: ApiClient;
  payload: PublishScheduleDefinitionPayload;
  /** Optional override when calling without a JWT (server-side fallback).
   *  Defaults to the standard envelope. */
  ownerId?: string;
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

/**
 * Publish a complete schedule definition atomically.  Returns the canonical
 * aggregate ids assigned by the server.  The server may reject with
 * ApiErrorKind.VALIDATION if any window reference is missing, a reference
 * target is closed, or a nesting cycle is detected.
 */
export async function publishScheduleDefinition(
  options: PublishScheduleDefinitionOptions,
): Promise<PublishScheduleDefinitionResult | PublishScheduleDefinitionFailure> {
  const title = options.payload.tile.title.trim();
  if (!title) {
    return {
      ok: false,
      error: {
        kind: 0,
        message: "title is required",
        currentRevision: null,
        violations: [],
      },
    };
  }
  const res: Result<import("@/lib/domain/v1/envelope").CommandResponse> = await sendCommand(
    options.client,
    "POST",
    "/v1/schedule-definitions",
    envelope(options.payload),
  );
  if (!res.ok) return { ok: false, error: res.error };
  const meta = res.data.aggregateMeta;
  const tileId = res.data.aggregate?.id;
  const planId = meta?.planId ?? null;
  const windowsIds = meta?.windowIds ?? [];
  const flowIds = meta?.flowIds ?? [];
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
  return { ok: true, tileId, planId, windowsIds, flowIds };
}

/**
 * Fetch the reference catalog for a given usage selector.  The server-side
 * filter narrows the result to placements the caller can legally bind.
 *
 * - `LABEL_SPAN`  → LABEL-role active placements
 * - `PARENT_SPAN` → every active placement regardless of role
 * - `GAP_ANCHOR`  → every active placement regardless of role
 */
export interface ReferenceCatalogItem {
  placement_id: string;
  tile_id: string;
  plan_id: string;
  title: string;
  span_start: string;
  span_end: string;
  role: number;
}

export async function listReferenceCatalog(
  client: ApiClient,
  ownerSubjectId: string,
  usage: ScheduleReferenceUsageCode,
): Promise<Result<ReferenceCatalogItem[]>> {
  const res = await getRead<unknown>(
    client,
    `/v1/reference-catalog?usage=${usage}&owner_id=${encodeURIComponent(ownerSubjectId)}`,
  );
  if (!res.ok) {
    // `getRead` rejects 2xx bodies that aren't a JSON object.  A catalog is
    // a JSON array, so when the server returns `null` / a scalar / a parse
    // error, treat it as "no candidates" instead of surfacing a RETRYABLE.
    if (res.error.message === "response body is not an object") {
      return { ok: true, data: [], status: 200 };
    }
    return res;
  }
  // Coerce object / null bodies to [] so callers don't have to defend
  // against server-side shape drift.
  const items = Array.isArray(res.data) ? (res.data as ReferenceCatalogItem[]) : [];
  return { ok: true, data: items, status: res.status };
}
