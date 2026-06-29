/**
 * buildCreateTileCommand / buildUpdateTileCommand — pure builders for the
 * tile-creation and tile-update envelope sequences.
 *
 * The submit flow (Task 5) calls these with the current snapshot, then
 * posts the resulting envelopes to `tastile-core` v1 in order. Each
 * envelope carries the same idempotencyKey so the server can collapse
 * retries.
 *
 * Revision ladder for RECURRING:
 *   0  → CREATE_TILE  (no expected revision; aggregate is created)
 *   N  → UPDATE_TILE  (expected revision N — server validates it)
 *
 * CREATE_TILE also seeds the initial plan in tastile-core v1. UPDATE_TILE
 * carries the FULL envelope (all 7 condition layers + meta + recurrence)
 * so QuickTileCreate can round-trip a recurring tile without losing the
 * recurrence model. Follow-up plan/frame/rule editing is handled by
 * dedicated edit flows once those commands are wired end-to-end.
 *
 * Pure: no React, no side effects, no network. The caller wires the result
 * to `postCommand` and calls `substituteTileId` once the new tile id is
 * known.
 *
 * The legacy `buildCreateTileCommand` / `QuickCreateFormState` exports
 * have been removed per the v1 tile-creation UI plan. Consumers in
 * `QuickTileCreate.tsx` and `QuickTileRecurrenceSubPanel.tsx` will be
 * migrated to the v1 store + snapshot shape in Task 6 / Task 9.
 */

import { nowIso, type CommandRequest } from "@/lib/domain/v1/envelope";
import type { RecurrenceModel } from "@/lib/domain/tile";

// ---------- input snapshot ----------

/**
 * Narrow input shape consumed by the builder. Distinct from the live
 * `QuickCreateState` store: the store keeps editor / open-close state
 * irrelevant to the command sequence, while this snapshot only carries
 * command-relevant fields. The store-to-snapshot adapter lives in the
 * submit flow (Task 5).
 */
export interface QuickCreateSnapshot {
  identity: {
    title: string;
    description: string | null;
    kind: number;
    externalId: { value: string | null };
    visual: { color: string; icon: string };
  };
  plan: {
    role: number;
    references: unknown[];
    completion: {
      root: { kind: number; children: unknown[] };
      timeRequirements: unknown[];
      tasks: unknown[];
    };
    planning: {
      placementRules: unknown[];
      nestingRules: unknown[];
      flows: unknown[];
    };
    metrics: unknown[];
  };
  time: {
    span: { start: string; end: string | null; offsetMin: number };
    durationMinMax: { min: number | null; max: number | null };
  };
  windows: unknown[];
  recurring: {
    life: { state: number; activeStart: string | null; activeEnd: string | null };
    frameRules: unknown[];
    recurringRules: unknown[];
  };
  advanced: { changeSets: unknown[]; rules: unknown[] };
  meta: {
    project: string | null;
    tags: string[];
    memo: string;
    isLabelOnly: boolean;
  };
  /**
   * Recurrence model — only populated for RECURRING tiles. CREATE_TILE
   * ignores this (the server creates the recurring aggregate without
   * an initial recurrence; UI layers rules on follow-up). UPDATE_TILE
   * includes it so QuickTileCreate can round-trip a recurring tile.
   *
   * `null` (or omitted) for placement / label tiles. Optional on the
   * input so legacy snapshot builders — and the test fixtures in
   * `build-command.test.ts` — that pre-date Task 1's recurrence field
   * keep typechecking without modification.
   */
  recurrence?: RecurrenceModel | null;
}

// ---------- output envelope ----------

export interface BuiltEnvelope<T> {
  path: string;
  idempotencyKey: string;
  request: CommandRequest<T>;
  /** Convenience accessor for `request.payload` (the wire-format payload). */
  payload: T;
}

// ---------- path constants ----------

const TILE_ID_PLACEHOLDER = "{tileId}";

/**
 * v1 command endpoint paths. Local to this builder — `endpoints.ts`
 * (the HTTP client) does not export a path table, and these strings
 * intentionally match the style already used by `endpoints.test.ts`
 * (`/v1/tiles`, `/v1/tiles/{id}/…`).
 */
const V1_PATH = {
  createTile: "/v1/tiles",
  updateTile: "/v1/tiles/{tileId}/update",
} as const;

// ---------- builder ----------

export function buildCreateTileCommand(
  state: QuickCreateSnapshot,
  idempotencyKey: string,
  occurredAt: string = nowIso(),
): BuiltEnvelope<unknown>[] {
  const envelopes: BuiltEnvelope<unknown>[] = [];

  // 1. CREATE_TILE — no expected revision; the server creates the aggregate.
  const createPayload = {
    kind: state.identity.kind,
    title: state.identity.title,
    description: state.identity.description,
    color: state.identity.visual.color || null,
    icon: state.identity.visual.icon || null,
    external_id: state.identity.externalId.value,
    plan_role: state.plan.role,
  };
  envelopes.push({
    path: V1_PATH.createTile,
    idempotencyKey,
    payload: createPayload,
    request: {
      expectedRevision: null,
      idempotencyKey,
      occurredAt,
      payload: createPayload,
    },
  });

  return envelopes;
}

/**
 * Build the UPDATE_TILE envelope carrying the FULL condition-vector
 * snapshot plus `recurrence`. Unlike `buildCreateTileCommand` (which only
 * emits the seed payload — kind/title/desc/color/icon/externalId/
 * plan_role), UPDATE_TILE must replace every layer atomically so the
 * server's recurring-tile engine sees a consistent revision.
 *
 * Returns a single-element envelope sequence; the caller POSTs the first
 * envelope via `postCommand` to `/v1/tiles/{tileId}/update`. The
 * `expectedRevision` is `null` because the server-side optimistic
 * concurrency check is governed by the per-aggregate revision returned
 * in CREATE responses, which QuickTileCreate does not yet track client
 * side. A future revision-tracking pass will thread the current
 * revision through `submitUpdateTile`.
 */
export function buildUpdateTileCommand(
  tileId: string,
  state: QuickCreateSnapshot,
  idempotencyKey: string,
  occurredAt: string = nowIso(),
): BuiltEnvelope<unknown>[] {
  const updatePayload = {
    tile_id: tileId,
    kind: state.identity.kind,
    title: state.identity.title,
    description: state.identity.description,
    color: state.identity.visual.color || null,
    icon: state.identity.visual.icon || null,
    external_id: state.identity.externalId.value,
    plan_role: state.plan.role,
    span: {
      start: state.time.span.start,
      end: state.time.span.end,
      offsetMin: state.time.span.offsetMin,
    },
    duration_min_max: {
      min: state.time.durationMinMax.min,
      max: state.time.durationMinMax.max,
    },
    windows: state.windows,
    life: {
      state: state.recurring.life.state,
      activeStart: state.recurring.life.activeStart,
      activeEnd: state.recurring.life.activeEnd,
    },
    frame_rules: state.recurring.frameRules,
    rules: state.recurring.recurringRules,
    recurrence: state.recurrence ?? null,
    project: state.meta.project,
    tags: state.meta.tags,
    memo: state.meta.memo,
    is_label_only: state.meta.isLabelOnly,
  };
  return [
    {
      path: V1_PATH.updateTile.replace(TILE_ID_PLACEHOLDER, tileId),
      idempotencyKey,
      payload: updatePayload,
      request: {
        expectedRevision: null,
        idempotencyKey,
        occurredAt,
        payload: updatePayload,
      },
    },
  ];
}

// ---------- id substitution ----------

/**
 * Replace the tile-id placeholder in every envelope's path with the
 * concrete tile id returned by CREATE_TILE. Returns a new array — the
 * input is not mutated.
 */
export function substituteTileId(
  envelopes: BuiltEnvelope<unknown>[],
  tileId: string,
): BuiltEnvelope<unknown>[] {
  return envelopes.map((e) => ({
    ...e,
    path: e.path.replace(TILE_ID_PLACEHOLDER, tileId),
  }));
}
