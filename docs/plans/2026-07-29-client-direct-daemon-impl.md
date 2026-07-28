# tastile-web client-direct daemon access — implementation plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let the browser call `/v1/*` on the daemon directly (no same-origin proxy roundtrip) when a runtime cookie flag is on, while keeping the `/api/proxy/*` path working as fallback. CORS, Cookie-header auth fallback on the daemon, and a preferences-page toggle are all wired.

**Architecture:**
- New JS-readable cookie `tastile_direct_daemon="1"` toggles the mode (read once in `getCoreClient()`).
- Direct-mode `CoreClient` uses `${window.location.origin}/v1/*` + `credentials: include`. The browser auto-attaches the httpOnly `tastile_api_token` Cookie, which the daemon now accepts via a new `Cookie: tastile_api_token=<token>` fallback in `bearer_auth_result`.
- Daemon's `cors_layer()` gains `.allow_credentials(true)` (opt-in, currently missing) so the browser doesn't strip the Cookie on CORS preflight.
- New `POST/DELETE /api/account/direct-mode` route mutates the cookie; preferences page binds a Switch to it.

**Tech Stack:** Next.js 16 App Router, TypeScript, Vitest, Axum 0.7, tower-http 0.5, vitest + sqlx for daemon. No new dependencies.

**Design doc:** `docs/plans/2026-07-29-client-direct-daemon-design.md` (already validated 2026-07-29).

---

## Files (master list)

### tastile-web (Next.js)

- Modify: `src/lib/cognito/cookies.ts` — add `COOKIE_DIRECT_DAEMON` constant
- Create: `src/app/api/account/direct-mode/route.ts` — POST sets / DELETE clears cookie
- Create: `src/app/api/account/direct-mode/route.test.ts` — vitest cases for both verbs
- Modify: `src/lib/api/endpoints.ts` — `getCoreClient()` reads cookie + dispatches direct vs proxy client
- Create: `src/lib/api/endpoints.direct-mode.test.ts` — cookie-driven client factory
- Modify: `src/app/dashboard/preferences/general/page.tsx` — preferences toggle UI
- Create: `src/app/dashboard/preferences/general/direct-mode.test.tsx` — toggle round-trip
- (EC2 env, not a file) `/etc/tastile/tastile.env` — set `TASTILE_ALLOWED_ORIGINS`

### tastile-core (Rust)

- Modify: `crates-v1/api/src/handlers/common.rs` — `bearer_auth_result` reads `Cookie: tastile_api_token=<token>` as fallback when `Authorization` is missing
- Create: `crates-v1/api/tests/authenticate_cookie_fallback.rs` — bridge tests for the cookie path
- Modify: `crates-v1/api/src/main.rs` — `cors_layer()` adds `.allow_credentials(true)`
- Create: `crates-v1/api/tests/cors_credentials_flag.rs` — verifies preflight response carries `Access-Control-Allow-Credentials: true`

### Deployment

- Modify: `/etc/tastile/tastile.env` on EC2 (`i-0ec20b65596468a79`) — set `TASTILE_ALLOWED_ORIGINS=https://app.tastile.app,https://app.tastile.dev,http://localhost:3000`

---

## Acceptance

- Browser toggle on → REST calls go to `https://app.tastile.app/v1/*` (no `/api/proxy/`), `Cookie: tastile_api_token=...` is attached, daemon accepts (200), `Access-Control-Allow-Credentials: true` on preflight.
- Toggle off → existing proxy path (`/api/proxy/v1/*`) still works.
- Stale `tastile_api_token` Cookie + bridge headers (no Bearer) → daemon falls through to Cookie header (NEW path), then bridge headers — never 401s when at least one auth signal is present.
- Cookie cleared on logout (existing `clearAuthCookies` only clears auth cookies; toggle state persists — user must hit the preferences toggle to turn off).
- SSE remains on proxy (out of scope).
- `cargo test -p api -- --test-threads=1` and `bun test` all green.

---

## Task 1: Add `COOKIE_DIRECT_DAEMON` constant

**Files:**
- Modify: `src/lib/cognito/cookies.ts`

**Step 1: Write the failing test**

The constant is consumed by the route handler and the preferences page; there's no test for a bare string export. Skip the failing test (a constant addition doesn't have meaningful TDD red). Move to Step 2 directly.

(If a guardrail test is desired, add one at `src/lib/cognito/cookies.test.ts` that asserts `COOKIE_DIRECT_DAEMON === "tastile_direct_daemon"` — that's the only contract.)

**Step 2: Add the export**

In `src/lib/cognito/cookies.ts`, append a new constant below the existing exports (around line 14):

```typescript
export const COOKIE_DIRECT_DAEMON = "tastile_direct_daemon";
```

**Step 3: Verify**

Run: `bun run typecheck`

Expected: exit 0. No new usage yet, so no test changes.

**Step 4: Commit**

```bash
cd C:\Users\rebui\Desktop\tastile\tastile-web
git add src/lib/cognito/cookies.ts
git commit -m "feat(tastile-web): add COOKIE_DIRECT_DAEMON constant"
```

---

## Task 2: Create `POST/DELETE /api/account/direct-mode` endpoint

**Files:**
- Create: `src/app/api/account/direct-mode/route.ts`
- Create: `src/app/api/account/direct-mode/route.test.ts`

**Step 1: Write the failing tests**

Create `src/app/api/account/direct-mode/route.test.ts`:

```typescript
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";

const APP_BASE_URL = "https://app.tastile.test";

describe("api account direct-mode", () => {
  it("POST sets tastile_direct_daemon=1 cookie when user is logged in", async () => {
    process.env.TASTILE_WEB_BRIDGE_SECRET = "test-bridge-secret";
    const route = await import("./route");

    const request = new NextRequest(`${APP_BASE_URL}/api/account/direct-mode`, {
      method: "POST",
      headers: { cookie: "tastile_uid=cognito-sub-abc" },
    });

    const response = await route.POST(request);
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("tastile_direct_daemon=1");
    expect(setCookie.toLowerCase()).toMatch(/path=\//);
    // Toggle cookie is JS-readable, not httpOnly
    expect(setCookie.toLowerCase()).not.toContain("httponly");
  });

  it("POST returns 401 when user has no auth cookie", async () => {
    process.env.TASTILE_WEB_BRIDGE_SECRET = "test-bridge-secret";
    const route = await import("./route");

    const request = new NextRequest(`${APP_BASE_URL}/api/account/direct-mode`, {
      method: "POST",
    });

    const response = await route.POST(request);
    expect(response.status).toBe(401);
  });

  it("DELETE clears tastile_direct_daemon cookie when user is logged in", async () => {
    process.env.TASTILE_WEB_BRIDGE_SECRET = "test-bridge-secret";
    const route = await import("./route");

    const request = new NextRequest(`${APP_BASE_URL}/api/account/direct-mode`, {
      method: "DELETE",
      headers: { cookie: "tastile_api_token=any; tastile_uid=cognito-sub-abc" },
    });

    const response = await route.DELETE(request);
    expect(response.status).toBe(200);
    const setCookie = response.headers.get("set-cookie") ?? "";
    expect(setCookie).toContain("tastile_direct_daemon=");
    expect(setCookie).toContain("Max-Age=0");
  });

  it("DELETE returns 401 when user has no auth cookie", async () => {
    process.env.TASTILE_WEB_BRIDGE_SECRET = "test-bridge-secret";
    const route = await import("./route");

    const request = new NextRequest(`${APP_BASE_URL}/api/account/direct-mode`, {
      method: "DELETE",
    });

    const response = await route.DELETE(request);
    expect(response.status).toBe(401);
  });
});
```

Run: `bun test src/app/api/account/direct-mode/route.test.ts`

Expected: FAIL with "Cannot find module './route'" (route.ts not created yet). Note: the 4 cases all hit the import; some 401 paths may also fail because no route exists. Either way, RED.

**Step 2: Implement the route**

Create `src/app/api/account/direct-mode/route.ts`:

```typescript
import { type NextRequest, NextResponse } from "next/server";
import { COOKIE_API_TOKEN, COOKIE_DIRECT_DAEMON, COOKIE_USER_SUB } from "@/lib/cognito/cookies";

const COOKIE_MAX_AGE_30_DAYS = 60 * 60 * 24 * 30;

function isLoggedIn(request: NextRequest): boolean {
  const apiToken = request.cookies.get(COOKIE_API_TOKEN)?.value;
  const userSub = request.cookies.get(COOKIE_USER_SUB)?.value;
  return Boolean(apiToken || userSub);
}

function cookieAttributes(): string {
  const isProd = process.env.NODE_ENV === "production";
  const parts = [`Path=/`, `SameSite=Lax`, `Max-Age=${COOKIE_MAX_AGE_30_DAYS}`];
  if (isProd) parts.push("Secure");
  return parts.join("; ");
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!isLoggedIn(request)) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    `${COOKIE_DIRECT_DAEMON}=1; ${cookieAttributes()}`,
  );
  return response;
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!isLoggedIn(request)) {
    return NextResponse.json({ error: "not authenticated" }, { status: 401 });
  }
  const isProd = process.env.NODE_ENV === "production";
  const parts = ["Path=/", "SameSite=Lax", "Max-Age=0"];
  if (isProd) parts.push("Secure");
  const response = NextResponse.json({ ok: true });
  response.headers.append(
    "Set-Cookie",
    `${COOKIE_DIRECT_DAEMON}=; ${parts.join("; ")}`,
  );
  return response;
}
```

**Step 3: Run the tests**

Run: `bun test src/app/api/account/direct-mode/route.test.ts`

Expected: 4/4 PASS. The `isProd` part adds "Secure" only in production; tests run with `NODE_ENV !== "production"` so Secure is absent, which is fine.

**Step 4: Commit**

```bash
cd C:\Users\rebui\Desktop\tastile\tastile-web
git add src/app/api/account/direct-mode/route.ts src/app/api/account/direct-mode/route.test.ts
git commit -m "feat(tastile-web): add POST/DELETE /api/account/direct-mode toggle endpoint"
```

---

## Task 3: Extend `CoreClient` with mode-aware URL + credentials

**Files:**
- Modify: `src/lib/api/endpoints.ts`
- Create: `src/lib/api/endpoints.direct-mode.test.ts`

**Step 1: Write the failing test**

Create `src/lib/api/endpoints.direct-mode.test.ts`:

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COOKIE_DIRECT_DAEMON } from "@/lib/cognito/cookies";

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  // Wipe cookie between tests
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: "",
  });
});

describe("getCoreClient mode detection", () => {
  it("returns proxy-mode client when tastile_direct_daemon cookie is absent", async () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: "",
    });
    process.env.NEXT_PUBLIC_TASTILE_CORE_URL = "https://core.tastile.test";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("[]", { status: 200 }),
    );
    const { getCoreClient, ENDPOINTS } = await import("./endpoints");
    const client = getCoreClient();

    await client.call("listTiles" as keyof typeof ENDPOINTS);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url.startsWith("/api/proxy/")).toBe(true);
  });

  it("returns direct-mode client when tastile_direct_daemon=1", async () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: `${COOKIE_DIRECT_DAEMON}=1`,
    });
    process.env.NEXT_PUBLIC_TASTILE_CORE_URL = "https://core.tastile.test";

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("[]", { status: 200 }),
    );
    const { getCoreClient, ENDPOINTS } = await import("./endpoints");
    const client = getCoreClient();

    await client.call("listTiles" as keyof typeof ENDPOINTS);

    const init = fetchMock.mock.calls[0][1] as RequestInit;
    expect((init.credentials ?? "omit")).toBe("include");
    // Direct mode does not inject Authorization header (browser attaches Cookie)
    const headers = init.headers as Record<string, string>;
    expect(headers.authorization).toBeUndefined();
  });

  it("falls back to proxy-mode when NEXT_PUBLIC_TASTILE_CORE_URL is unset", async () => {
    Object.defineProperty(document, "cookie", {
      writable: true,
      value: `${COOKIE_DIRECT_DAEMON}=1`,
    });
    delete process.env.NEXT_PUBLIC_TASTILE_CORE_URL;

    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("[]", { status: 200 }),
    );
    const { getCoreClient, ENDPOINTS } = await import("./endpoints");
    const client = getCoreClient();

    await client.call("listTiles" as keyof typeof ENDPOINTS);

    const url = fetchMock.mock.calls[0][0] as string;
    expect(url.startsWith("/api/proxy/")).toBe(true);
  });
});
```

This test needs to inspect the actual `ENDPOINTS` shape — check the existing test (if any) in `src/lib/api/endpoints.test.ts` for the exact key name. If `listTiles` isn't a key, use the first public read key. The test file as written assumes the key `listTiles` exists; substitute with whatever the canonical name is.

Run: `bun test src/lib/api/endpoints.direct-mode.test.ts`

Expected: FAIL. The 2nd test (cookie=1) expects `credentials: "include"`, which doesn't exist yet. The 3rd test expects the client to fall back to proxy when `NEXT_PUBLIC_TASTILE_CORE_URL` is unset, which is the existing behavior — that one may pass coincidentally. Don't worry about it: at least one test will RED.

**Step 2: Modify `endpoints.ts`**

In `src/lib/api/endpoints.ts`, make three changes.

(a) Add a `cookieReader` helper near the top (or inline in `getCoreClient`):

The implementation should read `document.cookie` once at client construction time, look for `tastile_direct_daemon=1`, and pick the right config.

(b) In `CoreClient.call()`, branch on `this.useProxyBridge`. When NOT proxy (direct mode), set `credentials: "include"` on the `fetchImpl` call and skip the Authorization header (browser attaches the Cookie).

(c) In `getCoreClient()`, decide `useProxyBridge` and `baseUrl` based on the cookie.

The concrete edits:

```typescript
// In CoreClient.call(), replace the fetchImpl invocation block (lines ~852-859):
let response: Response;
try {
  const fetchInit: RequestInit = {
    method: meta.method,
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  };
  if (!this.useProxyBridge) {
    fetchInit.credentials = "include";
  }
  response = await this.fetchImpl(url.toString(), fetchInit);
} catch (err) {
  // ... existing error handling unchanged
}
```

Also in the headers block (around lines 847-850), suppress the Bearer for direct mode:

```typescript
if (meta.auth && this.useProxyBridge) {
  const token = await this.tokenProvider();
  if (token) headers.authorization = `Bearer ${token}`;
}
```

(The condition now also requires `useProxyBridge` so direct-mode clients never set Authorization — the daemon reads the Cookie instead.)

In `getCoreClient()` (around lines 971-995), add cookie-driven mode selection. The full function becomes:

```typescript
function readDirectDaemonCookie(): boolean {
  if (typeof document === "undefined") return false;
  const target = `${COOKIE_DIRECT_DAEMON}=1`;
  return document.cookie.split(/;\s*/).some((c) => c === target);
}

export function getCoreClient(): CoreClient {
  if (_client) return _client;
  const rawBaseUrl =
    process.env.NEXT_PUBLIC_TASTILE_CORE_URL?.trim() ??
    process.env.NEXT_PUBLIC_DAEMON_BASE_URL?.trim() ??
    "";
  const baseUrl =
    rawBaseUrl ||
    (process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === "1" ? "http://127.0.0.1:31400" : "");
  if (!baseUrl) {
    throw new MissingCloudApiBaseError();
  }
  // Cookie-driven direct mode takes precedence over the proxy heuristic.
  // The cookie is JS-readable; it's set/cleared by /api/account/direct-mode.
  const directMode = readDirectDaemonCookie();
  if (directMode) {
    _client = new CoreClient({
      baseUrl,
      useProxyBridge: false,
      tokenProvider: async () => null, // Browser sends Cookie via credentials:include
    });
    return _client;
  }
  const usesCloudProxy = shouldUseProxyBridge(baseUrl);
  const clientBaseUrl = usesCloudProxy ? "/api/proxy" : baseUrl;
  _client = new CoreClient({
    baseUrl: clientBaseUrl,
    useProxyBridge: usesCloudProxy,
    tokenProvider: async () => null,
  });
  return _client;
}
```

Add the import at the top of `endpoints.ts`:

```typescript
import { COOKIE_DIRECT_DAEMON } from "@/lib/cognito/cookies";
```

**Step 3: Run the tests**

Run: `bun test src/lib/api/endpoints.direct-mode.test.ts`

Expected: 3/3 PASS. The cookie-driven path selects direct mode and skips Authorization, the no-cookie path uses proxy.

**Step 4: Run the broader test suite to confirm no regression**

Run: `bun test src/lib/api/`

Expected: existing tests still PASS. `_client` is module-level state — `vi.resetModules()` in `afterEach` re-imports the module, which resets the cache.

**Step 5: Commit**

```bash
cd C:\Users\rebui\Desktop\tastile\tastile-web
git add src/lib/api/endpoints.ts src/lib/api/endpoints.direct-mode.test.ts
git commit -m "feat(tastile-web): getCoreClient respects tastile_direct_daemon cookie"
```

---

## Task 4: Add the daemon-side `Cookie: tastile_api_token=<token>` fallback to `bearer_auth_result`

**Files:**
- Modify: `crates-v1/api/src/handlers/common.rs` — extend `bearer_auth_result` to read the Cookie header
- Create: `crates-v1/api/tests/authenticate_cookie_fallback.rs`

**Step 1: Read the current `bearer_auth_result` and `bridge_auth_from_headers` signatures**

Already mapped:
- `bearer_auth_result(state, headers) -> Result<Option<(i16, Uuid, Uuid)>, ApiHttpError>` at line 635
- Currently returns `Ok(None)` when `Authorization` header is missing — that's the early return we need to change

**Step 2: Write the failing tests**

Create `crates-v1/api/tests/authenticate_cookie_fallback.rs`:

```rust
//! Verifies that `bearer_auth_result` reads `Cookie: tastile_api_token=<token>`
//! when `Authorization` is absent. This is the cross-origin direct-mode
//! transport: the browser auto-attaches the httpOnly `tastile_api_token`
//! cookie via `credentials: include`.

use tastile_api::handlers::common::authenticate;
use tastile_api::AppState;
// Re-use the existing bridge-owner provisioning helper from the bridge auth tests
use crate::support::bridge::{seed_bridge_owner, BridgeFixture};
// ... adapt this to whatever fixture helpers your existing auth tests use

#[tokio::test]
async fn cookie_only_authenticates_via_tastile_api_token() {
    let BridgeFixture { state, owner, actor: _ } = seed_bridge_owner().await;
    let raw = "raw-test-token-cookie-only";

    // Insert a valid api token directly into v1_api_token so we have something to look up
    // (you may already have a helper for this — `seed_api_token` / similar)
    // ...

    let mut headers = axum::http::HeaderMap::new();
    let cookie = format!("tastile_api_token={}", raw);
    headers.insert(
        axum::http::header::COOKIE,
        axum::http::HeaderValue::from_str(&cookie).unwrap(),
    );

    let (kind, owner_id, actor_id) = authenticate(&state, &headers).await.expect("ok");
    assert_eq!(owner_id, owner);
    assert_eq!(actor_id, owner);
    assert_eq!(kind, 0); // DEFAULT_OWNER_KIND
}
```

NOTE: This test requires PostgreSQL (the existing bearer-fall-through tests do). Adapt it to match the exact fixture patterns in your test suite. The minimal contract is: "Cookie-only auth produces the same `(owner, actor)` as Bearer auth for the same token."

Use the existing `bridge_auth_*` test fixture pattern from `crates-v1/api/tests/authenticate_bearer_falls_through.rs` as a template. The test file there has a `seed_bridge_owner_with_api_token` style helper.

**Step 3: Run the test to verify RED**

Run: `cargo test -p api --test authenticate_cookie_fallback -- --test-threads=1`

Expected: FAIL. The daemon currently returns `Unauthorized` when only Cookie is present.

**Step 4: Modify `bearer_auth_result`**

In `crates-v1/api/src/handlers/common.rs`, change `bearer_auth_result` to extract the raw token from `Cookie` when `Authorization` is missing. Around lines 635-649:

```rust
async fn bearer_auth_result(
    state: &AppState,
    headers: &axum::http::HeaderMap,
) -> Result<Option<(i16, Uuid, Uuid)>, ApiHttpError> {
    const DEFAULT_OWNER_KIND: i16 = 0;

    // 1. Bearer header has priority (it carries the explicit v1_api_token JWT).
    let raw_from_header = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|h| h.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "))
        .map(|s| s.trim().to_string());

    // 2. Cookie fallback — direct-mode browsers attach `tastile_api_token` via
    //    `credentials: include`. Only the canonical name is consulted.
    let raw_from_cookie = raw_from_header.is_none().then(|| {
        headers
            .get(axum::http::header::COOKIE)
            .and_then(|h| h.to_str().ok())
            .and_then(parse_tastile_api_token_cookie)
    }).flatten();

    let Some(raw) = raw_from_header.or(raw_from_cookie) else {
        return Ok(None);
    };

    // ... existing token hash + lookup logic, unchanged below
}
```

Add the helper function near `bridge_auth_from_headers`:

```rust
/// Extract the `tastile_api_token=<value>` from a `Cookie` header string.
fn parse_tastile_api_token_cookie(cookie_header: &str) -> Option<String> {
    for part in cookie_header.split(';') {
        let part = part.trim();
        if let Some(rest) = part.strip_prefix("tastile_api_token=") {
            return Some(rest.to_string());
        }
    }
    None
}
```

Update the function's doc comment to mention the Cookie fallback.

**Step 5: Run the test to verify GREEN**

Run: `cargo test -p api --test authenticate_cookie_fallback -- --test-threads=1`

Expected: PASS.

**Step 6: Run the existing auth-related tests to confirm no regression**

Run: `cargo test -p api --test authenticate_bearer_falls_through -- --test-threads=1`

Expected: PASS (5/5). The Bearer-first priority is preserved.

**Step 7: Commit**

```bash
cd C:\Users\rebui\Desktop\tastile\tastile-core
git add crates-v1/api/src/handlers/common.rs crates-v1/api/tests/authenticate_cookie_fallback.rs
git commit -m "feat(v1): bearer_auth_result accepts tastile_api_token Cookie fallback"
```

---

## Task 5: Add `.allow_credentials(true)` to `cors_layer()`

**Files:**
- Modify: `crates-v1/api/src/main.rs`
- Create: `crates-v1/api/tests/cors_credentials_flag.rs`

**Step 1: Write the failing test**

Create `crates-v1/api/tests/cors_credentials_flag.rs`. This test boots a tiny Axum app with the production `cors_layer()` config (using `tower-http::cors::CorsLayer` directly is acceptable here since we just want to assert the layer emits the right headers):

```rust
//! Verifies that `cors_layer()` enables `allow_credentials(true)` when
//! production origins are configured. Browsers refuse to send httpOnly
//! cookies cross-origin without this header on the preflight response.

use std::str::FromStr;
use tower_http::cors::CorsLayer;
use axum::http::{header, HeaderValue, Method, StatusCode};
use axum::routing::get;
use axum::Router;
use tower::ServiceExt;
use http_body_util::BodyExt;

#[tokio::test]
async fn preflight_returns_access_control_allow_credentials_true() {
    std::env::set_var("TASTILE_ALLOWED_ORIGINS", "https://app.tastile.app");

    let layer = build_production_cors_layer();
    let app = Router::new().route("/v1/health", get(|| async { "ok" }))
        .layer(layer);

    let origin = HeaderValue::from_static("https://app.tastile.app");
    let req = axum::http::Request::builder()
        .method(Method::OPTIONS)
        .uri("/v1/health")
        .header(header::ORIGIN, origin.clone())
        .header(header::ACCESS_CONTROL_REQUEST_METHOD, "GET")
        .header(header::ACCESS_CONTROL_REQUEST_HEADERS, "authorization,content-type")
        .body(axum::body::Body::empty())
        .unwrap();

    let response = app.oneshot(req).await.unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let allow_creds = response.headers().get("access-control-allow-credentials");
    assert_eq!(
        allow_creds.and_then(|v| v.to_str().ok()),
        Some("true"),
        "preflight must echo ACA-Credentials=true for the browser to send cookies"
    );

    let allow_origin = response.headers().get("access-control-allow-origin");
    assert_eq!(allow_origin, Some(&origin));
}
```

NOTE: `build_production_cors_layer` doesn't currently exist as a public symbol — it's a private function in `main.rs`. Either (a) extract it into a public helper in the api crate, (b) duplicate the small bit of config in this test, or (c) test via the daemon's existing integration test infrastructure. Pick whichever is cheapest. The intent is: "given the production CORS config, a CORS preflight returns `Access-Control-Allow-Credentials: true`."

If the test setup is heavy, a simpler alternative: add a unit test in `main.rs` (or a small `cors_layer` test module) that asserts the `CorsLayer` produces a service whose preflight response includes `access-control-allow-credentials: true`. Use `tower::ServiceExt::oneshot` with a synthetic request.

**Step 2: Run the test to verify RED**

Run: `cargo test -p api --test cors_credentials_flag -- --test-threads=1`

Expected: FAIL — the current `cors_layer()` doesn't set `allow_credentials(true)`, so the preflight response omits the header.

**Step 3: Modify `cors_layer()`**

In `crates-v1/api/src/main.rs`, add `.allow_credentials(true)` to the layer construction (around lines 173-187):

```rust
fn cors_layer() -> Result<CorsLayer, Box<dyn std::error::Error>> {
    let mut layer = CorsLayer::new()
        .allow_methods([
            Method::GET,
            Method::POST,
            Method::PUT,
            Method::PATCH,
            Method::OPTIONS,
            Method::DELETE,
        ])
        .allow_headers([
            header::AUTHORIZATION,
            header::CONTENT_TYPE,
            HeaderName::from_static("x-request-id"),
        ])
        .expose_headers([HeaderName::from_static("x-request-id")])
        // Browser refuses to send httpOnly cookies cross-origin without this.
        // Required for `credentials: include` from direct-mode tastile-web.
        .allow_credentials(true);

    // ... rest unchanged
}
```

This is the entire change to the layer. The function already uses `allow_origin(parsed)` (a list of concrete origins) when `TASTILE_ALLOWED_ORIGINS` is set, which is the only valid combination with `allow_credentials(true)` per the CORS spec — wildcard origin + credentials is rejected by browsers.

**Step 4: Run the test to verify GREEN**

Run: `cargo test -p api --test cors_credentials_flag -- --test-threads=1`

Expected: PASS.

**Step 5: Run the broader API test suite to confirm no regression**

Run: `cargo test -p api -- --test-threads=1`

Expected: all suites pass.

**Step 6: Commit**

```bash
cd C:\Users\rebui\Desktop\tastile\tastile-core
git add crates-v1/api/src/main.rs crates-v1/api/tests/cors_credentials_flag.rs
git commit -m "feat(v1): enable allow_credentials in CORS layer for direct-mode cookies"
```

---

## Task 6: Add `TASTILE_ALLOWED_ORIGINS` to EC2 systemd env

**Files:** none (deployment configuration)

**Step 1: Verify the daemon instance is current**

The instance id for the tastile-core daemon was `i-0ec20b65596468a79` as of the 2026-07-28 incident. Memory `project_tastile_web_three_instances_20260706.md` tracks CF→EC2 origin drift.

```bash
aws ec2 describe-instances --instance-ids i-0ec20b65596468a79 \
  --query 'Reservations[].Instances[].State.Name' --output text
```

Expected: `running`. If not, stop and check with the user.

**Step 2: Read the current env file**

```bash
aws ssm send-command --instance-ids i-0ec20b65596468a79 \
  --document-name "AWS-RunShellScript" \
  --parameters '{"commands":["sudo cat /etc/tastile/tastile.env | grep -E \"^(TASTILE_ALLOWED_ORIGINS|TASTILE_ENV|TASTILE_WEB_BRIDGE_SECRET)=\" | sed -e \"s/=.*/=<REDACTED>/\""]}' \
  --output text
```

Expected: `TASTILE_ENV` is present, `TASTILE_ALLOWED_ORIGINS` is unset, `TASTILE_WEB_BRIDGE_SECRET` is present. If `TASTILE_ALLOWED_ORIGINS` is already set, stop and check with the user.

**Step 3: Update the env file (preserving other variables)**

Backup the file first:

```bash
aws ssm send-command --instance-ids i-0ec20b65596468a79 \
  --document-name "AWS-RunShellScript" \
  --parameters '{"commands":["sudo cp /etc/tastile/tastile.env /etc/tastile/tastile.env.bak.2026-07-29"]}' \
  --output text
```

Then append the new var:

```bash
aws ssm send-command --instance-ids i-0ec20b65596468a79 \
  --document-name "AWS-RunShellScript" \
  --parameters '{"commands":["sudo bash -c \"echo TASTILE_ALLOWED_ORIGINS=https://app.tastile.app,https://app.tastile.dev,http://localhost:3000 >> /etc/tastile/tastile.env\""]}' \
  --output text
```

**Step 4: Restart the daemon to pick up the new env**

```bash
aws ssm send-command --instance-ids i-0ec20b65596468a79 \
  --document-name "AWS-RunShellScript" \
  --parameters '{"commands":["sudo systemctl restart tastile-api.service && sleep 3 && sudo systemctl is-active tastile-api.service"]}' \
  --output text
```

Expected: `active`. Wait a moment for the daemon to come back:

```bash
aws ssm send-command --instance-ids i-0ec20b65596468a79 \
  --document-name "AWS-RunShellScript" \
  --parameters '{"commands":["sudo curl -sS -o /dev/null -w \"ready=%{http_code}\\n\" http://127.0.0.1:31400/v1/ready"]}' \
  --output text
```

Expected: `ready=200`.

**Step 5: Commit**

There is no file commit for this step; the env is part of the deployment. Note the env change in the closeout message (Task 9 Step 3).

---

## Task 7: Add preferences toggle UI

**Files:**
- Modify: `src/app/dashboard/preferences/general/page.tsx`

**Step 1: Write the failing test**

Add a vitest test next to `general/page.tsx`. (If existing test conventions for client components don't exist yet, mirror the pattern from `notificationsEnabled` tests in the same directory.)

Create `src/app/dashboard/preferences/general/direct-mode.test.tsx`:

```typescript
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock fetch so the toggle endpoint call doesn't actually fire
const fetchMock = vi.fn();

beforeEach(() => {
  vi.restoreAllMocks();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  Object.defineProperty(document, "cookie", {
    writable: true,
    value: "",
  });
});

describe("GeneralPage direct-mode toggle", () => {
  it("renders the toggle in the off state when the cookie is absent", async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, headers: new Headers() });
    const { default: GeneralPage } = await import("./page");

    render(<GeneralPage />);

    await waitFor(() => {
      // ...assertions on the Switch component's checked state
    });
  });

  it("POSTs /api/account/direct-mode when the switch is flipped on", async () => {
    // ... etc
  });
});
```

NOTE: The test setup for client components is heavier than unit tests. The minimum-viable test is:

1. Render `GeneralPage` with `cookie=""`.
2. Assert a Switch with label "ブラウザから直接 daemon に接続 (実験的)" is present and unchecked.
3. Click it → assert `fetch` was called with `POST /api/account/direct-mode`.

The actual UI label and component layout match the design §8 UX preferences toggle.

If testing the component is too heavy for this PR, defer the test and rely on the manual smoke test in Task 8 Step 3. The contract under test here is the toggle ↔ API endpoint round-trip, which is already covered by Task 2's `route.test.ts`.

**Step 2: Add the toggle section**

In `src/app/dashboard/preferences/general/page.tsx`, add a new `<section>` after the existing Security Lock section (around line 195). Place it before the closing `</div>`.

```typescript
// State and handler at the top of the component:
const [directDaemon, setDirectDaemon] = useState<boolean>(() => {
  if (typeof document === "undefined") return false;
  const match = document.cookie.split(/;\s*/).find((c) =>
    c.startsWith(`${COOKIE_DIRECT_DAEMON}=`),
  );
  return match === `${COOKIE_DIRECT_DAEMON}=1`;
});

const [directModeBusy, setDirectModeBusy] = useState(false);

async function setDirectMode(enabled: boolean) {
  setDirectModeBusy(true);
  try {
    const response = await fetch("/api/account/direct-mode", {
      method: enabled ? "POST" : "DELETE",
    });
    if (response.ok) {
      setDirectDaemon(enabled);
    }
  } finally {
    setDirectModeBusy(false);
  }
}

// Section JSX:
<section className="mt-8">
  <h2 className="mb-4 text-lg font-semibold text-foreground">Network</h2>
  <div className="flex items-center justify-between gap-4">
    <div>
      <p className="text-sm font-semibold text-foreground">
        ブラウザから直接 daemon に接続 (実験的)
      </p>
      <p className="mt-1 text-xs text-foreground-muted">
        有効にするとページ表示が速くなりますが、Cookie の SameSite 設定によっては
        一部ブラウザで失敗します
      </p>
    </div>
    <Switch
      checked={directDaemon}
      disabled={directModeBusy}
      onChange={(e) => setDirectMode(e.currentTarget.checked)}
    />
  </div>
</section>
```

Add the import at the top:

```typescript
import { COOKIE_DIRECT_DAEMON } from "@/lib/cognito/cookies";
```

**Step 3: Run lint + typecheck + tests**

Run: `bun run lint && bun run typecheck && bun test src/app/dashboard/preferences/general/`

Expected: exit 0 across the board. The page test (if added) passes; otherwise just lint + typecheck.

**Step 4: Commit**

```bash
cd C:\Users\rebui\Desktop\tastile\tastile-web
git add src/app/dashboard/preferences/general/page.tsx
git commit -m "feat(tastile-web): add direct-mode toggle to General Preferences"
```

---

## Task 8: Build web, deploy, production smoke test

**Files:** none (build + deployment)

**Step 1: Verify the broader tastile-web test suite is still green**

Run: `bun run lint && bun run typecheck && bun test`

Expected: all exit 0. If anything fails, fix before proceeding.

**Step 2: Build the Next.js production bundle**

Run: `bun run build`

Expected: clean build, exit 0. The `.next/` directory contains updated chunks referencing the new code paths.

**Step 3: Deploy the web bundle to production**

```bash
pwsh -File scripts/deploy-web.ps1 -InstanceId i-0ec20b65596468a79
```

(Note: per memory `project_tastile_web_three_instances_20260706.md`, the deploy script may need `-InstanceId` if the CFN AppInstanceId is stale. Use the current instance id.)

Expected: exit 0. The script packages the build, uploads via SSM, restarts `tastile-web.service`, and waits for `/v1/ready` to return 200.

**Step 4: Deploy the daemon bundle**

The daemon (tastile-core) needs the new `bearer_auth_result` + `cors_layer()` changes. Deploy via the standard core deploy flow:

```bash
cd C:\Users\rebui\Desktop\tastile\tastile-core
pwsh -File scripts/v1/deploy-core-v1.ps1
```

Expected: exit 0. The daemon restart is included in the script (systemd `tastile-api.service`).

Wait for `/v1/ready` to return 200:

```bash
aws ssm send-command --instance-ids i-0ec20b65596468a79 \
  --document-name "AWS-RunShellScript" \
  --parameters '{"commands":["sudo curl -sS -o /dev/null -w \"ready=%{http_code}\\n\" http://127.0.0.1:31400/v1/ready"]}' \
  --output text
```

Expected: `ready=200`.

**Step 5: Production smoke test — direct mode off (default)**

Open `https://app.tastile.app/dashboard` in a browser. DevTools → Network. Hard-reload.

- Confirm `/api/proxy/v1/...` requests are still happening (default proxy path)
- Confirm dashboard renders with tile list, active tile, notifications

**Step 6: Production smoke test — toggle on**

Open `/dashboard/preferences/general` → Network section. Flip the toggle.

DevTools Network panel should show:
- `POST /api/account/direct-mode` → 200, `Set-Cookie: tastile_direct_daemon=1`
- Subsequent REST calls go to `https://app.tastile.app/v1/...` (not `/api/proxy/v1/...`)
- Each direct call's response includes `Access-Control-Allow-Credentials: true` on the preflight
- Each direct call includes `Cookie: tastile_api_token=...` (visible in the request headers)

**Step 7: Production smoke test — Cookie fallback**

Manually expire the `tastile_api_token` cookie (DevTools → Application → Cookies → delete `tastile_api_token`). Hard-reload the dashboard.

Expected: dashboard still renders with `/v1/...` requests succeeding. The daemon's new Cookie-header fallback path returns the same principal.

If `tastile_uid` is also missing, the request falls through to bridge headers, then 401s — that's the existing behavior, not new.

**Step 8: Production smoke test — toggle off**

Re-open `/dashboard/preferences/general` → Network section. Flip the toggle off.

DevTools Network panel should show:
- `DELETE /api/account/direct-mode` → 200, `Set-Cookie: tastile_direct_daemon=; Max-Age=0`
- Hard-reload → subsequent REST calls return to `/api/proxy/v1/...`

---

## Task 9: Close the plan

**Files:**
- Modify: `docs/HARNESS.md` (if needed)
- Modify: `tastile-web/CLAUDE.md` (note in implementation history)

**Step 1: Verify the closeout**

- All tasks 1-8 committed cleanly.
- Production smoke tests passed.
- Pre-existing test failures (`FloatingMenu.test.tsx` DOM errors) untouched per memory `feedback_never_fix_pre_existing_out_of_scope.md`.

**Step 2: Hand off to user with**

- The 8 task SHAs (run `git log --oneline -8` in both repos)
- The daemon env-var change (`TASTILE_ALLOWED_ORIGINS=https://app.tastile.app,https://app.tastile.dev,http://localhost:3000` set on EC2)
- The SSM CommandIds from the deploys + smoke tests
- Confirmation that direct mode is now live and toggleable from `/dashboard/preferences/general`

**Step 3: Done**

This implementation plan is complete. Once the user confirms "go", proceed with Task 1 in the subagent-driven-development flow.