/**
 * buildCreateTileCommand — pure builder for the tile-creation envelope
 * sequence.
 *
 * The submit flow (Task 5) calls this with the current snapshot, then
 * posts the resulting envelopes to `tastile-core` v1 in order. Each
 * envelope carries the same idempotencyKey so the server can collapse
 * retries.
 *
 * Revision ladder for RECURRING:
 *   0  → CREATE_TILE  (no expected revision; aggregate is created)
 *
 * CREATE_TILE also seeds the initial plan in tastile-core v1. Follow-up
 * plan/frame/rule editing is handled by dedicated edit flows once those
 * commands are wired end-to-end.
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
