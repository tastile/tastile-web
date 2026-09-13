# Dev → Prod API Switch

This document explains how to point a local dev server at the public production
API (`https://api.tastile.app`) for smoke testing, without standing up a separate
deployment. It is the canonical workflow when a developer needs to reproduce a
prod-only data shape, exercise a release candidate backend, or validate a
client-side fix against real prod data.

## Why

- Smoke-test client behavior against the production `tastile-core` API
  without a dedicated staging environment.
- Validate a frontend hotfix against prod data when local fixture drift is
  suspected.
- Reuse the same `bun dev` process — only the upstream URL changes.

## Variables at a glance

| Variable | Default in `.env.development` | What it controls |
| --- | --- | --- |
| `NEXT_PUBLIC_TASTILE_CORE_URL` | `http://127.0.0.1:31400` | Browser-side canonical API base URL. First preference in `src/shared/api/endpoints.ts → resolveCoreBaseUrl()`. |
| `NEXT_PUBLIC_DAEMON_BASE_URL` | `http://localhost:31400` | Legacy alias. Kept for backward compatibility; the canonical var above takes priority. |
| `CLOUD_API_BASE` | `http://127.0.0.1:31400` | Server-side target for `/api/proxy` (`src/app/api/proxy/[...path]/route.ts` and `src/lib/upstream/cloud-api-base.ts`). Required at runtime. |
| `NEXT_PUBLIC_CORE_DIRECT_MODE` | `0` | When `1`, the browser calls `CLOUD_API_BASE` directly and skips the proxy. Requires CORS + a valid bearer token. |
| `NEXT_PUBLIC_E2E_BYPASS_AUTH` | unset | When `1`, the browser uses the E2E default `http://127.0.0.1:31400` regardless of the vars above. Leave `0` for prod smoke tests. |

See `.env.development` and `.env.production` for the full surface.

## Switching the dev server to the prod API

There are two equivalent ways. Pick whichever is faster for the moment.

### Option A — edit `.env.development`

Change these two lines:

```bash
NEXT_PUBLIC_TASTILE_CORE_URL=https://api.tastile.app
CLOUD_API_BASE=https://api.tastile.app
```

The dev server reads `.env.development` on startup, so restart `bun dev` after
editing. To revert, restore the two lines to their `http://127.0.0.1:31400`
defaults.

### Option B — `bun run dev:prod` (no edit)

`package.json` defines a one-shot script that injects the prod base URL into
the dev process without touching the file on disk:

```bash
bun run dev:prod
```

The script is equivalent to:

```bash
NEXT_PUBLIC_TASTILE_CORE_URL=https://api.tastile.app \
CLOUD_API_BASE=https://api.tastile.app \
NEXT_PUBLIC_E2E_BYPASS_AUTH=0 \
bun dev
```

The override only lives for that one `bun dev` process — closing the terminal
reverts to whatever is in `.env.development`.

## Direct mode caveat

`NEXT_PUBLIC_CORE_DIRECT_MODE=1` instructs the browser to call
`CLOUD_API_BASE` directly, bypassing `/api/proxy`. This is **off by default**
because:

- The prod API must allow CORS from `http://localhost:3000`. The prod
  allow-list is intentionally tight; smoke tests rarely need this.
- The browser must hold a valid bearer token. `/api/proxy` forwards the
  BetterAuth session cookie server-side, so the proxy bridge is the simplest
  way to authenticate with prod using local credentials.
- Direct mode skips the bridge secret and cookie translation, so
  server-only-secret leaks (if any are introduced later) are easier.

Leave `NEXT_PUBLIC_CORE_DIRECT_MODE=0` for normal dev — the proxy handles CORS
and auth automatically.

## Auth note

The dev environment authenticates the user locally via BetterAuth. When a
request flows through `/api/proxy`, the server translates the BetterAuth
session into a `Bearer` header for the prod API (or `x-tastile-web-bridge-secret`
+ `x-tastile-web-session-user` if `COOKIE_USER_SUB` is set). This means:

- You must be signed in locally with an account that exists in the prod
  `tastile-core` API. Local-only accounts cannot read prod data.
- The BetterAuth cookies stay in the dev origin (`http://localhost:3000`); the
  prod API only ever sees the forwarded `Bearer` (or bridge-secret pair), not
  the cookie itself.
- If the prod API returns `401`, sign out and back in locally to refresh the
  session token before retrying.

## Troubleshooting

- **Browser stuck on "Loading…"** — `CLOUD_API_BASE` is unset on the server.
  Restart `bun dev` after editing `.env.development`, or confirm the `dev:prod`
  script actually ran in the current shell (env vars only apply to the spawned
  process).
- **401 from the proxy** — sign in via BetterAuth first. The proxy needs either
  `COOKIE_API_TOKEN` or `COOKIE_USER_SUB` to be present. The login redirect
  sets both; a hard reload before login will not.
- **CORS error in the browser console** — direct mode is on, but the prod API
  does not allow `http://localhost:3000`. Set `NEXT_PUBLIC_CORE_DIRECT_MODE=0`
  so requests flow through `/api/proxy` (same-origin, no CORS).
- **Still talking to the local daemon** — verify the env vars are exported in
  the shell that runs `bun dev`. Variables set in a sub-shell (e.g. inside a
  `cd && bun dev` one-liner) do not leak to the parent process; the override
  is per-process.
