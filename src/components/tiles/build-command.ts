/**
 * buildCreateTileCommandV1 — pure builder for the tile-creation envelope
 * sequence.
 *
 * The submit flow (Task 5) calls this with the current snapshot, then
 * posts the resulting envelopes to `tastile-core` v1 in order. Each
 * envelope carries the same idempotencyKey so the server can collapse
 * retries.
 *
 * Revision ladder for RECURRING:
 *   0  → CREATE_TILE  (no expected revision; aggregate is created)
 *   1  → SET_PLAN
 *   2  → APPEND_FRAMES
 *   3  → APPEND_RULES
 *
 * For PLACEMENT only steps 0–1 are emitted.
 *
 * Pure: no React, no side effects, no network. The caller wires the result
 * to `postV1Command` and calls `substituteTileId` once the new tile id is
 * known.
 *
 * The legacy `buildCreateTileCommand` / `QuickCreateFormState` exports
 * have been removed per the v1 tile-creation UI plan. Consumers in
 * `QuickTileCreate.tsx` and `QuickTileRecurrenceSubPanel.tsx` will be
 * migrated to the v1 store + snapshot shape in Task 6 / Task 9.
 */

import { TileKind } from "@/lib/domain/v1/constants";
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

/**
 * v1 command endpoint paths. Local to this builder — `v1-endpoints.ts`
 * (the HTTP client) does not export a path table, and these strings
 * intentionally match the style already used by `v1-endpoints.test.ts`
 * (`/v1/tiles`, `/v1/tiles/{id}/…`).
 */
const V1_PATH = {
  createTile: "/v1/tiles",
  setPlan: (tileIdPath: string): string => `/v1/tiles/${tileIdPath}/plan`,
  appendFrames: (tileIdPath: string): string =>
    `/v1/recurrings/${tileIdPath}/frames`,
  appendRules: (tileIdPath: string): string =>
    `/v1/recurrings/${tileIdPath}/rules`,
} as const;

// ---------- builder ----------

export function buildCreateTileCommandV1(
  state: QuickCreateSnapshot,
  idempotencyKey: string,
  occurredAt: string = nowIso(),
): BuiltEnvelope<unknown>[] {
  const envelopes: BuiltEnvelope<unknown>[] = [];
  // `{tileId}` is a placeholder substituted by `substituteTileId` after
  // CREATE_TILE returns the new aggregate id.
  const tileIdPath = "{tileId}";

  // 1. CREATE_TILE — no expected revision; the server creates the aggregate.
  const createPayload = {
    kind: state.identity.kind,
    title: state.identity.title,
    visual: state.identity.visual,
    externalId: state.identity.externalId.value,
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

  // 2. SET_PLAN — revision becomes 1 after CREATE_TILE.
  const planPayload = {
    role: state.plan.role,
    references: state.plan.references,
    completion: state.plan.completion,
    planning: state.plan.planning,
    metrics: state.plan.metrics,
  };
  envelopes.push({
    path: V1_PATH.setPlan(tileIdPath),
    idempotencyKey,
    payload: planPayload,
    request: {
      expectedRevision: 1,
      idempotencyKey,
      occurredAt,
      payload: planPayload,
    },
  });

  // 3. RECURRING extras — frames and rules are emitted unconditionally so
  // the revision ladder is predictable even when the lists are empty.
  if (state.identity.kind === TileKind.RECURRING) {
    envelopes.push({
      path: V1_PATH.appendFrames(tileIdPath),
      idempotencyKey,
      payload: state.recurring.frameRules,
      request: {
        expectedRevision: 2,
        idempotencyKey,
        occurredAt,
        payload: state.recurring.frameRules,
      },
    });
    envelopes.push({
      path: V1_PATH.appendRules(tileIdPath),
      idempotencyKey,
      payload: state.recurring.recurringRules,
      request: {
        expectedRevision: 3,
        idempotencyKey,
        occurredAt,
        payload: state.recurring.recurringRules,
      },
    });
  }

  return envelopes;
}

// ---------- id substitution ----------

/**
 * Replace the `{tileId}` placeholder in every envelope's path with the
 * concrete tile id returned by CREATE_TILE. Returns a new array — the
 * input is not mutated.
 */
export function substituteTileId(
  envelopes: BuiltEnvelope<unknown>[],
  tileId: string,
): BuiltEnvelope<unknown>[] {
  return envelopes.map((e) => ({
    ...e,
    path: e.path.replace("{tileId}", tileId),
  }));
}