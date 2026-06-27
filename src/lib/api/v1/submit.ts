/**
 * submitCreateTile — v1 API submit for QuickTileCreate.
 *
 * Bridges the existing v7-shaped form state to the v1 envelope sequence
 * produced by `buildCreateTileCommand`, then POSTs each envelope via
 * `postCommand`. The result is propagated back to the UI as
 * `{ ok: true, tileId }` or `{ ok: false, error }`.
 *
 * Lives at the seam between QuickTileCreate (still on v7 form state) and
 * the v1 API client. Phase D will replace this with a direct read from
 * `useQuickCreateStore`.
 *
 * Pure aside from the network calls — no React, no state mutation.
 */

import {
  ConditionKind,
  PlanRole,
  RecurringState,
  TileKind,
} from "@/lib/domain/v1/constants";
import {
  postCommand,
  type Result,
  type ApiClient,
} from "./endpoints";
import { uuidv7, type ApiError } from "@/lib/domain/v1/envelope";

/**
 * Dev / E2E bypass token. Returned by `getIdToken` when
 * `NEXT_PUBLIC_E2E_BYPASS_AUTH=1` so the v1 client doesn't fail with
 * FORBIDDEN_NO_TOKEN during local development. The v1 daemon must be
 * configured to accept this token (out of scope for this module).
 */
const E2E_DEV_TOKEN = "e2e-bypass-token";
import {
  buildCreateTileCommand,
  substituteTileId,
  type BuiltEnvelope,
  type QuickCreateSnapshot,
} from "./build-command";
import { getIdTokenClient } from "@/lib/daemon/id-token-client";
import {
  parseDateTimeParts,
  parseDurationToMinutes,
  type QuickCreateFormState,
} from "@/components/tiles/build-command";

export type SubmitV1Success = { ok: true; tileId: string };
export type SubmitV1Failure = { ok: false; error: ApiError };
export type SubmitV1Result = SubmitV1Success | SubmitV1Failure;

export interface SubmitV1Options {
  client: ApiClient;
  formState: QuickCreateFormState;
  /** Numeric effective duration in minutes; `null` for label-only / recurring. */
  effectiveDurationMin: number | null;
}

/**
 * Construct an ApiClient for the web app.
 *
 * Honors `NEXT_PUBLIC_E2E_BYPASS_AUTH=1` for local development: when set,
 * `getIdToken` returns the dev token instead of calling Cognito. The v1
 * daemon must be configured to accept the token (out of scope here).
 */
export function makeClient(): ApiClient {
  const e2eBypass = process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === "1";
  return {
    baseUrl: process.env.NEXT_PUBLIC_DAEMON_BASE_URL ?? "",
    getIdToken: async () => {
      if (e2eBypass) return E2E_DEV_TOKEN;
      return getIdTokenClient();
    },
  };
}

/**
 * Build the v1 snapshot from the v7 form state.
 *
 * The form keeps v7-shaped inputs (useStartAt + startDateInput/...) for
 * backward compatibility with the rest of QuickTileCreate. This adapter
 * is the single point that translates those inputs into the v1 snapshot
 * shape consumed by `buildCreateTileCommand`.
 */
function formStateToSnapshot(
  formState: QuickCreateFormState,
  effectiveDurationMin: number | null,
): QuickCreateSnapshot {
  const isRecurring = formState.objectiveMode === "recurring";
  const kind = isRecurring ? TileKind.RECURRING : TileKind.PLACEMENT;

  const startDate =
    formState.useStartAt && !isRecurring
      ? parseDateTimeParts(formState.startDateInput, formState.startTimeInput)
      : null;
  const endDate =
    formState.useEndAt && !isRecurring
      ? parseDateTimeParts(formState.endDateInput, formState.endTimeInput)
      : null;

  const role = formState.isLabelOnly ? PlanRole.LABEL : PlanRole.EXECUTABLE;

  // v1 `time.span.end` is `string | null` — `null` means open-ended.
  // We emit ISO; offsetMin is left at 0 (UI does not yet collect it).
  const spanStart = startDate ? startDate.toISOString() : "";
  const spanEnd = endDate ? endDate.toISOString() : null;

  // `durationMinMax` is parsed from the work inputs so the server can
  // validate the chosen duration even if `effectiveDurationMin` is null
  // (e.g. label-only).
  const durationMin = parseDurationToMinutes(
    formState.workHoursInput,
    formState.workMinutesInput,
  );

  // Plan.completion.root — a placeholder ALL node. Editors replace this
  // in Phase D. Today the server accepts the empty-all shape because the
  // v1 plan schema treats `children: []` as a leaf-only condition set.
  const completionRoot = {
    kind: ConditionKind.ALL,
    children: [],
    term: null,
  };

  const recurringLife = {
    state: RecurringState.ACTIVE,
    activeStart: isRecurring && formState.recurrenceValidFromEnabled
      ? parseDateTimeParts(
          formState.recurrenceValidFromDateInput,
          "00:00",
        )?.toISOString() ?? null
      : null,
    activeEnd: isRecurring && formState.recurrenceValidToEnabled
      ? parseDateTimeParts(
          formState.recurrenceValidToDateInput,
          "23:59",
        )?.toISOString() ?? null
      : null,
  };

  return {
    identity: {
      title: formState.title.trim(),
      kind,
      externalId: { value: null },
      visual: { color: "", icon: "" },
    },
    plan: {
      role,
      references: [],
      completion: {
        root: completionRoot,
        timeRequirements: [],
        tasks: [],
      },
      planning: {
        placementRules: [],
        nestingRules: [],
        flows: [],
      },
      metrics: [],
    },
    time: {
      span: { start: spanStart, end: spanEnd, offsetMin: 0 },
      durationMinMax: {
        min: durationMin,
        max: durationMin ?? effectiveDurationMin,
      },
    },
    windows: [],
    recurring: {
      life: recurringLife,
      // Frame and rule sequences are out of scope for the v1-first
      // submit cut — the server creates the recurring aggregate with an
      // empty frame/rule set and the UI layers rules on follow-up.
      frameRules: [],
      recurringRules: [],
    },
    advanced: { changeSets: [], rules: [] },
    meta: {
      project: formState.resolvedProject.trim() || null,
      tags: [...formState.selectedTags],
      memo: formState.memoInput.trim(),
      isLabelOnly: formState.isLabelOnly,
    },
  };
}

/**
 * Submit a new tile to the v1 API.
 *
 * 1. Convert form state → v1 snapshot.
 * 2. Build the envelope sequence (CREATE_TILE, SET_PLAN, optionally
 *    APPEND_FRAMES + APPEND_RULES).
 * 3. POST CREATE_TILE; on success, substitute the returned tileId into
 *    the remaining envelopes and POST each in order.
 * 4. Abort the sequence on the first failure; the resulting ApiError is
 *    surfaced for structured error rendering (8-way ApiErrorKind).
 */
export async function submitCreateTile(
  options: SubmitV1Options,
): Promise<SubmitV1Result> {
  const { client, formState, effectiveDurationMin } = options;
  const snapshot = formStateToSnapshot(formState, effectiveDurationMin);
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
  const remaining: BuiltEnvelope<unknown>[] = substituteTileId(
    envelopes.slice(1),
    tileId,
  );

  for (const envelope of remaining) {
    const step = await postCommand(client, envelope.path, envelope.request);
    if (!step.ok) {
      return { ok: false, error: step.error };
    }
  }

  return { ok: true, tileId };
}

/** Re-export `Result` so consumers don't need a second import. */
export type { Result };