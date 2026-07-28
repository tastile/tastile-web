/**
 * submitCreateTile — v1 API submit for QuickTileCreate.
 *
 * Reads the QuickCreate store directly and publishes Tile, Plan,
 * SourceScheduleDefinition, Window and Flow definitions in one transaction.
 * The legacy multi-command revision ladder is deliberately not used.
 */

import type { ApiError } from "@/lib/domain/v1/envelope";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import type { ApiClient } from "./endpoints";
import { buildQuickCreateSchedulePayload } from "./quick-create-schedule-wire";
import { publishScheduleDefinition } from "./schedule-definition";

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
 * Submit a new tile to the v1 API.
 *
 * The API either commits the complete authored definition or leaves no
 * partial Tile/Plan rows behind.
 */
export async function submitCreateTile(options: SubmitV1Options): Promise<SubmitV1Result> {
  const result = await publishScheduleDefinition({
    client: options.client,
    payload: buildQuickCreateSchedulePayload(useQuickCreateStore.getState()),
  });
  return result.ok ? { ok: true, tileId: result.tileId } : result;
}
