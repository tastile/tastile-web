import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import type { ApiError } from "@/tile/model/v1/envelope";
import type { ApiClient } from "./endpoints";
import { buildQuickCreateSchedulePayload } from "./quick-create-schedule-wire";
import { publishScheduleDefinition } from "./schedule-definition";
import { updatePlacementChanges, updateTileCommand } from "./tile-commands";

/**
 * Dev / E2E bypass token. Returned by `getIdToken` when
 * `NEXT_PUBLIC_E2E_BYPASS_AUTH=1` so the v1 client doesn't fail with
 * FORBIDDEN_NO_TOKEN during local development.
 */
const E2E_DEV_TOKEN = "e2e-bypass-token";

type SubmitSuccess = { ok: true; tileId: string };
type SubmitFailure = { ok: false; error: ApiError };
export type SubmitResult = SubmitSuccess | SubmitFailure;

export interface SubmitOptions {
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
    baseUrl: explicitCoreUrl ?? "/api/proxy",
    useProxyBridge,
    getIdToken: async () => (e2eBypass ? E2E_DEV_TOKEN : null),
  };
}

/**
 * Submit a new tile to the v1 API.
 *
 * The API either commits the complete authored definition or leaves no
 * partial Tile/Plan rows behind.
 */
export async function submitCreateTile(options: SubmitOptions): Promise<SubmitResult> {
  const result = await publishScheduleDefinition({
    client: options.client,
    payload: buildQuickCreateSchedulePayload(useQuickCreateStore.getState()),
  });
  return result.ok ? { ok: true, tileId: result.tileId } : result;
}

/**
 * Update an existing tile (edit mode).
 *
 * Phase A scope: updates tile identity (title / description / color / icon /
 * externalId / ownerSubjectId) and, when a placement id is available, also
 * reschedules the baseline span via POST /v1/placements/{id}/changes.
 *
 * plan.completion and other aggregate changes are Phase B scope and are not
 * persisted here.
 */
export async function submitUpdateTile(options: SubmitOptions): Promise<SubmitResult> {
  const state = useQuickCreateStore.getState();
  const tileId = state.editingTileId;
  const placementId = state.editingId;

  if (!tileId) {
    return {
      ok: false,
      error: {
        kind: 0,
        message: "No tile id in store — cannot update.",
        currentRevision: null,
        violations: [],
      },
    };
  }

  // 1. Update tile identity.
  const tileRes = await updateTileCommand({
    client: options.client,
    tileId,
    title: state.identity.title,
    description: state.identity.description,
    color: state.identity.visual.color,
    icon: state.identity.visual.icon,
    externalId: state.identity.externalId,
    ownerSubjectId: state.meta.ownerSubjectId,
  });

  if (!tileRes.ok) {
    return { ok: false, error: tileRes.error };
  }

  // 2. Update placement span when a placement id is present and a span exists.
  if (placementId && state.time.span.start && state.time.span.end) {
    const spanRes = await updatePlacementChanges({
      client: options.client,
      placementId,
      start: state.time.span.start,
      end: state.time.span.end,
    });
    if (!spanRes.ok) {
      return { ok: false, error: spanRes.error };
    }
  }

  return { ok: true, tileId };
}
