# H — Auth Bridge

## 目的 (Purpose)

Align the bridge auth contract between `tastile-web` and `tastile-core` so QuickCreate submissions authenticate correctly via bridge mode (not the `E2E_BYPASS_AUTH` shortcut). E2E_BYPASS_AUTH was working by accident — bridge auth has never been validated against a real local core because the secrets did not line up.

## Auth contract

`crates-v1/api/src/handlers/common.rs:733` defines `authenticate()` with a 3-tier priority order:

1. **`Authorization: Bearer <raw>`** — SHA-256 lookup in `v1_api_token` then `v1_session`. Falls through on absent/unknown (does **not** 401). Only errors on revoked/expired/wrong scope/DB error. Scope must equal `"all"` (`common.rs:799`).
2. **Bridge auth** (`bridge_auth_from_headers`, `common.rs:801`) — requires **both** headers below. On success, calls `ensure_bridge_owner_provisioning` (`common.rs:758-766`) which inserts a `v1_subject` row + seeds the V1_015 default 休憩 Recurring in one transaction.
3. **`x-owner-id` / `x-actor-id`** — **non-production only**, hard-blocked when `TASTILE_ENV ∈ {production, prod}` (`common.rs:25`).

## Bridge header spec

| Header | Value | Source |
|---|---|---|
| `x-tastile-web-bridge-secret` | exact match against `TASTILE_WEB_BRIDGE_SECRET` env var | `common.rs:810` |
| `x-tastile-web-session-user` | cognito sub (or any non-empty string in dev) | `common.rs:801` |

Server derives owner UUID deterministically:

```rust
Uuid::new_v5(&Uuid::NAMESPACE_OID, user_sub.as_bytes())
```

cited at `common.rs:823`. The same `user_sub` therefore always maps to the same owner_id — useful for e2e determinism.

## Web-side wiring

`src/app/api/proxy/[...path]/route.ts` is the only path that injects bridge headers (or bypass headers) before forwarding to core:

- `E2E_BYPASS_AUTH=1` → sets `x-owner-id` / `x-actor-id` = `00000000-0000-0000-0000-000000000001`. Works **without** bridge secret. Existing Playwright suite relies on this.
- `COOKIE_USER_SUB` present → sets `x-tastile-web-bridge-secret` + `x-tastile-web-session-user` (bridge mode).
- Otherwise → 401.

`.env.development` (line 26) sets `E2E_BYPASS_AUTH=1`, which means current QuickCreate submissions never exercise the bridge path.

## Mismatch diagnosis

| Side | Variable | Value |
|---|---|---|
| web `.env.development:26` | `TASTILE_WEB_BRIDGE_SECRET` | `E5SzuyY3s8Sz0-...` (real value, redacted) |
| core `scripts/wslc/up-v1.sh:17` | `BRIDGE_SECRET` (default) | `wslc-dev-bridge-secret` |

The two are **not aligned**. As long as `E2E_BYPASS_AUTH=1` is set, this does not surface — but the moment we want to validate the real bridge path (sub-project A's "production-mode" verification), the mismatch will cause a 401 from `bridge_auth_from_headers` at `common.rs:810`.

## Fix options

| Option | Action | Tradeoff |
|---|---|---|
| **A** (recommended for now) | `export BRIDGE_SECRET=<web secret>` before `up-v1.sh` | one-liner, dev-only, no repo change |
| B | `.env.shared` file read by both scripts | structural, but touches two repos' secrets layout |
| C | wrapper script `scripts/wslc/up-v1-bridged.sh` that auto-syncs | more code to maintain |

Picking **A** for now. Structural sync (B/C) deferred until sub-project G also has secrets that need sharing.

## Verification

1. Edit `.env.development`: set `E2E_BYPASS_AUTH=0` and `NEXT_PUBLIC_E2E_BYPASS_AUTH=0`.
2. Restart web: `bun run dev` (playwright config will fail `webServer` boot if env is wrong — caught early).
3. Manually set `COOKIE_USER_SUB=e2e-bypass-user` via browser devtools or test cookie injection.
4. Run `bun run test:e2e e2e/quick-tile-create-e2e.spec.ts`.
5. Confirm via `docker exec` (no — use `wslc container exec tastile-db psql -U tastile -d tastile_db -c "SELECT count(*) FROM v1_subject"`):
   - At least 1 `v1_subject` row exists for the derived owner UUID.
   - `count(*) FROM v1_subject` increased by 1 since the run started (proves `ensure_bridge_owner_provisioning` fired).
6. Inspect core log line for `bridge_auth_from_headers succeeded` or similar.

## リスク (Risks)

- **Production**: `TASTILE_WEB_BRIDGE_SECRET` is a literal string compare (`common.rs:810`). No hashing, no rotation. Treat as a high-value secret. `.env.development` ships a real value — confirm it is **not** the production value before any release.
- **Cookie spoofing**: `COOKIE_USER_SUB` is the only required cookie for bridge mode. If the cookie is forged but the secret is leaked, an attacker can spoof any owner. The secret must never enter client bundles.
- **owner_id stability**: because owner is derived from `user_sub` via UUIDv5, deleting and recreating a cognito user with the same sub reuses the same owner. Migrating users between cognito pools without preserving sub will silently switch owners.

## Acceptance

- `E2E_BYPASS_AUTH=0` env: QuickCreate submission persists to DB.
- `v1_subject` row exists for the test owner UUID.
- No 401s in the proxy or core log during the e2e.