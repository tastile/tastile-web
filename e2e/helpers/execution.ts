// v1 Execution helpers shared across e2e specs.  Executions are
// started from a Placement and carry state transitions (ACTIVE / PAUSED
// / FINISHED_NORMAL / FINISHED_VOID).  Numeric constants for state and
// segment kinds live in `tastile-domain::execution`.

import { type APIRequestContext, expect } from "@playwright/test";
import { v1AuthHeaders } from "./v1";

interface V1CommandResp { aggregate?: { id: string }; }

export interface V1ExecutionView {
  id: string;
  placement_id?: string;
  state?: number;
  segments?: Array<{ kind: number; start_at: string; end_at: string | null }>;
}

/** POST /v1/placements/{placementId}/executions.  Starts a new execution. */
export async function v1StartExecution(
  client: { request: APIRequestContext },
  placementId: string,
  ownerId?: string,
): Promise<string> {
  const qs = ownerId ? `?owner_id=${encodeURIComponent(ownerId)}` : "";
  const res = await client.request.post(
    `/api/proxy/v1/placements/${placementId}/executions${qs}`,
    {
      headers: v1AuthHeaders(),
      data: {
        idempotency_key: crypto.randomUUID(),
        expected_revision: null,
        payload: { placement_id: placementId },
      },
    },
  );
  expect(res.status(), "POST /v1/placements/{id}/executions").toBeLessThan(400);
  const body = (await res.json()) as V1CommandResp;
  const id = body.aggregate?.id;
  if (!id) throw new Error("start_execution response missing aggregate.id");
  return id;
}

/** POST /v1/executions/{id}/pause. */
export async function v1PauseExecution(
  client: { request: APIRequestContext },
  executionId: string,
): Promise<V1CommandResp> {
  const res = await client.request.post(`/api/proxy/v1/executions/${executionId}/pause`, {
    headers: v1AuthHeaders(),
    data: {
      idempotency_key: crypto.randomUUID(),
      expected_revision: null,
    },
  });
  expect(res.status(), "POST /v1/executions/{id}/pause").toBeLessThan(400);
  return (await res.json()) as V1CommandResp;
}

/** POST /v1/executions/{id}/resume. */
export async function v1ResumeExecution(
  client: { request: APIRequestContext },
  executionId: string,
): Promise<V1CommandResp> {
  const res = await client.request.post(`/api/proxy/v1/executions/${executionId}/resume`, {
    headers: v1AuthHeaders(),
    data: {
      idempotency_key: crypto.randomUUID(),
      expected_revision: null,
    },
  });
  expect(res.status(), "POST /v1/executions/{id}/resume").toBeLessThan(400);
  return (await res.json()) as V1CommandResp;
}

/**
 * POST /v1/executions/{id}/finish.
 * kind: 0 = NORMAL, 1 = VOID.
 */
export async function v1FinishExecution(
  client: { request: APIRequestContext },
  executionId: string,
  kind: number = 0,
  note?: string,
): Promise<V1CommandResp> {
  const res = await client.request.post(`/api/proxy/v1/executions/${executionId}/finish`, {
    headers: v1AuthHeaders(),
    data: {
      idempotency_key: crypto.randomUUID(),
      expected_revision: null,
      payload: { kind, note: note ?? null },
    },
  });
  expect(res.status(), "POST /v1/executions/{id}/finish").toBeLessThan(400);
  return (await res.json()) as V1CommandResp;
}

/** GET /v1/executions/{id}.  Returns the full execution view with segments. */
export async function v1ReadExecutionSegments(
  client: { request: APIRequestContext },
  executionId: string,
): Promise<V1ExecutionView> {
  const res = await client.request.get(`/api/proxy/v1/executions/${executionId}`);
  expect(res.status(), `GET /v1/executions/${executionId}`).toBeLessThan(400);
  return (await res.json()) as V1ExecutionView;
}
