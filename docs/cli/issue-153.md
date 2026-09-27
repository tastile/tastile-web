# Issue #153 — `/cli/authorize` + `/api/cli/token` (browser-mediated PKCE)

This document captures the web-side delivery of Issue #153: the endpoints
that `tastile-cli` v0.1.0 calls during `auth login`. The CLI side is
tracked at [`tastile/tastile-cli` PR #3](https://github.com/tastile/tastile-cli/pull/3),
and the Core side (granular API-token scopes + AuthContext + handler
inventory) at [`tastile/tastile-core` PR #176](https://github.com/tastile/tastile-core/pull/176).

## Wire contract

```
GET {web_origin}/cli/authorize
  ?response_type=code
  &client_id=tastile-cli
  &redirect_uri=http://127.0.0.1:<port>/callback
  &scope=tastile.read tastile.write
  &state=<22-char-base64url-csrf>
  &code_challenge=<43-char-base64url-sha256(verifier)>
  &code_challenge_method=S256
  → 302 {redirect_uri}?code=<opaque>&state=<echo>

POST {web_origin}/api/cli/token
  body: { "code", "code_verifier", "redirect_uri" }   (exactly 3 keys)
  no Cookie header
  → 200 { "token", "expires_at", "subject" }
  → 4xx { "error", "detail" }   (400 / 409 / 410)
```

The CLI integration test
`tastile-cli/crates/tastile-auth/tests/auth_flow.rs:602` is the contract
reference; the message returned for a 409 contains the phrase
`already used` and the success shape is exactly
`{ token, expires_at, subject }`.

## Architecture

- `src/lib/migrations/web-cli-grants.ts` — single-transaction DDL for the
  `web_cli_auth_grant` and `web_cli_auth_pending_consent` tables. Bootstrap
  is lazy on first store access, mirroring the BetterAuth pool pattern so
  `next build` without `TASTILE_AUTH_DATABASE_URL` does not crash.
- `src/shared/auth/cli/clients.ts` — registered client set. Unknown
  `client_id` returns `400 invalid_client` without leaking registered
  names; `intersectScopes` produces the canonical-sorted form of the
  intersection between the requested and registered scopes (empty → `400
  invalid_scope`).
- `src/shared/auth/cli/redirect-uri.ts` — loopback allowlist. The exact
  host check (`hostname !== "127.0.0.1"`) catches the
  `127.0.0.1.attacker.example` suffix-confusion attack; the URL parser
  handles credentials / fragment / query / path strictly.
- `src/shared/auth/cli/pkce.ts` — `verifyS256` (timingSafeEqual), RFC 7636
  Appendix B vector; `generateGrantCode` (32 random bytes → base64url-no-
  pad → 43 chars); `hashGrantCode` (sha256 hex).
- `src/shared/auth/cli/grant-store.ts` — atomic claim via
  conditional UPDATE; classification SELECT for `invalid_grant` /
  `already_used` / `gone` / `pkce_mismatch` / `redirect_uri_mismatch`.
  The grant code is **never** stored in plaintext — only its sha256 hex.
- `src/shared/auth/cli/pending-consent-store.ts` — DB-backed pending
  consent row (5-minute TTL); `consumed_at` provides the replay defense
  via a conditional UPDATE.
- `src/shared/auth/cli/core-mint.ts` — wraps Core's `/v1/api-tokens` over
  the bridge headers; carries the intersected scopes and the explicit
  30-day `expires_at` so Core does not default.

## Consent flow split

Per plan D6 the `/cli/authorize` flow is split into three Next.js files:

1. `src/app/cli/authorize/route.ts` (GET Route Handler) — protocol
   validation (7-param shape), loopback/PKCE/scope checks, session
   resolution, DB-backed pending consent insert, 302 to `/cli/consent`.
2. `src/app/cli/consent/page.tsx` (Server Component) — Mantine v9 UI;
   loads the pending consent row by `tid`, renders the consent screen or
   an explanatory page for missing / expired / consumed rows (HTTP 410
   is not emitted from Server Components, so the page renders the same
   copy as the POST handler's 410 case).
3. `src/app/cli/consent/route.ts` (POST Route Handler) — re-resolves the
   session, verifies the `user_sub` matches the pending row, marks the
   row consumed (replay defense), then either mints the grant (allow) or
   302s with `error=access_denied` (deny).

## Scope model

Registered scopes for `tastile-cli` v0.1.0: `["tastile.read",
"tastile.write"]`. The minted Core token carries exactly the
**intersection** between what the CLI requested and what the client is
registered for; never `"all"`. Granular enforcement lives in the sibling
Core PR (ScopeSet parser, AuthContext, per-handler `require_scope`); the
Web side stores the intersection and forwards it to Core.

## Failure modes

- **Core mint fails (502)** after the grant is consumed: the CLI must
  re-authorize. Documented behavior, not a bug; the alternative (a
  two-phase pending → consuming → consumed table) would add a recovery
  job out of scope for v0.1.0.
- **Pending consent replay**: a second POST with the same `tid` finds
  `markPendingConsumed` returning `false` and is rejected with 410.
- **Session swap between GET and POST**: the POST handler re-resolves the
  BetterAuth session and compares the `user_sub` against the row stored
  at GET-time. Mismatch → 403.
- **Client deregistered between authorize and exchange**: the
  `consumeGrantOnce` post-check verifies the returned `client_id` is
  still registered; otherwise → `400 invalid_grant`.

## TTL rationale

- **Grant TTL = 5 minutes.** Window between `/cli/authorize` redirect and
  `/api/cli/token` POST. Matches plan D1; partial index
  `WHERE used_at IS NULL` makes cleanup a single DELETE.
- **CLI token TTL = 30 days.** Mirrors the BetterAuth session lifetime at
  `src/shared/auth/better-auth/server.ts:93`. Long enough that the CLI
  does not silently lose its credential mid-use; short enough that
  revocation has predictable effect. Verified by `core-mint.test.ts`
  (asserted in `[now + 30d − 60s, now + 30d + 60s]`).

## Production safety (D8)

- `code` / `code_verifier` / `state` / bearer / bridge secret are never
  logged in plaintext. Only `code_hash` (sha256 hex) appears in debug
  logs.
- `/api/cli/token` does not call `getAuth().api.getSession` — it does
  not read cookies or the `Authorization` header. The
  `route.test.ts` includes a spy assertion that `getSession` was not
  called.
- `E2E_BYPASS_AUTH=1` does NOT short-circuit `/cli/authorize` or
  `/api/cli/token`. The handlers explicitly reject with `400
  bypass_not_permitted`, so a misconfigured production-like environment
  cannot mint a real token via the dev bypass.

## AC ↔ evidence

| AC | Evidence |
| --- | --- |
| 1 | `src/app/cli/authorize/route.test.ts` (valid 7-param query → 302) + `src/app/cli/consent/page.tsx` |
| 2 | `src/app/api/cli/token/route.test.ts` (strict 3-key body + content-type) |
| 3 | `src/shared/auth/cli/clients.test.ts` (unknown client → undefined, no leakage) |
| 4 | `src/shared/auth/cli/redirect-uri.test.ts` (suffix-confusion, credentials, query, fragment) |
| 5 | `src/app/api/cli/token/route.test.ts` + sibling Core PR `scope_enforcement.rs` |
| 6 | `src/shared/auth/cli/grant-store.test.ts` + `src/app/api/cli/token/route.test.ts` |
| 7 | `src/shared/auth/cli/pkce.test.ts` (RFC 7636 vector) + `route.test.ts` |
| 8 | `src/shared/auth/cli/grant-store.test.ts` (redirect_uri_mismatch) + `route.test.ts` |
| 9 | `src/shared/auth/cli/grant-store.integration.test.ts` (N=8 concurrent) |
| 10 | `src/app/api/cli/token/route.test.ts` (`x-tastile-web-session-user` carries only `consumed.userSub`) |
| 11 | `src/app/api/cli/token/route.test.ts` mirrors `auth_flow.rs` AC 1-9 |

## Cross-references

- Plan: `/home/basic/.claude/plans/staged-napping-scroll.md` (D1-D10, A.5,
  A.6, B).
- Core sibling: `tastile/tastile-core#176` (granular scopes, AuthContext,
  handler inventory).
- CLI sibling: `tastile/tastile-cli#3` (`auth login` switches to
  `HttpServerBridge::fetch_token`).
- Bridge auth contract: `.agents/skills/tastile-precommit-review` SKILL.md.
