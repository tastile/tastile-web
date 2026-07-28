import * as z from "zod";
import { getCoreClient, type Result } from "@/lib/api/endpoints";

/**
 * Active-tile snapshot returned by `GET /v1/active-tile`.
 *
 * The v1 endpoint returns the placement the engine is currently
 * executing (the "main tile"). It carries the v1 IDs needed to
 * drive pause / resume / finish on the matching execution.
 */
export interface V1ActiveTileSnapshot {
  tile_id: string;
  placement_id: string;
  execution_id: string | null;
  title: string;
  span_start: string;
  span_end: string;
}

/**
 * Wire schema for the active-tile response. The default `$strip`
 * config keeps unknown fields out of the parsed object so future
 * server additions cannot break the client.
 */
export const v1ActiveTileSchema: z.ZodType<V1ActiveTileSnapshot> = z.object({
  tile_id: z.uuid(),
  placement_id: z.uuid(),
  execution_id: z.union([z.uuid(), z.null()]),
  title: z.string(),
  span_start: z.iso.datetime(),
  span_end: z.iso.datetime(),
});

/**
 * Stable, public-safe failure returned when the upstream payload
 * fails validation. The raw payload is intentionally discarded so
 * `body` cannot leak upstream details into the React tree.
 */
function invalidActiveTileResponse(): Result<V1ActiveTileSnapshot | null> {
  return {
    ok: false,
    error: {
      kind: "server",
      status: 502,
      message: "Invalid active-tile response",
      body: null,
    },
  };
}

/**
 * Fetch the current active-tile snapshot.
 *
 * - Passes transport / API errors from `CoreClient` through unchanged.
 * - Treats `null` / `undefined` bodies as "no active tile".
 * - Converts a malformed-but-200 response into a controlled 502
 *   server failure with a stable generic message.
 */
export async function fetchV1ActiveTile(): Promise<Result<V1ActiveTileSnapshot | null>> {
  const res = await getCoreClient().call<unknown>("getActiveTile");
  if (!res.ok) return res;
  if (res.data == null) {
    return { ...res, data: null };
  }
  const parsed = v1ActiveTileSchema.safeParse(res.data);
  if (!parsed.success) {
    return invalidActiveTileResponse();
  }
  return { ...res, data: parsed.data };
}
