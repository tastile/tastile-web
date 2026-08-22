# tastile-web client-direct daemon access — design

> **Status:** Draft, brainstorm validated 2026-07-29. Not yet implemented.

---

## 1. Goal

Browsers talk to the daemon directly when a runtime flag is on, eliminating a same-origin proxy roundtrip for read APIs. The proxy is preserved for fallback and for callers that need server-side bridge headers (e.g. mobile API token minting, Cognito session bootstrap).

## 2. Architecture

```
Browser (https://app.tastile.app)
  │
  ├── mode = "direct"   ──► fetch https://app.tastile.app/v1/*  (credentials: include)
  │                                                            │
  │                                                            ▼
  │                                              nginx reverse proxy → 127.0.0.1:31400
  │                                                            │
  │                                                            ▼
  │                                                    tastile-core daemon
  │                                                            │
  │                                          reads Authorization: Bearer
  │                                          or tastile_api_token Cookie
  │
  └── mode = "proxy"    ──► fetch /api/proxy/v1/*              ──► [this PR] forwards
                                                              bridge headers AND
                                                              Authorization: Bearer
                                                              (already shipped 37e3344)
```

The daemon today already accepts `Authorization: Bearer <tastile_api_token>` (memory `feedback_auth_fall_through.md` + 2026-07-22 commit). The CORS middleware already exists with `TASTILE_ALLOWED_ORIGINS` env var. So the new code is mostly wiring + a runtime mode flag.

## 3. Mode flag

JS-readable cookie `tastile_direct_daemon`:

- `name: tastile_direct_daemon`
- `value: "1"` (direct) or absent (proxy)
- `path: /`, `httpOnly: false`, `secure: true` (prod), `sameSite: lax`
- Set/cleared by `POST /api/account/direct-mode` (auth-protected). Toggle endpoint reads the existing bridge auth path to confirm the caller is logged in, then mutates the cookie via the response `Set-Cookie`.

`getCoreClient()` reads `document.cookie` at construction time (not per-call — the cookie is stable per session). When `"1"`, the client uses direct mode; otherwise proxy. The flag is read once when the singleton is initialized, matching the existing `_client` cache in `endpoints.ts:971`.

## 4. Auth transport in direct mode

Browser → `https://app.tastile.app/v1/*`:

- `credentials: include` (Cookie attached automatically)
- `Authorization: Bearer <tastile_api_token>` set by `CoreClient` (already wired at `endpoints.ts:847-849`)
- Daemon reads the Bearer header first, falls through to bridge auth if missing (2026-07-22 commit)

The `tastile_api_token` cookie stays `httpOnly`. It travels with `credentials: include` because the browser auto-attaches same-origin cookies.

Cookie attributes currently set in `src/lib/cognito/cookies.ts:80-90`:
```
httpOnly: true, secure: isProd, sameSite: lax, path: "/"
```
No change needed. `secure=true` in production is required for any cross-port (443 → internal) trust path.

---

## 5. Daemon CORS changes

`crates/v1/api/src/main.rs:172-207` already implements `cors_layer()` with `TASTILE_ALLOWED_ORIGINS` env. Two gaps to close:

1. `.allow_credentials(true)` is **not set**. Without it, browsers block `credentials: include` requests. Required for `tastile_api_token` Cookie to be attached to cross-origin requests.
2. `Authorization` header is already in `.allow_headers()`. Good.

Changes:

- Add `.allow_credentials(true)` to `cors_layer()` in `crates/v1/api/src/main.rs:172-207`
- EC2 systemd `/etc/tastile/tastile.env`:
  ```
  TASTILE_ALLOWED_ORIGINS=https://app.tastile.app,https://app.tastile.dev,http://localhost:3000
  ```

`allow_origin(<list>)` from `TASTILE_ALLOWED_ORIGINS` returns concrete origins (no wildcard), which is the only valid combination with `allow_credentials(true)` per the CORS spec. The existing parse path already does this correctly.

## 6. Wire-up

Web client changes (small):

| File | Change |
| --- | --- |
| `src/lib/cognito/cookies.ts` | Export `COOKIE_DIRECT_DAEMON = "tastile_direct_daemon"` |
| `src/app/api/account/direct-mode/route.ts` | **New.** POST: set cookie `"1"`. DELETE: clear cookie. Reads `ensureBridgeAuth` to confirm caller is logged in. |
| `src/app/dashboard/preferences/general/page.tsx` | Add toggle UI bound to `COOKIE_DIRECT_DAEMON` + `localStorage` mirror |
| `src/lib/api/endpoints.ts` | `getCoreClient()` reads `document.cookie` for `tastile_direct_daemon`; when `"1"`, sets `useProxyBridge=false` + `baseUrl = ${window.location.origin}/v1` + `tokenProvider` returns `null` (browser attaches Cookie via `credentials: include`). When absent, existing proxy mode. |
| `src/lib/api/core-client.ts` (or endpoints.ts:852) | In direct mode, add `credentials: "include"` to the `fetchImpl` call. In proxy mode, no change. |
| `src/lib/upstream/use-sse-sync.ts` (or similar) | Keep SSE on proxy path. Direct mode only applies to REST calls. |

Daemon changes:

| File | Change |
| --- | --- |
| `crates/v1/api/src/handlers/common.rs::bearer_auth_result` | Extend to also read `Cookie: tastile_api_token=<token>` if `Authorization` header missing. Parse via existing pattern. |
| `crates/v1/api/src/main.rs::cors_layer` | Add `.allow_credentials(true)` |
| `/etc/tastile/tastile.env` on EC2 | Add `TASTILE_ALLOWED_ORIGINS=https://app.tastile.app,https://app.tastile.dev,http://localhost:3000` |

## 7. SSE stays on proxy

EventSource API doesn't support custom headers. Direct mode only applies to REST calls (fetch). SSE continues to go through `/api/proxy/v1/sse/...` because that path is same-origin and the proxy can inject bridge headers.

## 8. UX: preferences toggle

`/dashboard/preferences/general` gets a new section:

- Label: "ブラウザから直接 daemon に接続 (実験的)"
- Switch bound to `tastile_direct_daemon` cookie + `localStorage` mirror
- Hint: "有効にするとページ表示が速くなりますが、Cookie の SameSite 設定によっては一部ブラウザで失敗します"
- Reset to default: ボタン一つで `DELETE /api/account/direct-mode`

Loading the page reads the cookie value into the switch state. Toggling the switch POSTs to `/api/account/direct-mode` and updates `localStorage`. On next page load, `getCoreClient()` reads the cookie (server-canonical) and falls back to `localStorage` if cookie is missing (transient state during toggle).

## 9. Rollback

If direct mode breaks production:

1. User-level: switch off in `/dashboard/preferences/general`, or
2. Per-deploy: set env `TASTILE_DIRECT_DAEMON_DISABLED=1` on EC2 systemd and restart `tastile-web.service` (forces proxy for everyone — this flag is read in `endpoints.ts` and overrides the cookie)
3. Daemon-level: remove `.allow_credentials(true)` from `cors_layer()`. Browser blocks direct-mode calls; proxy still works because `/api/proxy` is same-origin.

## 10. Testing

- Unit (web): `getCoreClient()` returns direct-mode client when cookie is set; proxy otherwise. Toggle endpoint round-trips the cookie. `localStorage` mirror reflects cookie state.
- Unit (daemon): `bearer_auth_result` reads Cookie header as fallback. CORS layer test verifies `Access-Control-Allow-Credentials: true` is returned for configured origins.
- Integration: `bun run dev` + DevTools Network panel. Toggle on, observe `/v1/...` requests with `Cookie: tastile_api_token=...`. Toggle off, observe `/api/proxy/v1/...`.
- E2E (production): smoke test as in plan §6 of 2026-07-29.

## 11. Out of scope

- `/api/proxy/*` deprecation (kept indefinitely)
- Mobile API token path (uses `/api/mobile/api-token`, separate)
- SSE direct mode
- Local dev tunnel (e.g. ngrok) support
- Migrating `/api/mobile/api-token` off the proxy (currently needs bridge headers)