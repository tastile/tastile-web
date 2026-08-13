import { recordTileCreateAttempt } from "@/shared/analytics/tile-create";
import { getCoreToken } from "@/shared/api/core-token";
import { isCloudDirectEnabled } from "@/shared/api/endpoints";
import { ApiErrorKind } from "@/shared/model/v1/constants";
import type { ApiError } from "@/shared/model/v1/envelope";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
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

type SubmitSuccess = { ok: true; tileId: string; idempotencyKey?: string };
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
  if (explicitCoreUrl) {
    return {
      baseUrl: explicitCoreUrl,
      useProxyBridge: false,
      getIdToken: async () => (e2eBypass ? E2E_DEV_TOKEN : null),
    };
  }
  const cloudDirectBase = isCloudDirectEnabled()
    ? (process.env.NEXT_PUBLIC_TASTILE_CORE_URL?.trim() ?? "")
    : "";
  if (cloudDirectBase) {
    return {
      baseUrl: cloudDirectBase,
      useProxyBridge: false,
      getIdToken: getCoreToken,
    };
  }
  return {
    baseUrl: "/api/proxy",
    useProxyBridge: true,
    getIdToken: async () => (e2eBypass ? E2E_DEV_TOKEN : null),
  };
}

// ============================================================
// A5b — typed error class hierarchy
// ============================================================

/**
 * Thrown for 5xx / network failures so the UI can show a retry toast
 * carrying the same Idempotency-Key (issue #24 acceptance criterion:
 * "Retry uses the same Idempotency-Key").
 */
export class SubmitError extends Error {
  readonly requestId: string | null;
  readonly httpStatus: number | null;
  readonly cause: unknown;
  constructor(opts: {
    message: string;
    requestId?: string | null;
    httpStatus?: number | null;
    cause?: unknown;
  }) {
    super(opts.message);
    this.name = "SubmitError";
    this.requestId = opts.requestId ?? null;
    this.httpStatus = opts.httpStatus ?? null;
    this.cause = opts.cause;
  }
}

/**
 * Thrown for 4xx validation failures. The UI surfaces this as an
 * inline banner (`ApiError.message`) and does NOT navigate.
 */
export class SubmitValidationError extends Error {
  readonly raw: ApiError;
  constructor(raw: ApiError) {
    super(raw.message);
    this.name = "SubmitValidationError";
    this.raw = raw;
  }
}

// ============================================================
// A5b — submitTile: idempotency + abort + analytics
// ============================================================

export type TileCreateAttemptEvent =
  | { outcome: "success"; duration_ms: number }
  | {
      outcome: "error";
      duration_ms: number;
      error_code: string;
      http_status: number | null;
      request_id: string | null;
    }
  | { outcome: "retry"; duration_ms: number; will_retry: boolean };

export interface SubmitTileOptions {
  client: ApiClient;
  /** Optional override for the Idempotency-Key (used by retry). */
  idempotencyKey?: string;
  /** AbortSignal for caller-side cancellation. */
  signal?: AbortSignal;
  /** Analytics sink; default is `console.info("tile_create_attempt", event)`. */
  onAttempt?: (event: TileCreateAttemptEvent) => void;
}

const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * Submit a new tile to the v1 API with explicit idempotency, abort
 * support, and analytics emission.
 *
 * The wire path is: `publishScheduleDefinition` (the 201 envelope
 * path) with an `Idempotency-Key` header (defense-in-depth visibility)
 * and the body's `idempotency_key` (the v1 daemon's actual cache
 * contract; see tastile-core/v1/14 §1-4).
 *
 * Throws:
 *  - `SubmitValidationError` on 4xx (inline banner path)
 *  - `SubmitError` on 5xx / network / abort (retry toast path)
 */
export async function submitTile(options: SubmitTileOptions): Promise<SubmitResult> {
  const t0 = typeof performance !== "undefined" ? performance.now() : Date.now();
  const idempotencyKey = options.idempotencyKey ?? crypto.randomUUID();
  const attempt = options.onAttempt ?? recordTileCreateAttempt;

  const controller = new AbortController();
  const linked = (() => {
    if (!options.signal) return controller;
    const onAbort = () => controller.abort(options.signal?.reason);
    if (options.signal.aborted) {
      controller.abort(options.signal.reason);
    } else {
      options.signal.addEventListener("abort", onAbort, { once: true });
    }
    return controller;
  })();
  const timeoutHandle = options.signal
    ? null
    : setTimeout(() => controller.abort(new Error("submit timeout")), DEFAULT_TIMEOUT_MS);

  try {
    const result = await publishScheduleDefinition({
      client: options.client,
      payload: buildQuickCreateSchedulePayload(useQuickCreateStore.getState()),
      idempotencyKey,
      signal: linked.signal,
    });

    const durationMs = Math.round(
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0,
    );

    if (result.ok) {
      attempt({ outcome: "success", duration_ms: durationMs });
      return { ok: true, tileId: result.tileId, idempotencyKey: result.idempotencyKey };
    }

    // Map error.kind to typed errors / analytics.
    const kind = result.error.kind;
    const httpStatus = inferHttpStatusFromKind(kind);
    const errorCode = `kind=${kind}`;
    attempt({
      outcome: "error",
      duration_ms: durationMs,
      error_code: errorCode,
      http_status: httpStatus,
      request_id: null,
    });

    if (kind === ApiErrorKind.VALIDATION || kind === ApiErrorKind.STALE_REVISION) {
      // 4xx: surface to inline banner. Caller catches and renders.
      throw new SubmitValidationError(result.error);
    }
    // 5xx / forbidden / conflict / blocked / retryable / etc.
    throw new SubmitError({
      message: result.error.message,
      requestId: null,
      httpStatus,
      cause: result.error,
    });
  } catch (err) {
    const durationMs = Math.round(
      (typeof performance !== "undefined" ? performance.now() : Date.now()) - t0,
    );

    if (err instanceof SubmitValidationError) {
      // Re-throw with correct duration_ms in analytics (already emitted above).
      throw err;
    }
    if (err instanceof SubmitError) {
      throw err;
    }

    // Abort / network / TypeError → retry path.
    const message = err instanceof Error ? err.message : String(err);
    const isAbort = err instanceof DOMException && err.name === "AbortError";
    attempt({
      outcome: "error",
      duration_ms: durationMs,
      error_code: isAbort ? "aborted" : "network",
      http_status: null,
      request_id: null,
    });
    throw new SubmitError({
      message: isAbort ? "submit timed out" : `network error: ${message}`,
      requestId: null,
      httpStatus: null,
      cause: err,
    });
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

function inferHttpStatusFromKind(kind: number): number | null {
  // Approximate mapping from `ApiErrorKind` enum to HTTP status. The
  // exact value is not surfaced by the current client (only the
  // numeric body kind); we use this for analytics only.
  switch (kind) {
    case ApiErrorKind.VALIDATION:
      return 400;
    case ApiErrorKind.FORBIDDEN:
      return 403;
    case ApiErrorKind.NOT_FOUND:
      return 404;
    case ApiErrorKind.IDEMPOTENCY_KEY_REUSED:
      return 409;
    case ApiErrorKind.STALE_REVISION:
      return 409;
    case ApiErrorKind.CONFLICT:
      return 409;
    case ApiErrorKind.BLOCKED:
      return 422;
    case ApiErrorKind.RETRYABLE:
      return 500;
    default:
      return null;
  }
}

// ============================================================
// Backward-compat thin wrappers (preserved for Phase A callers)
// ============================================================

/**
 * Submit a new tile to the v1 API.
 *
 * The API either commits the complete authored definition or leaves no
 * partial Tile/Plan rows behind. This is a thin wrapper around
 * `submitTile` for callers that don't need idempotency / retry / abort /
 * analytics. The body's `idempotency_key` (a uuidv7) is generated by the
 * envelope helper and is what the v1 daemon actually uses for its 24h
 * cache; the new `submitTile` additionally attaches an `Idempotency-Key`
 * header for DevTools visibility.
 */
export async function submitCreateTile(options: SubmitOptions): Promise<SubmitResult> {
  try {
    const res = await submitTile({ client: options.client });
    if (res.ok) {
      return { ok: true, tileId: res.tileId };
    }
    return res;
  } catch (err) {
    if (err instanceof SubmitValidationError) return { ok: false, error: err.raw };
    if (err instanceof SubmitError) {
      // Re-wrap as a discriminated-union failure so legacy callers
      // (e.g. QuickCreate edit-mode) keep working unchanged.
      const fallback: ApiError = {
        kind: ApiErrorKind.RETRYABLE,
        message: err.message,
        currentRevision: null,
        violations: [],
      };
      return { ok: false, error: fallback };
    }
    const fallback: ApiError = {
      kind: ApiErrorKind.RETRYABLE,
      message: err instanceof Error ? err.message : "submit failed",
      currentRevision: null,
      violations: [],
    };
    return { ok: false, error: fallback };
  }
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
