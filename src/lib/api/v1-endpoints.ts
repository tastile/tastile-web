/**
 * v1 HTTP client — typed wrapper for `tastile-core` v1 endpoints.
 *
 * Uses the v1 envelope (`CommandRequest<T>` in / out, `CommandResponse`
 * out, `ApiError` on failure) defined in `@/lib/domain/v1/envelope`.
 *
 * Returns `Result<T>` instead of throwing so the UI can render structured
 * failure states (validation / forbidden / stale revision / etc.) without
 * try/catch noise.
 *
 * Auth: the Cognito id_token is fetched via `client.getIdToken` on every
 * call so silent renewals are honored.
 */

import type {
  ApiError,
  CommandRequest,
  CommandResponse,
} from "@/lib/domain/v1/envelope";
import { ApiErrorKind } from "@/lib/domain/v1/constants";

export interface V1Client {
  baseUrl: string;
  getIdToken: () => Promise<string | null>;
}

export type Result<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: ApiError };

const FORBIDDEN_NO_TOKEN: ApiError = {
  kind: ApiErrorKind.FORBIDDEN,
  message: "no id token",
  currentRevision: null,
  violations: [],
};

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
    if (typeof r.kind === "number") {
      return {
        kind: r.kind,
        message: typeof r.message === "string" ? r.message : fallbackMessage,
        currentRevision:
          typeof r.currentRevision === "number" ? r.currentRevision : null,
        violations: Array.isArray(r.violations) ? r.violations : [],
      };
    }
  }
  return networkError(fallbackMessage);
}

export async function postV1Command<TReq, TRes>(
  client: V1Client,
  path: string,
  envelope: CommandRequest<TReq>,
): Promise<Result<CommandResponse & { payload: TRes }>> {
  const token = await client.getIdToken();
  if (!token) {
    return { ok: false, error: FORBIDDEN_NO_TOKEN };
  }

  let res: Response;
  try {
    res = await fetch(`${client.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(envelope),
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

  const data = (await res.json()) as CommandResponse;
  return { ok: true, data: { ...data, payload: undefined as unknown as TRes }, status: res.status };
}

export async function getV1Read<T>(
  client: V1Client,
  path: string,
): Promise<Result<T>> {
  const token = await client.getIdToken();
  if (!token) {
    return { ok: false, error: FORBIDDEN_NO_TOKEN };
  }

  let res: Response;
  try {
    res = await fetch(`${client.baseUrl}${path}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
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

  const data = (await res.json()) as T;
  return { ok: true, data, status: res.status };
}