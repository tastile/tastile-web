// v1 SourceTile helpers shared across e2e specs.  SourceTile is the
// authoring surface for occurrence generators (v1/08-recurring-and-frame.md).
// The wire payload uses the same ScheduleTileDefinition / SchedulePlanDefinition
// as v1 tile creation; the difference is the SourceScheduleDefinition +
// horizon + flows that drive occurrence generation.

import { type APIRequestContext, expect } from "@playwright/test";
import { v1AuthHeaders } from "./v1";

interface V1CommandResp { aggregate?: { id: string }; }

export interface V1SourceTileView {
  id: string;
  title?: string;
  source_state?: number;
  state_changed_at?: string;
}

export interface V1CreateSourceTileInput {
  title: string;
  description?: string | null;
  color?: string;
  icon?: string;
  /** Horizon as ISO pair.  Defaults to next 30 days. */
  horizonStart?: string;
  horizonEnd?: string;
  /** Source schedule kind.  0 = DAILY_STEP, 1 = WEEKLY_MASK, 2 = ONE_TIME, ... */
  scheduleKind?: number;
  /** Per-schedule params.  Shape depends on scheduleKind; pass an opaque object. */
  scheduleParams?: Record<string, unknown>;
  /** Optional step_ms for DAILY_STEP.  Convenience for the common pattern. */
  stepMs?: number;
}

/**
 * POST /v1/source-tiles.  Returns the source tile id.
 *
 * Schedule defaults to scheduleKind=0 (DAILY_STEP) with step_ms=stepMs
 * (default 24h).  Flows default to an empty list.  This matches the
 * minimal payload required by `at_initial_source_bundle` integration
 * tests.
 */
export async function v1CreateSourceTile(
  client: { request: APIRequestContext },
  input: V1CreateSourceTileInput,
): Promise<string> {
  const res = await client.request.post("/api/proxy/v1/source-tiles", {
    headers: v1AuthHeaders(),
    data: {
      idempotency_key: crypto.randomUUID(),
      expected_revision: null,
      payload: {
        source_client_local_id: null,
        tile: {
          title: input.title,
          description: input.description ?? null,
          color: input.color ?? "#3b82f6",
          icon: input.icon ?? "check-circle",
          external_id: null,
        },
        plan: {
          role: 0, // EXECUTABLE
          references: [],
          completion: { root: { kind: "AlwaysTrue" }, time_requirements: [], tasks: [] },
          planning: { placement_rules: [], nesting_rules: [] },
          metrics: [],
          decisions: [],
        },
        flows: [],
        relations: [],
        schedule: {
          kind: input.scheduleKind ?? 0,
          params: input.scheduleParams ?? {
            step_ms: input.stepMs ?? 86_400_000,
            anchor_start: input.horizonStart ?? new Date().toISOString(),
          },
        },
        horizon: {
          start: input.horizonStart ?? new Date().toISOString(),
          end: input.horizonEnd ?? new Date(Date.now() + 30 * 86_400_000).toISOString(),
        },
      },
    },
  });
  expect(res.status(), "POST /v1/source-tiles").toBeLessThan(400);
  const body = (await res.json()) as V1CommandResp;
  const id = body.aggregate?.id;
  if (!id) throw new Error("v1/source-tiles response missing aggregate.id");
  return id;
}

/** POST /v1/source-tiles/{id}/reflow.  Returns the reflow command response id. */
export async function v1ReflowSourceTile(
  client: { request: APIRequestContext },
  sourceTileId: string,
  rangeStart: string,
  rangeEnd: string,
): Promise<V1CommandResp> {
  const res = await client.request.post(`/api/proxy/v1/source-tiles/${sourceTileId}/reflow`, {
    headers: v1AuthHeaders(),
    data: {
      idempotency_key: crypto.randomUUID(),
      expected_revision: null,
      payload: { range: { start: rangeStart, end: rangeEnd } },
    },
  });
  expect(res.status(), "POST /v1/source-tiles/{id}/reflow").toBeLessThan(400);
  return (await res.json()) as V1CommandResp;
}

/**
 * POST /v1/source-tiles/{id}/cancel.
 * reason: 0 = USER, 1 = CLEANUP, 2 = MIGRATION.
 */
export async function v1CancelSourceTile(
  client: { request: APIRequestContext },
  sourceTileId: string,
  reason: number = 0,
): Promise<V1CommandResp> {
  const res = await client.request.post(`/api/proxy/v1/source-tiles/${sourceTileId}/cancel`, {
    headers: v1AuthHeaders(),
    data: {
      idempotency_key: crypto.randomUUID(),
      expected_revision: null,
      payload: { reason },
    },
  });
  expect(res.status(), "POST /v1/source-tiles/{id}/cancel").toBeLessThan(400);
  return (await res.json()) as V1CommandResp;
}

/** GET /v1/source-tiles/{id}.  Returns the current source-tile view including source_state. */
export async function v1GetSourceLifecycle(
  client: { request: APIRequestContext },
  sourceTileId: string,
  ownerId?: string,
): Promise<V1SourceTileView> {
  const qs = ownerId ? `?owner_id=${encodeURIComponent(ownerId)}` : "";
  const res = await client.request.get(`/api/proxy/v1/source-tiles/${sourceTileId}${qs}`);
  expect(res.status(), `GET /v1/source-tiles/${sourceTileId}`).toBeLessThan(400);
  return (await res.json()) as V1SourceTileView;
}

/** GET /v1/source-tiles?owner_id=<oid>.  Returns the list of source tiles. */
export async function v1ListSourceTiles(
  client: { request: APIRequestContext },
  ownerId?: string,
): Promise<V1SourceTileView[]> {
  const qs = ownerId ? `?owner_id=${encodeURIComponent(ownerId)}` : "";
  const res = await client.request.get(`/api/proxy/v1/source-tiles${qs}`);
  expect(res.status(), "GET /v1/source-tiles").toBeLessThan(400);
  return (await res.json()) as V1SourceTileView[];
}
