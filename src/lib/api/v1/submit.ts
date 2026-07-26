/**
 * submitCreateTile — v1 API submit for QuickTileCreate.
 *
 * Reads `useQuickCreateStore` directly (the single source of truth for the
 * 7-section v1 structured editor), converts the store state into the v1
 * envelope sequence via `buildCreateTileCommand`, then POSTs each
 * envelope through `postCommand`. No React, no v7-shaped intermediate
 * form state — only the v1 store + the v1 envelope contract.
 *
 * Revision ladder for RECURRING:
 *   0 → CREATE_TILE
 *   1 → SET_PLAN
 *   2 → APPEND_FRAMES
 *   3 → APPEND_RULES
 *
 * For PLACEMENT only steps 0–1 are emitted. EXECUTION is also a 2-step
 * ladder today; full EXECUTION editor lives outside Phase A scope.
 */

import { ConditionKind } from "@/lib/domain/v1/constants";
import { type ApiError, uuidv7 } from "@/lib/domain/v1/envelope";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import {
  type BuiltEnvelope,
  buildCreateTileCommand,
  type QuickCreateSnapshot,
  substituteTileId,
} from "./build-command";
import { type ApiClient, postCommand } from "./endpoints";

/**
 * Dev / E2E bypass token. Returned by `getIdToken` when
 * `NEXT_PUBLIC_E2E_BYPASS_AUTH=1` so the v1 client doesn't fail with
 * FORBIDDEN_NO_TOKEN during local development.
 */
const E2E_DEV_TOKEN = "e2e-bypass-token";

export type SubmitV1Success = { ok: true; tileId: string };
export type SubmitV1Failure = { ok: false; error: ApiError };
export type SubmitV1Result = SubmitV1Success | SubmitV1Failure;

export interface SubmitV1Options {
  client: ApiClient;
}

/**
 * Construct a ApiClient for the web app.
 *
 * Honors `NEXT_PUBLIC_E2E_BYPASS_AUTH=1` for local development: when set,
 * `getIdToken` returns the dev token instead of calling Cognito. The v1
 * daemon must be configured to accept the token (out of scope here).
 */
export function makeClient(): ApiClient {
  const e2eBypass = process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === "1";
  const explicitCoreUrl = process.env.NEXT_PUBLIC_TASTILE_CORE_V1_URL;
  const useProxyBridge = !explicitCoreUrl;
  return {
    baseUrl: explicitCoreUrl ?? "/api/proxy/v1",
    useProxyBridge,
    getIdToken: async () => (e2eBypass ? E2E_DEV_TOKEN : null),
  };
}

/**
 * Build the v1 snapshot from the live `useQuickCreateStore` state.
 *
 * Single point of translation between the editor and the wire format.
 * All defaults are explicit so a malformed slice cannot silently produce
 * a wrong payload.
 */
function storeToSnapshot(): QuickCreateSnapshot {
  const state = useQuickCreateStore.getState();

  // Plan.completion.root — placeholder ALL node. The Condition tree editor
  // (Phase B) replaces this with a real AST. Today the server accepts the
  // empty-all shape because the v1 plan schema treats `children: []` as a
  // leaf-only condition set.
  const completionRoot = {
    kind: ConditionKind.ALL,
    children: [],
    term: null,
  };

  return {
    identity: {
      title: state.identity.title.trim(),
      kind: state.identity.kind,
      externalId: { value: state.identity.externalId ?? null },
      visual: {
        color: state.identity.visual.color ?? "",
        icon: state.identity.visual.icon ?? "",
      },
    },
    plan: {
      role: state.plan.role,
      references: state.plan.references,
      completion: {
        root: completionRoot,
        timeRequirements: state.plan.completion.timeRequirements,
        tasks: state.plan.completion.tasks,
      },
      planning: state.plan.planning,
      metrics: state.plan.metrics,
    },
    time: {
      // The store keeps ISO strings; the builder expects start string,
      // end string | null. An empty `start` is preserved as "" — the
      // server treats "" + null end as "no temporal constraint".
      span: {
        start: state.time.span.start,
        end: state.time.span.end ? state.time.span.end : null,
        offsetMin: 0,
      },
      durationMinMax: {
        min: state.time.durationMinMax.minMs,
        max: state.time.durationMinMax.maxMs,
      },
    },
    windows: state.windows,
    recurring: {
      life: {
        state: state.recurring.life.state,
        activeStart: state.recurring.life.active.startDate
          ? state.recurring.life.active.startDate
          : null,
        activeEnd: state.recurring.life.active.endDate ? state.recurring.life.active.endDate : null,
      },
      frameRules: state.recurring.frameRules,
      recurringRules: state.recurring.rules,
    },
    advanced: {
      changeSets: state.advanced.changeSets,
      rules: state.advanced.rules,
    },
    meta: {
      project: state.meta.project,
      tags: [...state.meta.tags],
      memo: state.meta.memo.trim(),
      isLabelOnly: state.meta.isLabelOnly,
    },
  };
}

/**
 * Submit a new tile to the v1 API.
 *
 * 1. Read the v1 store directly.
 * 2. Build the envelope sequence (CREATE_TILE, SET_PLAN, optionally
 *    APPEND_FRAMES + APPEND_RULES).
 * 3. POST CREATE_TILE; on success, substitute the returned tileId into
 *    the remaining envelopes and POST each in order.
 * 4. Abort the sequence on the first failure; the resulting ApiError is
 *    surfaced for structured error rendering (8-way ApiErrorKind).
 */
export async function submitCreateTile(options: SubmitV1Options): Promise<SubmitV1Result> {
  const { client } = options;
  const snapshot = storeToSnapshot();

  const idempotencyKey = uuidv7();
  const envelopes = buildCreateTileCommand(snapshot, idempotencyKey);

  const first = envelopes[0];
  if (!first) {
    return {
      ok: false,
      error: {
        kind: 7, // RETRYABLE — empty envelope list is a client bug.
        message: "no envelopes to submit",
        currentRevision: null,
        violations: [],
      },
    };
  }

  const createResult = await postCommand(client, first.path, first.request);
  if (!createResult.ok) {
    return { ok: false, error: createResult.error };
  }

  const aggregate = createResult.data.aggregate;
  if (!aggregate) {
    return {
      ok: false,
      error: {
        kind: 7, // RETRYABLE — server must return aggregate on CREATE.
        message: "create response missing aggregate",
        currentRevision: null,
        violations: [],
      },
    };
  }

  const tileId = aggregate.id;
  const remaining: BuiltEnvelope<unknown>[] = substituteTileId(envelopes.slice(1), tileId);

  for (const envelope of remaining) {
    const step = await postCommand(client, envelope.path, envelope.request);
    if (!step.ok) {
      return { ok: false, error: step.error };
    }
  }

  return { ok: true, tileId };
}
