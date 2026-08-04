# 04 — E2E runtime topology, observation points, blockers

Read-only audit. No services started, no DB mutated, no application files edited.

Companion to `00-overview.md`. Acceptance criteria referenced from `00-overview.md` lines 14-20.

## 1. Runnable topology (today, 2026-08-03)

### 1.1 Components and the path a Playwright run actually takes

A `bunx playwright test` run resolves the canonical Playwright config, which boots the Next.js dev server, then runs each spec. Each spec either drives the browser UI or talks to `/api/proxy/v1/*`. Auth falls through from Bearer → bridge headers → dev-only `x-owner-id`.

| Layer | Component | Where defined (file:line) | What it does |
| --- | --- | --- | --- |
| Test runner | Playwright (`@playwright/test`) | `tastile-web/playwright.config.ts:1-34` | `testDir: ./e2e`, `workers: 1`, `fullyParallel: false`, `retries: 1`, `trace: on-first-retry`. Webserver `command: "bun run dev"`, `url: http://127.0.0.1:3000`, `reuseExistingServer: true`, `timeout: 120_000`. Env injected into webserver: `E2E_BYPASS_AUTH=1`, `NEXT_PUBLIC_E2E_BYPASS_AUTH=1`, `NEXT_PUBLIC_DAEMON_BASE_URL=http://localhost:31400`, `TASTILE_USE_RUST_CORE=1`, `TASTILE_RUST_API_URL=http://127.0.0.1:31400`. Single project `chromium` (`Desktop Chrome`). |
| Browsed surface | Next.js dev server (`bun run dev`) | `tastile-web/package.json` (scripts.dev), pinned via `webServer.command` | Serves `/dashboard/**` UI pages + `/api/proxy/[...path]` route. |
| Auth fall-through proxy | `/api/proxy/[...path]` | `tastile-web/src/app/api/proxy/[...path]/route.ts:17-92` (`proxyRequest`) | Resolves `CLOUD_API_BASE` (lines 4-9): if env unset and `E2E_BYPASS_AUTH=1`, defaults to `http://localhost:31400`. Then branches: `E2E_BYPASS_AUTH=1` → sets `x-owner-id` + `x-actor-id` from `DEV_ACTOR_SUBJECT_ID` (`00000000-0000-0000-0000-000000000001`, line 15). Otherwise reads `COOKIE_API_TOKEN` / `COOKIE_USER_SUB`, redirects HTML requesters to `/login?error=session_expired` or returns `401 {error: "no authenticated session for proxy"}` for non-HTML (lines 36-44). Sets `authorization: Bearer <api_token>` (line 46) and bridge headers `x-tastile-web-bridge-secret` + `x-tastile-web-session-user` (lines 49-55). Path rewriting via `toV1Path` (lines 108-159) — v0 paths map to `/v1/*`. `fetch(url, init)` has **no AbortController** (`memory: feedback_tastile_web_proxy_no_fetch_timeout`). |
| Bridge owner provisioning | `Uuid::new_v5(NAMESPACE_OID, user_sub_bytes)` | `tastile-web/src/app/api/proxy/[...path]/route.ts:53-54` + `tastile-core` side resolution (memory `project_tastile_v1_bridge_auth_uuidv5.md`) | Wires the Cognito `user_sub` cookie to a stable v1 owner UUID. |
| Daemon | tastile-core v1 API | `tastile-core/scripts/wslc/up-v1.sh:59-70` (`wslc container run tastile-api`) | `127.0.0.1:31400` exposed via host port mapping. Auth resolves in `handlers::common::authenticate`; bridge wins on `Ok(None)`, revoked token returns `Err(_)` (memory `feedback_auth_fall_through.md`). |
| Worker | tastile-core worker (Step 2a filler) | `tastile-core/scripts/wslc/up-v1.sh:75-82`, `crates/v1/worker/src/main.rs` `drive_fill` | Prefills recurring-source placements for all owners with active recurring (HARNESS §5 "Recurring fill E2E", 2026-07-10). |
| Postgres | `postgres:16-alpine` | `tastile-core/scripts/wslc/up-v1.sh:33-39`, `tastile-db` container on `tastile-net` | Reachable only from inside the wslc network on `tastile-db:5432`. **NOT** published to host on purpose (README "Container shape", lines 39-42). |
| Bridge secret | `TASTILE_WEB_BRIDGE_SECRET` | `tastile-core/scripts/wslc/up-v1.sh:17` default `wslc-dev-bridge-secret`; `tastile-web/.env.development:26` = `E5SzuyY3s8Sz0-U_LXKUT5Rwmvx1LGRINak_A_Gg-eroktsiDpjXretr5KKWNg4d` | Must align or daemon returns `403` for bridge-authenticated browser requests. |

### 1.2 What "start it locally" looks like (commands available)

Two halves. They must run in order; container `tastile-web` joins the network but does not need its own image build to attach.

**tastile-core.wslc** (one-time container image build, then per-session stack):

| Step | Command |
| --- | --- |
| One-time image | `wslc build -f Containerfile.v1 -t tastile-v1-api:latest .` (or `bash scripts/wslc/build.sh`) — `tastile-core/scripts/wslc/build.sh:14` |
| Per-session up | `bash scripts/wslc/up-v1.sh` — starts `tastile-db` + `tastile-api` + `tastile-worker` on the `tastile-net` bridge with `tastile-pgdata` volume (`tastile-core/scripts/wslc/up-v1.sh:20-90`) |
| Per-session down | `bash scripts/wslc/down.sh` — stops in reverse, volume + network preserved (`tastile-core/scripts/wslc/down.sh:6-19`) |
| State check | `bash scripts/wslc/status.sh` — containers / image / network / volume state (`tastile-core/scripts/wslc/status.sh:5-19`) |

**tastile-web** (per-session):

| Step | Command |
| --- | --- |
| Image build (optional) | `bash scripts/wslc/build.sh` — `tastile-web/scripts/wslc/build.sh:9-12` |
| Web container up | `bash scripts/wslc/up.sh` — `tastile-web/scripts/wslc/up.sh:8-69` (requires `tastile-web` image and `tastile-net` network present) |
| Web container down | `bash scripts/wslc/down.sh` |

`Playwright` does **not** need any wslc container of its own — `playwright.config.ts:4` defaults `webServerCommand` to `bun run dev`, so the **host** spins up the Next.js dev server. The host's daemon must be reachable on `127.0.0.1:31400` (the proxy `CLOUD_API_BASE` default, `route.ts:7`).

### 1.3 Cleanup / isolation strategy: TRUNCATE via `wslc container exec`, NOT `docker exec`

`e2e/helpers/v1.ts:135-150` `truncateV1` is the canonical cleanup. It currently shells to `docker exec tastile-core-db-1 psql ...`. That container name does **not** exist on the wslc stack — it is a v0-era artifact. Under `tastile-core.wslc` the equivalent is:

```bash
wslc container exec tastile-db psql -U tastile -d tastile_db -c \
  'TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_annotation RESTART IDENTITY CASCADE;'
```

22 spec files currently call TRUNCATE through docker. Mapping:

| Spec file | TRUNCATE list shape | Lines |
| --- | --- | --- |
| `quick-tile-create-e2e.spec.ts` | `v1_placement, v1_event, v1_change_set, v1_window, v1_recurring RESTART IDENTITY CASCADE` (5 tables) | `e2e/quick-tile-create-e2e.spec.ts:20` (inlined, not via helper) |
| `quick-tile-create-recurring-e2e.spec.ts`, `quick-tile-create-v1-params.spec.ts`, `quick-tile-meta-roundtrip.spec.ts`, `quick-tile-sidebar-to-timeline.spec.ts`, `quick-tile-timeline-display.spec.ts`, `quick-tile-edit-delete.spec.ts` | same 5-table TRUNCATE, inlined | lines 20-31 |
| `e2e/helpers/v1.ts:142-144` (`truncateV1`) | 6 tables: adds `v1_annotation` | used by `quick-tile-recommend.spec.ts`, `quick-tile-suggest-popover.spec.ts`, `calendar-event-flow.spec.ts`, `overlap-lanes.spec.ts`, `recurring-weekly-to-placement.spec.ts` |
| `at-010-changeset.spec.ts`, `at-011-placement-priority.spec.ts`, `at-021-materialize-idempotent.spec.ts`, `at-022-archive-keeps-placement.spec.ts`, `at-030-execution.spec.ts`, `at-034-finish-void.spec.ts`, `at-053-idempotency.spec.ts`, `at-060-read-api.spec.ts`, `recurring-edit-title.spec.ts`, `recurring-to-placement-v1.spec.ts` | full 9-table TRUNCATE (adds `v1_frame`, `v1_recurring_frame_rule`, `v1_materialization_state`, `v1_tile`) | lines 18-31 |

**TRUNCATE list gaps** — the plan §Acceptance criteria (`00-overview.md:18-19`) requires `v1_tile` to be in the cleanup so subsequent specs start clean. Currently:

- `truncateV1` in `helpers/v1.ts` excludes `v1_tile` — `v1_tile` is left behind between specs. The helper truncates only `v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_annotation`. The single-file inlined cleanup in `quick-tile-create-e2e.spec.ts:20` and the 6 sibling quick-tile specs do the same.
- The `at-*.spec.ts` 9-table TRUNCATE is comprehensive but **does not** include `v1_annotation` or `v1_subject` (`SUBJECT` is the seed-then-keep-by-`access_repo` row; deleting it would break `sign-in` UI tests downstream).

These gaps matter when running the suite in any order other than `:alphabetical:default`. A leftover `v1_tile` from a previous spec will pollute `GET /v1/tiles` reads unless individual spec scopes its reads to a single placement/title (`quick-tile-create-e2e.spec.ts:32` `title = "E2E sidebar " + Date.now()` is exactly that mitigation).

### 1.4 Bridge-secret alignment

Two values must match exactly or `x-tastile-web-bridge-secret` requests fall into `Err(WrongSecret)` (or silent `403` on production):

| Side | Path | Value |
| --- | --- | --- |
| Daemon env (default in `up-v1.sh`) | `tastile-core/scripts/wslc/up-v1.sh:17` | `wslc-dev-bridge-secret` |
| Web env (`tastile-web/.env.development:26`) | `TASTILE_WEB_BRIDGE_SECRET` | `E5SzuyY3s8Sz0-U_LXKUT5Rwmvx1LGRINak_A_Gg-eroktsiDpjXretr5KKWNg4d` |

Currently **misaligned**. Running the dev stack as `bash scripts/wslc/up-v1.sh` while playing against the committed `.env.development` will fail every `/api/proxy/v1/*` call except the `E2E_BYPASS_AUTH=1` path (which only `playwright.config.ts:18-22` sets).

Two acceptable fixes:

1. **Align daemon to web**: export `BRIDGE_SECRET` to the `.env.development` value before invoking `up-v1.sh`. The script already honors `BRIDGE_SECRET` from env via `: "${TASTILE_WEB_BRIDGE_SECRET:=wslc-dev-bridge-secret}"` (`up-v1.sh:17`); `wslc container run` is passed `-e "TASTILE_WEB_BRIDGE_SECRET=$TASTILE_WEB_BRIDGE_SECRET"`. **This is the simpler path.**
2. **Align web to daemon**: set `TASTILE_WEB_BRIDGE_SECRET=wslc-dev-bridge-secret` in `tastile-web/.env.development`. Optional follow-on: re-export + restart `bun run dev`.

The plan overview (`00-overview.md:17`) requires bridge-auth with `Uuid::new_v5(NAMESPACE_OID, user_sub_bytes)`. That codepath only runs when `E2E_BYPASS_AUTH != "1"`. With Playwright default config (`E2E_BYPASS_AUTH=1`), bridge is **not exercised at all** unless the operator flips the env. Flag for the plan to clarify: is Phase 0 (stack up) the bridge-aligned path, or is it `E2E_BYPASS_AUTH=1` exclusively?

### 1.5 Auth matrix observed in code

| Test mode | Headers used | Source |
| --- | --- | --- |
| Browser-driven UI spec | `E2E_BYPASS_AUTH=1` → proxy sets `x-owner-id` + `x-actor-id` for /v1 calls | `tastile-web/src/app/api/proxy/[...path]/route.ts:30-32`, `playwright.config.ts:18` |
| HTTP-driven spec (`v1CreatePlacement`) | Either `TASTILE_E2E_BEARER` (`Authorization: Bearer`) or `TASTILE_E2E_OWNER_ID` / `TASTILE_E2E_ACTOR_ID` (`x-owner-id` / `x-actor-id`) | `e2e/helpers/v1.ts:295-303` `v1AuthHeaders()` |

`TASTILE_E2E_BEARER` is **never set** in this repo (`grep -r TASTILE_E2E_BEARER tastile-web` → 0 results outside the helper). All current HTTP-driven specs run on the dev-only `x-owner-id` path.

## 2. Database observation points

### 2.1 Reachability

Postgres is **not** exposed to the host. To inspect:

```bash
wslc container exec tastile-db psql -U tastile -d tastile_db -c 'select ...'
```

That is the only path; the daemon runs on host port `127.0.0.1:31400` and exposes a read API, but not raw SQL.

### 2.2 Tables the create→materialize→timeline assertions need to inspect

Each QuickCreate submission produces writes under one of two patterns:

**Pattern A — single Placement from QuickCreate panel** (today's `quick-tile-create-e2e.spec.ts:31-46`):

| Step | Effect on tables |
| --- | --- |
| `POST /api/proxy/v1/tiles` (panel → `kind: 1 PLACEMENT`, idempotency_key) | +1 `v1_tile` row (plus transitively a `v1_plan` row written in the same TX; spec reads it back via `GET /api/proxy/v1/tiles/{id}` at `v1.ts:60`) |
| `POST /api/proxy/v1/placements` (Manual source = 0, `source_ref.{created,recurring,flow,frame,proposal,source_text,external_id}` mostly null) | +1 `v1_placement` row, +1 `v1_placement_baseline.span` row, +1 `v1_placement_source_ref` row (MANUAL), +1 `v1_event` row |
| `GET /api/proxy/v1/timeline?start=…&end=…` | reads via worker prefill + `frame_repo::lazy_expand_owner_window` (HARNESS §5 "Recurring fill E2E — owner-scoped API + worker prefill", 2026-07-10) |

**Pattern B — weekly Recurring + Step frame-rule + materialize** (`v1CreateWeeklyRecurring` at `e2e/helpers/v1.ts:160-257`):

| Step | Effect on tables |
| --- | --- |
| `POST /api/proxy/v1/tiles` (kind=0 RECURRING) | +1 `v1_tile`, +1 `v1_plan` |
| `GET /api/proxy/v1/recurring/{id}` | resolves `recurring_view.tile_id` for subsequent tile_id references |
| `POST /api/proxy/v1/recurring/{tileId}/frame-rules` (Step generator, `step: 86_400_000`) | +1 `v1_recurring_frame_rule` (also wires `v1_recurring_life`) |
| For each weekday in mask: `POST .../frame-rules/{ruleId}/materialize` | +1 `v1_frame` (idempotency anchor), +1 `v1_placement`, +1 `v1_placement_baseline`, +1 `v1_placement_source_ref_recurring` (UNIQUE on `(recurring_tile, frame_id)`) |

### 2.3 Verified pre-write read proofs

| Read | Use |
| --- | --- |
| `GET /api/proxy/v1/tiles/{id}` (after `POST /v1/tiles`) | Returns view including `planId`. `e2e/helpers/v1.ts:60-63` reads back `plan_id` to attach to the placement POST. **Asserts `planId != null`** in `e2e/helpers/v1.ts:64`. |
| `GET /api/proxy/v1/timeline?start=…&end=…` (after `POST /v1/placements`) | Returns items with `placementId` / `occurrenceKey`. `v1.ts:114-128` `v1CreatePlacementAndResolve` does this. QuickCreate spec only checks the placement landed via `:60-63` (`/api/events/occurrences`). |
| `GET /api/proxy/v1/recurring/{id}` (after `POST /v1/tiles` for kind=0) | `e2e/helpers/v1.ts:201-205` reads `tile_id` because `POST /v1/tiles` for Recurring returns the recurring id, not the v1_tile.id. **Asserts `view.tile_id != null`** when `recurringViewRes.status() < 400`. |

### 2.4 DB-level table presence check (curated, post-migration)

Use this single read to confirm the schema is at the expected migration level (run inside `wslc container exec tastile-db`):

```sql
SELECT version FROM v1_migration ORDER BY applied_at DESC LIMIT 1;
```

Minimum migration for the current `quick-tile-create-e2e.spec.ts` is `V1_022__source_revision_reflow` (HARNESS §5 "v0.5.0 CD" entry, `/v1/ready` observed `"migration":"V1_022"`). V1_015 seeds `休憩` per USER (`/v1/auth/signup`) and must be present for the recurring path to be observable.

## 3. Exact observable assertions for create→materialize→timeline

These are the assertions already expressed in `e2e/quick-tile-create-e2e.spec.ts`, with each observation pin annotated.

### 3.1 UI side (Playwright + Chrome)

| Assertion | Pin | File:line |
| --- | --- | --- |
| Sidebar new-tile button visible | `await page.getByTestId("sidebar-new-tile").first().click()` | `e2e/quick-tile-create-e2e.spec.ts:35` |
| Quick create panel renders, Submit visible | `await expect(submit).toBeVisible()` | `:37` |
| Submit disabled before fill | `expect(beforeDisabled).toBe(true)` | `:40` |
| Title required input is `aria-required="true"` first text input | `input[aria-required="true"]` | `:42` |
| Submit enabled after fill | `await expect(submit).toBeEnabled()` | `:44` |
| Panel closes after submit | `await expect(submit).not.toBeVisible()` | `:47` |

### 3.2 API side (read proofs)

| Proof | Endpoint | File:line | Note |
| --- | --- | --- | --- |
| Day-view occurrences includes new title | `GET /api/events/occurrences?start=…&end=…&min_minutes=0&include_recurring=true` (legacy v0 route, still answered by `tastile-core` via proxy) | `e2e/quick-tile-create-e2e.spec.ts:59-63` | Uses v0 occurrences endpoint, not the new `GET /v1/timeline`. Hardened path would switch to `/api/proxy/v1/timeline?start=…&end=…` and assert on `placementId` (the path `v1.ts:114-128` already uses). |
| Title round-tripped | `expect(occTitles).toContain(title)` | `e2e/quick-tile-create-e2e.spec.ts:63` | Title is `"E2E sidebar " + Date.now()` to dodge neighbour-spec pollution. |

### 3.3 DB-side assertions (currently **absent** in `quick-tile-create-e2e.spec.ts`)

The acceptance criterion at `00-overview.md:18` ("`v1_tile` / `v1_plan` / `v1_placement` 各テーブルに 1 行ずつ作成され、`SELECT count(*)` が期待値を満たす") is **not** covered by the spec as written. To cover it, add a step that shells out via `wslc container exec tastile-db psql -U tastile -d tastile_db -t -A -F'|' -c` and asserts counts:

| Query | Expected after one panel submit |
| --- | --- |
| `SELECT count(*) FROM v1_tile WHERE title = '<panel title>'` | 1 |
| `SELECT count(*) FROM v1_plan WHERE tile_id = (SELECT id FROM v1_tile WHERE title = '<panel title>')` | 1 |
| `SELECT count(*) FROM v1_placement WHERE tile_id = <tile.id>` | 1 |
| `SELECT count(*) FROM v1_event` (delta after submit) | +1 |

The shell layer would mirror `truncateV1`'s `execFileSync` pattern (`e2e/helpers/v1.ts:136-149`) but with the **wslc** container name (`tastile-db`), not `tastile-core-db-1`. This is the same docker→wslc replacement the existing helpers need.

## 4. Gaps vs `00-overview.md` Acceptance criteria

| Acceptance criterion from `00-overview.md` | Status today | Gap |
| --- | --- | --- |
| core v1 daemon up via wslc, `GET http://127.0.0.1:31400/v1/ready` returns `{status:"ok",database:"ok",migration:"ok"}` | **OK via wslc stack** (HARNESS §5 "v0.5.0 CD" 2026-07-20 evidence: `"migration":"V1_022__source_revision_reflow"`) | None in the up path. The acceptance text says the migration field is `"ok"`; wslc stack returns the version string. Cosmetic. |
| bridge auth: 2 headers + UUIDv5 owner | **Implemented** (`tastile-web/src/app/api/proxy/[...path]/route.ts:49-55`, `tastile-core` `handlers/common/authenticate`) | Playwright default config flips `E2E_BYPASS_AUTH=1`, which **bypasses the bridge path**. To exercise the bridge path the spec would need to drop `E2E_BYPASS_AUTH` and ship a `tastile_uid` cookie (memory `feedback_cf_cookie_name_waf.md`) for `user_sub`. The current `quick-tile-create-e2e.spec.ts` does not exercise bridge auth at all. |
| Default-state QuickCreate submits, `v1_tile` / `v1_plan` / `v1_placement` each +1 row | **Not asserted in current spec** (DB-side count assertions absent, see §3.3) | Add `count(*)` assertions per §3.3 table. |
| `GET /v1/timeline?from=…&to=…` includes the new placement | **Partially**. `v1CreatePlacementAndResolve` does (`v1.ts:114-128`). `quick-tile-create-e2e.spec.ts` reads `/api/events/occurrences` (v0) instead. | Switch read path to `/api/proxy/v1/timeline` and assert on `placementId` for any panel-submitted placement. |
| `quick-tile-create-e2e.spec.ts` green on real stack | **Failing** today (any operator that runs `bash scripts/wslc/up-v1.sh` + `bunx playwright test quick-tile-create-e2e.spec.ts` will hit `docker exec tastile-core-db-1` failing because the container doesn't exist) | docker→wslc replacement of `truncateV1` (see §1.3) + the spec's inlined TRUNCATE (line 20) and `helpers/v1.ts` annotation insert (lines 92-103). |

## 5. Existing test gaps (out of scope for §Acceptance but worth flagging)

| Gap | Location | Note |
| --- | --- | --- |
| `/api/proxy/v1/*` has no `AbortController` → 305s Node fetch hang on upstream stall | `tastile-web/src/app/api/proxy/[...path]/route.ts:74` | `feedback_tastile_web_proxy_no_fetch_timeout.md` documents; not E2E-test fix |
| `v1AuthHeaders` Bearer path is dead code (`TASTILE_E2E_BEARER` never set) | `e2e/helpers/v1.ts:295-303` | Either delete or document why it's there |
| `truncateV1` does not include `v1_tile` / `v1_frame` / `v1_recurring_frame_rule` / `v1_materialization_state` / `v1_subject` | `e2e/helpers/v1.ts:142-144` | At-022/021 specs include them inline. If `truncateV1` is supposed to be "drop everything", extend it; otherwise keep the divergent semantics and document |
| `truncateV1` swallows all errors silently | `e2e/helpers/v1.ts:147-149` (`try { ... } catch { /* no-op */ }`) | The comment claims docker exec is the canonical cleanup path. When the path is broken, the test silently runs dirty and the failure mode is downstream. `feedback_observe_actual_behavior.md` flags this. Once moved to `wslc container exec`, the `try/catch` should at least `console.error` on failure |
| Spec uses `/api/events/occurrences` (v0) for read proof | `e2e/quick-tile-create-e2e.spec.ts:59-63` | Doesn't survive a v0 sunsetting. Move to `/api/proxy/v1/timeline` |
| Spec violates `workers: 1` ordering expectations | `playwright.config.ts:9` + the 22 TRUNCATE specs | All good — `workers: 1` enforces serial execution so TRUNCATE is consistent |
| `playwright.config.ts:11` trace only fires on retry | First-try failures produce no trace | Set `trace: "on"` or `"retain-on-failure"` for production-quality evidence |
| Dev server **not** explicitly torn down between suites | `playwright.config.ts:25` `reuseExistingServer: true` | Can speed up CI, but means a stale dev server's env vars can leak. Acceptable for local; risky for CI gate |
| Playwright retries=1 silently passes a flake | `playwright.config.ts:10` | Acceptable for known-flaky seed data, not for an E2E contract |

## 6. Safe commands (run, do not edit)

These commands are **read-only** or **idempotent**. Use them as the audit's verification path; do not commit any state changes.

| Command | Purpose |
| --- | --- |
| `bash scripts/wslc/status.sh` (from `tastile-core`) | Container / image / network / volume state |
| `bash scripts/wslc/status.sh` (from `tastile-web`) | web container / image / network state |
| `wslc list` | All containers across the wslc host |
| `wslc images` | All cached images |
| `wslc container inspect tastile-api` | Live env (incl. `TASTILE_WEB_BRIDGE_SECRET`) of the daemon |
| `curl -s http://127.0.0.1:31400/v1/health` | liveness |
| `curl -s http://127.0.0.1:31400/v1/ready` | readiness + migration version |
| `curl -s -H "x-owner-id: <uuid>" -H "x-actor-id: <uuid>" 'http://127.0.0.1:31400/v1/timeline?start=…&end=…&owner_ids=<uuid>'` | One read proof |
| `wslc container exec tastile-db pg_isready -U tastile -d tastile_db` | Postgres readiness |
| `wslc container exec tastile-db psql -U tastile -d tastile_db -c '\\dt v1_*'` | Table inventory |
| `wslc container exec tastile-db psql -U tastile -d tastile_db -c 'SELECT version FROM v1_migration ORDER BY applied_at DESC LIMIT 1;'` | Migration level |
| `wslc container logs --tail 100 tastile-api` | Last 100 daemon log lines |

## 7. Blockers (with citations)

### 7.1 Bridge-secret mismatch (BLOCKER, prevents any non-`E2E_BYPASS_AUTH` Playwright run)

- `tastile-core/scripts/wslc/up-v1.sh:17` defaults `TASTILE_WEB_BRIDGE_SECRET=wslc-dev-bridge-secret`
- `tastile-web/.env.development:26` sets `TASTILE_WEB_BRIDGE_SECRET=E5SzuyY3s8Sz0-U_LXKUT5Rwmvx1LGRINak_A_Gg-eroktsiDpjXretr5KKWNg4d`
- Impact: `up-v1.sh` runs daemon with default secret; web browser sends bridge headers with committed secret → daemon treats bridge header as `Err(WrongSecret)` → 401 / 403.
- Resolution: pick one of the two `Bridge-secret alignment` paths in §1.4. Tracked under Phase 0 of `00-overview.md:15-16`.

### 7.2 `docker exec tastile-core-db-1` does not exist on the wslc stack (BLOCKER, every spec's `beforeEach`/setup TRUNCATE fails)

- `e2e/helpers/v1.ts:101, 139-149`, inlined TRUNCATE in 22 spec files listed in §1.3.
- Impact: `wslc container exec` is the only path; `try/catch` in `truncateV1` swallows the failure so tests run "dirty" but **report green** anyway. `feedback_observe_actual_behavior.md` and `feedback_unverified_pass.md` both apply — "PASS without execution" is a serious trust breach.
- Resolution: Replace `docker exec tastile-core-db-1` with `wslc container exec tastile-db` everywhere. Drop the silent `try/catch` in `truncateV1` and let the failure surface. Optionally expose a `--cleanup-driver=wslc|docker` env var so CI can swap.

### 7.3 Playwright default config forces `E2E_BYPASS_AUTH=1`, contradicting `00-overview.md` Phase 0 acceptance (PARTIAL BLOCKER, plan requirement gap)

- `tastile-web/playwright.config.ts:18-22` env vars include `E2E_BYPASS_AUTH: "1"` and `NEXT_PUBLIC_E2E_BYPASS_AUTH: "1"`.
- Impact: `00-overview.md:16` says bridge auth must be exercised end-to-end. Current config bypasses it. UUIDv5 contract is **untested** by the current spec suite.
- Resolution: either (a) add a separate spec profile (`projects` array expansion with two configs, one with `E2E_BYPASS_AUTH=1` and one without), or (b) document that Phase 0 contract is the **runtime path**, not the Playwright contract, and pin a curl-driven bridge-auth probe as the Phase 0 acceptance check. Option (b) is consistent with `feedback_observe_actual_behavior.md`.

### 7.4 Proxy fetch has no `AbortController` (known; out of E2E scope; memory cited)

- `tastile-web/src/app/api/proxy/[...path]/route.ts:74` `await fetch(url, init)` has no timeout. Documented in `feedback_tastile_web_proxy_no_fetch_timeout.md`.
- Impact: long E2E test runs can pile up Chrome connection-pool starvation if upstream hangs. Visible flake.
- Resolution: outside E2E contract; track under `feedback_tastile_web_proxy_no_fetch_timeout.md` follow-ups.

## 8. Recommendation (no implementation in this audit)

Phase 0 (G + H per `00-overview.md`) needs three operator actions before the existing `quick-tile-create-e2e.spec.ts` can claim green:

1. **W1 — docker→wslc replacement** of TRUNCATE containers. Single `wslc container exec tastile-db` swap in `e2e/helpers/v1.ts:101, 139-149` plus 22 inlined TRUNCATE sites (§1.3). Drop silent `try/catch`. Acceptance: every spec's TRUNCATE shell out visibly fails loud if container missing.

2. **W2 — bridge-secret alignment** via §1.4 option 1 (align daemon to committed `.env.development`). Single doc or `Makefile` target: `BRIDGE_SECRET=$(grep '^TASTILE_WEB_BRIDGE_SECRET=' tastile-web/.env.development | cut -d= -f2-) bash scripts/wslc/up-v1.sh`. Acceptance: `wslc container inspect tastile-api | grep TASTILE_WEB_BRIDGE_SECRET` returns the committed value.

3. **W3 — DB-side create assertions in `quick-tile-create-e2e.spec.ts`**. Add per-table `count(*)` assertions per §3.3 using `wslc container exec tastile-db psql`. Acceptance: spec fails loud when any count is off-by-one.

After W1+W2+W3 the spec reads as a real contract: panel → HTTP POST → DB rows + API timeline item, all asserted. Sub-project work for A/B/C/D/F/E (`00-overview.md:24-33`) can then build on a guaranteed green Phase 0.

Phase 0 does **not** require touching the v1 specification (`tastile-core/v1/`), the proxy route (beyond the env handling already in place), or the Playwright config beyond optionally separating the auth profile (§7.3).
