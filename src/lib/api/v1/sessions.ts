/**
 * v1 session API — read endpoints and feedback submission.
 *
 * The companion core endpoint (Task 5b: `GET /v1/sessions` plural list) is
 * not yet merged; until it ships, this client just gets a 404 and the
 * `usePendingSessions` hook renders an empty list. The shape here is
 * deliberately narrow — a single row shape per the design's scenario-A
 * acceptance — and is NOT a generic SessionModel mirror.
 */

import { ApiErrorKind } from "@/lib/domain/v1/constants";
import type { ApiError } from "@/lib/domain/v1/envelope";
import type { ApiClient } from "./endpoints";
import { getRead, type Result } from "./endpoints";

export interface SessionPrompt {
  title: string;
  body: string;
  why?: string | null;
}

export type InteractionNode =
  | { kind: "input"; id: string; label: string; value: string | null }
  | { kind: "option"; id: string; label: string; options: Array<{ id: string; label: string }> };

export interface SessionView {
  id: string;
  status: "open" | "closed";
  prompt: SessionPrompt;
  interactionTree: InteractionNode;
  baseRevision: number;
}

export async function listPendingSessions(
  client: ApiClient,
): Promise<Result<SessionView[]>> {
  return getRead<SessionView[]>(client, "/v1/sessions?status=open");
}

export async function getSession(
  client: ApiClient,
  id: string,
): Promise<Result<SessionView>> {
  return getRead<SessionView>(client, `/v1/sessions/${encodeURIComponent(id)}`);
}

export interface FeedbackPayload {
  answers: Record<string, string>;
  baseRevision: number;
}

export async function submitFeedback(
  client: ApiClient,
  sessionId: string,
  payload: FeedbackPayload,
): Promise<Result<unknown>> {
  // Mirror existing envelope shape; the core handler at
  // POST /v1/sessions/{id}/feedback accepts a plain JSON body, NOT a
  // CommandRequest envelope. Use raw fetch instead of postCommand.
  const token = client.useProxyBridge ? null : await client.getIdToken();
  if (!client.useProxyBridge && !token) {
    return { ok: false, error: forbiddenNoToken() };
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  try {
    const res = await fetch(
      `${client.baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/feedback`,
      {
        method: "POST",
        headers,
        body: JSON.stringify(payload),
      },
    );
    if (!res.ok) {
      const kind =
        res.status === 409
          ? ApiErrorKind.CONFLICT
          : res.status === 404
            ? ApiErrorKind.NOT_FOUND
            : ApiErrorKind.RETRYABLE;
      return {
        ok: false,
        error: {
          kind,
          message: `submitFeedback failed: HTTP ${res.status}`,
          currentRevision: null,
          violations: [],
        },
      };
    }
    return { ok: true, data: null, status: res.status };
  } catch (err) {
    return {
      ok: false,
      error: {
        kind: ApiErrorKind.RETRYABLE,
        message: err instanceof Error ? err.message : "fetch failed",
        currentRevision: null,
        violations: [],
      },
    };
  }
}

function forbiddenNoToken(): ApiError {
  return {
    kind: ApiErrorKind.FORBIDDEN,
    message: "no id token",
    currentRevision: null,
    violations: [],
  };
}
