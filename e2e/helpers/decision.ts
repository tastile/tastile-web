// v1 Decision / Session / Delivery / Feedback helpers shared across e2e
// specs.  Decisions are individual judgment prompts (v1/06); Sessions
// bundle multiple DecisionRuns + an InteractionTree for one round-trip
// submission.  FeedbackTxn applies answers and may produce Delivery
// rows.

import { type APIRequestContext, expect } from "@playwright/test";
import { v1AuthHeaders } from "./v1";

interface V1CommandResp { aggregate?: { id: string }; }

export interface V1DecisionView {
  id: string;
  session_id?: string | null;
  state?: number;
  prompt?: { kind?: number; plan_id?: string };
}

export interface V1CreateDecisionInput {
  planId: string;
  /** DecisionKind: 0 = HARD_AVOID, 1 = SOFT_AVOID, 2 = PREFER, ... */
  kind: number;
  /** Condition AST root (object form, opaque to the helper). */
  root: unknown;
  /** Optional human-readable reason. */
  reason?: string;
}

/**
 * POST /v1/decisions.  Creates a single decision; usually followed by
 * a Session submission.  Returns the decision id.
 */
export async function v1CreateDecision(
  client: { request: APIRequestContext },
  input: V1CreateDecisionInput,
): Promise<string> {
  const res = await client.request.post("/api/proxy/v1/decisions", {
    headers: v1AuthHeaders(),
    data: {
      idempotency_key: crypto.randomUUID(),
      expected_revision: null,
      payload: {
        decision: {
          plan_id: input.planId,
          kind: input.kind,
          root: input.root,
          reason: input.reason ?? null,
        },
      },
    },
  });
  expect(res.status(), "POST /v1/decisions").toBeLessThan(400);
  const body = (await res.json()) as V1CommandResp;
  const id = body.aggregate?.id;
  if (!id) throw new Error("v1/decisions response missing aggregate.id");
  return id;
}

/** GET /v1/decisions?owner_id=<oid>.  Returns open decisions for the owner. */
export async function v1ListOpenDecisions(
  client: { request: APIRequestContext },
  ownerId?: string,
): Promise<V1DecisionView[]> {
  const qs = ownerId ? `?owner_id=${encodeURIComponent(ownerId)}` : "";
  const res = await client.request.get(`/api/proxy/v1/decisions${qs}`);
  expect(res.status(), "GET /v1/decisions").toBeLessThan(400);
  return (await res.json()) as V1DecisionView[];
}

export interface V1CreateSessionInput {
  /** DecisionRun payloads; each becomes a session answer. */
  decisions: Array<{
    decision_id: string;
    /** Answer: 0 = ACCEPT, 1 = DECLINE, 2 = DEFINE. */
    answer: number;
    rationale?: string;
  }>;
  /** InteractionTree root, opaque to the helper. */
  tree: unknown;
}

/**
 * POST /v1/sessions.  Bundles multiple decisions + a tree for one
 * round-trip submission.  Returns the session id.
 */
export async function v1CreateSession(
  client: { request: APIRequestContext },
  input: V1CreateSessionInput,
): Promise<string> {
  const res = await client.request.post("/api/proxy/v1/sessions", {
    headers: v1AuthHeaders(),
    data: {
      idempotency_key: crypto.randomUUID(),
      expected_revision: null,
      payload: {
        session_id: null,
        decisions: input.decisions,
        tree: input.tree,
      },
    },
  });
  expect(res.status(), "POST /v1/sessions").toBeLessThan(400);
  const body = (await res.json()) as V1CommandResp;
  const id = body.aggregate?.id;
  if (!id) throw new Error("v1/sessions response missing aggregate.id");
  return id;
}

export interface V1SubmitFeedbackInput {
  sessionId: string;
  /** base_revision for optimistic concurrency. */
  baseRevision: number;
  /** FeedbackKind: 0 = APPLY, 1 = REVOKE. */
  kind: number;
  /** Optional prior FeedbackTxn id when revoking/re-applying. */
  targetTxnId?: string | null;
  /** Feedback changes to apply (opaque AST). */
  changes: unknown[];
  /** Preferred answers payload (preferred public surface). */
  answers: Array<{ decision_id: string; answer: number; rationale?: string }>;
}

/**
 * POST /v1/sessions/{sessionId}/feedback.  Submits a FeedbackTxn that
 * resolves the Session.  Returns the txn id.
 */
export async function v1SubmitFeedback(
  client: { request: APIRequestContext },
  input: V1SubmitFeedbackInput,
): Promise<string> {
  const res = await client.request.post(
    `/api/proxy/v1/sessions/${input.sessionId}/feedback`,
    {
      headers: v1AuthHeaders(),
      data: {
        idempotency_key: crypto.randomUUID(),
        expected_revision: null,
        payload: {
          session_id: input.sessionId,
          base_revision: input.baseRevision,
          kind: input.kind,
          target_txn_id: input.targetTxnId ?? null,
          changes: input.changes,
          answers: input.answers,
        },
      },
    },
  );
  expect(res.status(), "POST /v1/sessions/{id}/feedback").toBeLessThan(400);
  const body = (await res.json()) as V1CommandResp;
  const id = body.aggregate?.id;
  if (!id) throw new Error("v1/sessions/{id}/feedback response missing aggregate.id");
  return id;
}

/** GET /v1/sessions/{id}.  Returns the session view. */
export async function v1ReadSession(
  client: { request: APIRequestContext },
  sessionId: string,
): Promise<{ id: string; state?: number; decisions?: Array<{ decision_id: string; answer: number }> }> {
  const res = await client.request.get(`/api/proxy/v1/sessions/${sessionId}`);
  expect(res.status(), `GET /v1/sessions/${sessionId}`).toBeLessThan(400);
  return (await res.json()) as { id: string; state?: number; decisions?: Array<{ decision_id: string; answer: number }> };
}
