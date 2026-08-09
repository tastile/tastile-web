// v1 Window helpers shared across e2e specs.  v1 Windows are the
// first-class time-window aggregate (v1/03-time-and-windows.md).
// Numeric constants for WindowKind live in `tastile-domain::window`.

import { type APIRequestContext, expect } from "@playwright/test";
import { v1AuthHeaders } from "./v1";

interface V1CommandResp { aggregate?: { id: string }; }

export interface V1WindowView {
  id: string;
  kind: number;
  bounds?: { start: string; end: string };
  rules?: unknown[];
}

export interface V1CreateWindowInput {
  kind: number;
  /** ISO8601 start.  Defaults to 1970-01-01T00:00:00Z (always-bounded). */
  start?: string;
  /** ISO8601 end.  Defaults to 9999-12-31T23:59:59Z (effectively infinite). */
  end?: string;
  rules?: Array<unknown>;
}

/** POST /v1/windows.  Server assigns the Window id. */
export async function v1CreateWindow(
  client: { request: APIRequestContext },
  input: V1CreateWindowInput,
): Promise<string> {
  const res = await client.request.post("/api/proxy/v1/windows", {
    headers: v1AuthHeaders(),
    data: {
      idempotency_key: crypto.randomUUID(),
      payload: {
        kind: input.kind,
        bounds: {
          start: input.start ?? "1970-01-01T00:00:00Z",
          end: input.end ?? "9999-12-31T23:59:59Z",
        },
        rules: input.rules ?? [],
      },
    },
  });
  expect(res.status(), "POST /v1/windows").toBeLessThan(400);
  const body = (await res.json()) as V1CommandResp;
  const id = body.aggregate?.id;
  if (!id) throw new Error("v1/windows response missing aggregate.id");
  return id;
}

/** GET /v1/windows?owner_id=<oid>.  Returns the array of windows. */
export async function v1ListWindows(
  client: { request: APIRequestContext },
  ownerId?: string,
): Promise<V1WindowView[]> {
  const qs = ownerId ? `?owner_id=${encodeURIComponent(ownerId)}` : "";
  const res = await client.request.get(`/api/proxy/v1/windows${qs}`);
  expect(res.status(), "GET /v1/windows").toBeLessThan(400);
  return (await res.json()) as V1WindowView[];
}

/** GET /v1/windows/{id}.  Throws if status >= 400. */
export async function v1ReadWindow(
  client: { request: APIRequestContext },
  windowId: string,
): Promise<V1WindowView> {
  const res = await client.request.get(`/api/proxy/v1/windows/${windowId}`);
  expect(res.status(), `GET /v1/windows/${windowId}`).toBeLessThan(400);
  return (await res.json()) as V1WindowView;
}
