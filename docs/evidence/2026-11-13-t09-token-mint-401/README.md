# T09 — mobile token mint / 401 re-auth verification (2026-11-13)

Issue: `tastile/tastile-root#105` G2 / **T09** — Web #197/#199 mobile token 422 fix verification
(Core-side token mint + 401 re-authentication path).
Isolated stack only: `tastile-root/deploy/verify-stack` parallel-instance recipe.
No operational VM, no production DB, no paid cloud, no real notifications
(`TASTILE_DELIVERY_PROVIDER=fake`, compose default). All timestamps **UTC**.

## Fixed SHAs / image

| Component | Value |
| --- | --- |
| tastile-core | `db2ab71885773a86fe9f5fd65490e799ac50811b` (`origin/release-1-1-0` head; contains `db2ab718`+), built from worktree `/Users/rebui/orca/workspaces/tastile-core/t07-e2e` (detached, same SHA) |
| tastile-web | `f9f223e661ea973ae7bc950175327c0d0e601d8a` (`f9f223e6`, after #199 → #196), worktree `/Users/rebui/work/tastile-web-t09` (detached) |
| image | `tastile-core-verify:t09-db2ab718` = docker id `19bcc85b2ae2`, created 2026-11-12 23:06:05 +0900 (build fully cached; `up --build -d` wall time 9.8 s, no recompile) |
| API (loopback) | `127.0.0.1:31409` (`TASTILE_API_PORT=31409`) |
| PG (loopback) | `127.0.0.1:55439` (`TASTILE_VERIFY_PG_PORT=55439`) |
| Web dev server | `http://localhost:3009` (`PORT=3009`) |
| compose project / prefix / volume | `tastile-verify-t09` / `tastile-verify-t09` / `tastile-verify-t09-pgdata` |
| bridge secret | per-instance random (`/tmp/verify-t09-bridge-secret.txt`, value not recorded) |
| notification provider | `fake` |

Other lanes' containers (`tastile-verify-{db,api,worker}`, `tastile-verify-t06-*`, `t06-262-pg`) were not started, stopped, or modified.

## Commands (exact)

```bash
# env (recorded at /tmp/t09-env.sh)
export TASTILE_VERIFY_PREFIX=tastile-verify-t09
export TASTILE_CORE_DIR=/Users/rebui/orca/workspaces/tastile-core/t07-e2e   # detached at db2ab718
export TASTILE_CORE_TAG=t09-db2ab718
export TASTILE_API_PORT=31409 TASTILE_VERIFY_PG_PORT=55439
export TASTILE_ALLOWED_ORIGINS=http://localhost:3009,http://127.0.0.1:3009
openssl rand -hex 24 > /tmp/verify-t09-bridge-secret.txt
export TASTILE_WEB_BRIDGE_SECRET=$(cat /tmp/verify-t09-bridge-secret.txt)

# 1) stack
cd /Users/rebui/work/tastile-root/deploy/verify-stack
docker compose -p tastile-verify-t09 up --build -d   # image cached; 9.8 s

# fresh DB -> api/worker crash-loop on `relation "v1_migration" does not exist` (expected)
docker run --rm --network tastile-verify-t09_default \
  -e TASTILE_DATABASE_URL=postgres://tastile:tastile-verify-only@db:5432/tastile_verify \
  -e DATABASE_URL=postgres://tastile:tastile-verify-only@db:5432/tastile_verify \
  -e TASTILE_DATABASE__MAX_CONNECTIONS=10 -e AWS_EC2_METADATA_DISABLED=true \
  tastile-core-verify:t09-db2ab718 /app/migrate_run     # exit 0, silent; 66 rows in v1_migration

# 2) Better Auth store for THIS instance's DB
TASTILE_VERIFY_PREFIX=tastile-verify-t09 bash bootstrap-web-auth.sh   # -> tastile_auth, 5 tables

# 3) web deps + dev server
cd /Users/rebui/work/tastile-web-t09 && bun install --frozen-lockfile   # 659 packages, 4.53 s
TASTILE_ENV=development NEXT_PUBLIC_APP_URL=http://localhost:3009 \
NEXT_PUBLIC_APP_HOST=localhost NEXT_PUBLIC_APEX_HOST=apex.tastile.local \
CLOUD_API_BASE=http://127.0.0.1:31409 NEXT_PUBLIC_TASTILE_CORE_URL=http://localhost:31409 \
NEXT_PUBLIC_DAEMON_BASE_URL=http://localhost:31409 TASTILE_USE_RUST_CORE=1 \
TASTILE_RUST_API_URL=http://127.0.0.1:31409 \
TASTILE_WEB_BRIDGE_SECRET=$(cat /tmp/verify-t09-bridge-secret.txt) \
TASTILE_AUTH_DATABASE_URL=postgres://tastile:tastile-verify-only@127.0.0.1:55439/tastile_auth \
PORT=3009 bun run next dev
```

## Step results

| # | Step | Result | Evidence |
| --- | --- | --- | --- |
| 1 | Stack up, migrate, `/v1/health` 200, `/v1/ready` = expected migration | **PASS** | `10-health.json` (`{"status":"ok","database":"reachable","bridge_secret":"present","version":"1.0.2"}`), `11-ready.json` (`ready` → `V1_073__flow_horizon_dirty_from`), `12-compose-ps.txt` (db healthy, api/worker running), `13-image.txt`, `14-migrations.txt` (66 rows, max `V1_073__flow_horizon_dirty_from`) |
| 2 | Web :3009 up, fresh user signed up (`t09-1794497239@t09.test`), session cookie established | **PASS** | `00-signup.json` (HTTP 200, `better-auth.session_token` cookie in `/tmp/t09-cookies.txt`) |
| 3 | **Mint path (web#197 regression)**: `POST /api/mobile/api-token` with session cookie → **200**, body contains real `expires_at` (`2027-02-10T15:27:28.628Z`) | **PASS** | `01-mint-response.json`. Pre-fix behavior was `422 {"kind":0,"message":"expires_at is required"}` (core returned that validation error when `expires_at` was omitted; core now requires it at `crates-v1/api/src/handlers/auth.rs:168`, "D-1.1 (ADR-0010): `expires_at` is required … Omitting the field is a 400 Validation error."; web now always sends it, `src/app/api/mobile/api-token/route.ts:41`, 90-day TTL via PR #199). The post-fix route cannot reproduce the 422 by construction — the fix removes the omission. |
| 4 | **Core accepts the minted token**: `GET /v1/active-tile` → **200** (`null` body, no active tile), `GET /v1/tiles` → **200** (seeded 休憩 tile list) | **PASS** | `02-core-active-tile-with-minted-token.json`, `03-core-tiles-with-minted-token.json` |
| 5 | **401 path**: token revoked via Core API reachable as `DELETE /api/account/tokens/{id}` (web proxy → Core `DELETE /v1/api-tokens/{id}`); post-revoke `GET /v1/active-tile` → **401** `{"kind":1,"message":"token revoked"}`, `GET /v1/tiles` → **401** (body says `missing or invalid x-actor-id header` — see O2) | **PASS (with observation O2)** | `04-web-revoke-response.json` (web proxy returned 500 — see O1), `05-core-tiles-after-revoke.json`, `06-core-active-tile-after-revoke.json`, `15-token-rows.txt` (`revoked = t` for `01a1d05e-fe30-7a93-82f3-51408a03bf5c`) |
| 6 | **Re-mint + retry-once (Android `TokenRefresher` contract replayed at HTTP level)**: session still valid → `POST /api/mobile/api-token` → **200**, new token `expires_at=2027-02-10T15:30:24.685Z`; retry step-4 requests with the new token → `GET /v1/active-tile` **200**, `GET /v1/tiles` **200** | **PASS** | `07-remint-response.json`, `08-core-active-tile-after-remint.json`, `09-core-tiles-after-remint.json` |

Raw token values were redacted from the evidence files (`<REDACTED>`); ephemeral copies live in
`/tmp/t09-token1.txt` / `/tmp/t09-token2.txt` (verification-only).

## Observations / contract notes (reported, not papered over)

- **O1 — Web token-revoke proxy is broken (500 on success upstream).**
  `DELETE /api/account/tokens/[id]` → web proxy forwards to Core `DELETE /v1/api-tokens/{id}`,
  Core answers **204 No Content**, and the proxy then does
  `new NextResponse(text, { status: 204 })`, which throws
  `TypeError: Response constructor: Invalid response status code 204` → web returns **500**
  (`src/app/api/account/tokens/[id]/route.ts:47`). The revocation itself **succeeded**
  (verified at the DB level: `revoked = t`, and the stale token gets 401). This is a real,
  separate web bug (account token deletion appears to fail to any client) — out of T09 scope;
  flagged for a follow-up fix rather than silently worked around.
- **O2 — 401 body for `/v1/tiles` is misleading.** After revocation, `/v1/active-tile` returns
  `{"kind":1,"message":"token revoked"}` (accurate) while `/v1/tiles` returns
  `{"kind":1,"message":"missing or invalid x-actor-id header"}` (the request carried no
  `x-actor-id` header in either call, yet the pre-revoke call succeeded with 200). Status code
  401 is correct in both; the message string on the `/v1/tiles` path is wrong/confusing.
  Core-side cosmetic issue, reported here, not blocking.
- **O3 — `/v1/timeline` needs a `start` query param** (`400 Failed to deserialize query string`);
  not needed for the mint/401 contract.
- **O4 — web comment drift**: `src/app/api/mobile/api-token/route.ts` claims "Android … does not
  re-mint on 401", but Android PR #93 (merged, branch `92`) implements discard → re-mint →
  retry-once. Comment only; no behavior impact.

## Evidence file index

| File | Content |
| --- | --- |
| `00-signup.json` | fresh-user signup response (200; token redacted) |
| `01-mint-response.json` | mint #1: 200, id `01a1d05e-…`, `expires_at=2027-02-10T15:27:28.628Z` (token redacted) |
| `02-…`, `03-…` | Core 200 responses with minted token (`active-tile`, `tiles`) |
| `04-web-revoke-response.json` | web proxy body for the revoke call (500 — see O1; upstream 204) |
| `05-…`, `06-…` | Core 401 responses with the revoked token |
| `07-remint-response.json` | mint #2: 200, id `01a1d061-…`, `expires_at=2027-02-10T15:30:24.685Z` (token redacted) |
| `08-…`, `09-…` | Core 200 responses with the re-minted token |
| `10-health.json`, `11-ready.json` | `/v1/health` 200, `/v1/ready` = `V1_073__flow_horizon_dirty_from` |
| `12-compose-ps.txt`, `13-image.txt`, `14-migrations.txt`, `15-token-rows.txt`, `16-timestamps.txt` | stack state, image id, migration/token rows |

## Teardown (2026-11-12T15:40Z)

Performed after evidence capture, mirroring the T07 pattern:

```bash
pkill -f "next dev"                 # web dev server on :3009 stopped
source /tmp/t09-env.sh
docker compose -p tastile-verify-t09 down -v
```

- containers `tastile-verify-t09-{db,api,worker}` removed, volume `tastile-verify-t09-pgdata`
  removed, network `tastile-verify-t09_default` removed (exit 0).
- image `tastile-core-verify:t09-db2ab718` (`19bcc85b2ae2`) kept.
- other lanes untouched and still running: `tastile-verify-{db,api,worker}`, `tastile-verify-t06-*`, `t06-262-pg`.
