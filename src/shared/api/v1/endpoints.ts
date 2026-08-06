/**
 * v1 HTTP client — typed wrapper for `tastile-core` v1 endpoints.
 *
 * Uses the v1 envelope (`CommandRequest<T>` in / out, `CommandResponse`
 * out, `ApiError` on failure) defined in `@/tile/model/v1/envelope`.
 *
 * Returns `Result<T>` instead of throwing so the UI can render structured
 * failure states (validation / forbidden / stale revision / etc.) without
 * try/catch noise.
 *
 * Auth: the Cognito id_token is fetched via `client.getIdToken` on every
 * call so silent renewals are honored.
 */

import { ApiErrorKind } from "@/tile/model/v1/constants";
import type { ApiError, CommandRequest, CommandResponse } from "@/tile/model/v1/envelope";

export interface ApiClient {
  baseUrl: string;
  getIdToken: () => Promise<string | null>;
  useProxyBridge?: boolean;
}

export type Result<T> = { ok: true; data: T; status: number } | { ok: false; error: ApiError };

const FORBIDDEN_NO_TOKEN: ApiError = {
  kind: ApiErrorKind.FORBIDDEN,
  message: "no id token",
  currentRevision: null,
  violations: [],
};

// Single source of truth for the 8 ApiErrorKind numeric values.
const VALID_API_ERROR_KINDS: ReadonlySet<number> = new Set<number>([
  ApiErrorKind.VALIDATION,
  ApiErrorKind.FORBIDDEN,
  ApiErrorKind.STALE_REVISION,
  ApiErrorKind.IDEMPOTENCY_KEY_REUSED,
  ApiErrorKind.NOT_FOUND,
  ApiErrorKind.CONFLICT,
  ApiErrorKind.BLOCKED,
  ApiErrorKind.RETRYABLE,
]);

function networkError(message: string): ApiError {
  return {
    kind: ApiErrorKind.RETRYABLE,
    message,
    currentRevision: null,
    violations: [],
  };
}

async function parseJson(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function toApiError(raw: unknown, fallbackMessage: string): ApiError {
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    if (typeof r.kind === "number" && VALID_API_ERROR_KINDS.has(r.kind)) {
      const currentRevision = r.currentRevision ?? r.current_revision;
      return {
        kind: r.kind,
        message: typeof r.message === "string" ? r.message : fallbackMessage,
        currentRevision: typeof currentRevision === "number" ? currentRevision : null,
        violations: Array.isArray(r.violations) ? r.violations : [],
      };
    }
  }
  return networkError(fallbackMessage);
}

function toWireCommandRequest<TReq>(envelope: CommandRequest<TReq>): Record<string, unknown> {
  return {
    expected_revision: envelope.expectedRevision,
    idempotency_key: envelope.idempotencyKey,
    occurred_at: envelope.occurredAt,
    payload: envelope.payload,
  };
}

function fromWireCommandResponse(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const r = raw as Record<string, unknown>;
  const pending = Array.isArray(r.pending)
    ? r.pending.map((item) => {
        if (!item || typeof item !== "object") return item;
        const p = item as Record<string, unknown>;
        return {
          ...p,
          notBefore: p.notBefore ?? p.not_before ?? null,
        };
      })
    : r.pending;
  const aggregateMetaRaw = r.aggregateMeta ?? r.aggregate_meta ?? null;
  let aggregateMeta = aggregateMetaRaw;
  if (aggregateMetaRaw && typeof aggregateMetaRaw === "object") {
    const am = aggregateMetaRaw as Record<string, unknown>;
    aggregateMeta = {
      tileId: am.tileId ?? am.tile_id ?? null,
      planId: am.planId ?? am.plan_id ?? null,
      recurringId: am.recurringId ?? am.recurring_id ?? null,
      frameRuleId: am.frameRuleId ?? am.frame_rule_id ?? null,
      changesetId: am.changesetId ?? am.changeset_id ?? null,
      changeIds: am.changeIds ?? am.change_ids ?? [],
      windowIds: am.windowIds ?? am.window_ids ?? null,
      flowIds: am.flowIds ?? am.flow_ids ?? null,
      sourceTileId: am.sourceTileId ?? am.source_tile_id ?? null,
      occurrenceIds: am.occurrenceIds ?? am.occurrence_ids ?? [],
      placementIds: am.placementIds ?? am.placement_ids ?? [],
    };
  }
  return {
    ...r,
    commandId: r.commandId ?? r.command_id,
    acceptedAt: r.acceptedAt ?? r.accepted_at,
    aggregateMeta,
    pending,
  };
}

/**
 * Validate that a parsed JSON body matches the minimal `CommandResponse`
 * shape (`commandId` and `acceptedAt` are mandatory strings). Returns an
 * `ApiError` (RETRYABLE) on mismatch so callers can render a coherent
 * failure without crashing on unexpected payloads.
 */
function validateCommandResponse(raw: unknown): ApiError | null {
  if (!raw || typeof raw !== "object") {
    return networkError("response body is not an object");
  }
  const r = raw as Record<string, unknown>;
  if (typeof r.commandId !== "string") {
    return networkError("response missing string field: commandId");
  }
  if (typeof r.acceptedAt !== "string") {
    return networkError("response missing string field: acceptedAt");
  }
  return null;
}

export async function postCommand<TReq>(
  client: ApiClient,
  path: string,
  envelope: CommandRequest<TReq>,
): Promise<Result<CommandResponse>> {
  const token = client.useProxyBridge ? null : await client.getIdToken();
  if (!client.useProxyBridge && !token) {
    return { ok: false, error: FORBIDDEN_NO_TOKEN };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${client.baseUrl}${path}`, {
      method: "POST",
      headers,
      body: JSON.stringify(toWireCommandRequest(envelope)),
    });
  } catch (err) {
    return {
      ok: false,
      error: networkError(err instanceof Error ? err.message : "fetch failed"),
    };
  }

  if (!res.ok) {
    const body = await parseJson(res);
    return {
      ok: false,
      error: toApiError(body, `HTTP ${res.status}`),
    };
  }

  const raw = fromWireCommandResponse(await parseJson(res));
  const shapeError = validateCommandResponse(raw);
  if (shapeError) {
    return { ok: false, error: shapeError };
  }
  return { ok: true, data: raw as CommandResponse, status: res.status };
}

export async function getRead<T>(client: ApiClient, path: string): Promise<Result<T>> {
  const token = client.useProxyBridge ? null : await client.getIdToken();
  if (!client.useProxyBridge && !token) {
    return { ok: false, error: FORBIDDEN_NO_TOKEN };
  }

  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${client.baseUrl}${path}`, {
      method: "GET",
      headers,
    });
  } catch (err) {
    return {
      ok: false,
      error: networkError(err instanceof Error ? err.message : "fetch failed"),
    };
  }

  if (!res.ok) {
    const body = await parseJson(res);
    return {
      ok: false,
      error: toApiError(body, `HTTP ${res.status}`),
    };
  }

  const raw = await parseJson(res);
  if (!raw || typeof raw !== "object") {
    return { ok: false, error: networkError("response body is not an object") };
  }
  return { ok: true, data: raw as T, status: res.status };
}

/** @deprecated Use `postCommand` instead. */
export async function sendCommand<TReq>(
  client: ApiClient,
  method: "POST" | "PUT" | "DELETE",
  path: string,
  envelope: CommandRequest<TReq>,
  initOverrides?: { signal?: AbortSignal },
  extraHeaders?: Record<string, string>,
): Promise<Result<CommandResponse>> {
  const token = client.useProxyBridge ? null : await client.getIdToken();
  if (!client.useProxyBridge && !token) {
    return { ok: false, error: FORBIDDEN_NO_TOKEN };
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (extraHeaders) {
    for (const [k, v] of Object.entries(extraHeaders)) {
      if (v !== undefined && v !== null) headers[k] = v;
    }
  }

  let res: Response;
  try {
    res = await fetch(`${client.baseUrl}${path}`, {
      method,
      headers,
      body: JSON.stringify(toWireCommandRequest(envelope)),
      ...(initOverrides?.signal ? { signal: initOverrides.signal } : {}),
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return {
        ok: false,
        error: {
          kind: ApiErrorKind.RETRYABLE,
          message: "aborted",
          currentRevision: null,
          violations: [],
        },
      };
    }
    return {
      ok: false,
      error: networkError(err instanceof Error ? err.message : "fetch failed"),
    };
  }

  if (!res.ok) {
    const body = await parseJson(res);
    return {
      ok: false,
      error: toApiError(body, `HTTP ${res.status}`),
    };
  }

  const raw = fromWireCommandResponse(await parseJson(res));
  const shapeError = validateCommandResponse(raw);
  if (shapeError) {
    return { ok: false, error: shapeError };
  }
  return { ok: true, data: raw as CommandResponse, status: res.status };
}
