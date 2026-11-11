# T05 evidence — Web → Core auth in the isolated verification stack (2026-11-12)

Plan: `tastile/tastile-root#105` / G1 / **T05** (due 11/19).
Acceptance: G1 ACCEPT — "有料クラウドなし、mockに頼らず固定SHA/コマンド/ログ付きで Web login → 認証付き Core API が成功。運用環境の状態が不変。"

Everything below runs against the **isolated verification stack only**
(`tastile-verify-{db,api,worker}` on Colima, loopback `127.0.0.1:31400`,
`TASTILE_DELIVERY_PROVIDER=fake`). No operational environment is contacted,
read or written.

## Fixed SHAs / versions

| Component | Value |
| --- | --- |
| tastile-web | `release-1-1-0` = `a782a2ff3a664d01bfbb642b898a9cdb8808f9a6` (contains #205 dep bump, #204 bridge fix) |
| Next.js | 16.4.2 (Turbopack dev server) |
| lockfile | `next@16.4.2`, `better-auth@1.7.7`, `zod@4.6.6` |
| Core (verification stack) | `tastile-core-verify:local` built from `tastile-core`, `/v1/health` → `version: 1.0.2` |
| Browser | Playwright Chromium (headless), real rendering + real network |

## Commands

```bash
# Web deps — frozen lockfile, no Infisical, no paid cloud
cd tastile-web && bun install --frozen-lockfile

# Dev server started directly (bypasses scripts/run-with-infisical.mts)
TASTILE_ENV=development \
NEXT_PUBLIC_APP_URL=http://localhost:3001 \
CLOUD_API_BASE=http://localhost:31400 \
NEXT_PUBLIC_TASTILE_CORE_URL=http://localhost:31400 \
TASTILE_USE_RUST_CORE=1 \
TASTILE_RUST_API_URL=http://127.0.0.1:31400 \
TASTILE_WEB_BRIDGE_SECRET=<verification-stack secret> \
TASTILE_AUTH_DATABASE_URL=postgres://tastile:tastile-verify-only@127.0.0.1:55432/tastile_auth \
PORT=3001 bun run next dev

# Vulnerability gate (web#200)
bun audit --production
# => No vulnerabilities found (checked 437 packages)
```

## Results

### Sign-up path — 6/6 PASS

| # | Check | Result |
| --- | --- | --- |
| 1 | `/auth/signup` renders (`data-testid=signup-panel`) | PASS |
| 2 | sign-up submit reaches `/dashboard` | PASS (via `/api/auth/bridge` 307) |
| 3 | cookies present | PASS — `better-auth.session_token`, `better-auth.session_data`, **`tastile_api_token`** |
| 4 | in-browser `fetch("/api/proxy/v1/tiles")` | PASS — **200**, real rows (`title: 休憩`) |
| 5 | Core-bound proxy responses observed in the browser | PASS — 200s present |
| 6 | screenshot | PASS — `signup-dashboard.png` |

Observed Core-bound requests:

```
307 /api/auth/bridge?next=%2Fdashboard
200 /api/proxy/v1/tiles
```

### Login path (existing user) — 3/3 PASS

| # | Check | Result |
| --- | --- | --- |
| 1 | `/login` → `/dashboard` | PASS |
| 2 | login issues `tastile_api_token` | PASS |
| 3 | `fetch("/api/proxy/v1/tiles")` with the login session | PASS — **200**, 210,091 bytes |

Test account (verification-only, throwaway DB):
`t05-2026-11-11T15-54-10-438Z@example.test` / `t05-verify-pass-123`.

### Dependency gate (web#200)

```
$ bun audit --production
No vulnerabilities found (checked 437 packages)
```

`main` still carries `next@16.3.4` / `better-auth@1.7.3`; the fix lives on
`release-1-1-0`. **Production re-deploy is a separate release decision
(PR #173) and is not part of this plan.**

## External auth dependencies — residual

**None for this flow.** The server was started with `bun run next dev`
directly, not the `dev` script, so `scripts/run-with-infisical.mts` (and
therefore Infisical) was never invoked. Authentication is:

- Better Auth with its own tables in the verification-only `tastile_auth`
  PostgreSQL database (`user`, `session`, `account`, `verification`,
  `twoFactor` — 5 tables confirmed present),
- bridge secret from the verification stack (`TASTILE_WEB_BRIDGE_SECRET`),
- no external IdP, no Cognito, no paid cloud, no email delivery.

Residual external dependencies that remain for *other* paths (not exercised
here): Infisical for `dev`/`build` scripts and for device config supply,
and real email delivery for production sign-up verification. Both are
recorded as open items in `tastile-root#105` G0/解消項目 4.

## What is NOT proven here

- Production / `main`-branch behaviour (this is `release-1-1-0`).
- Any write against an operational environment (none was attempted).
- Android / desktop clients.
