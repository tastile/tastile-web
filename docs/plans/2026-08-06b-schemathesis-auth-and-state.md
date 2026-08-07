# schemathesis L2 — auth injection + 404-warning suppression (2026-08-06 b)

## Context

L1 (2026-08-06) shipped: Windows console fix + correct `base-url` + checks
silenced. After L1, `bun run contract:test` surfaces 15 real failures
(response-schema drift in `public/openapi.yaml`) and 2 warnings:

```
⚠️ Missing authentication: 2 operations returned only 401/403 responses
⚠️ Missing valid test data: 35 operations repeatedly returned 404 responses
```

This plan (L2) addresses the 2 warnings and **only** the 2 warnings.
The "Schema validation mismatch: 21 operations" warning is a *symptom* of
the same response-schema drift that produces the 15 failures; both are
fixed together in L3 (`2026-08-06c-schemathesis-ci-and-examples.md`).

After investigating the 21 "validation mismatch" ops and the 9 POST body
schemas in `public/openapi.yaml`, **request-side schemas are already tight**
(UUIDs have `format: uuid`, emails have `format: email`, enums are declared
for `conflict_resolution` etc.). The warning text "mostly rejected generated
data" comes from the *response* not matching the declared response schema —
i.e. the same root cause as the 15 hard failures. There is no L2 work on the
request side that would meaningfully move the needle.

## L2 scope

1. **Auth header injection** (env-var opt-in, default OFF)
   - Runner reads `TASTILE_TEST_TOKEN` env var.
   - When set, appends `--header "Authorization: Bearer <token>"` to the
     schemathesis invocation.
   - When unset, runner is unchanged from L1.
   - Silences `Missing authentication: 2 operations`.
   - Mutations against prod remain opt-in; user supplies a test-identity
     token from a dedicated test user (out of scope to create one here).

2. **`EnsureReachability` ignore list**
   - The 35 ops in the `Missing valid test data` warning all share one
     root cause: they need an existing resource the API can find, and
     schemathesis generates random UUIDs that don't match anything.
   - CLI stateful testing that wires `POST /commands/tile/create` →
     `GET /read/tile/{id}` is **only** available via the Python API, not
     the `uvx schemathesis run` CLI we ship.
   - Add `[checks.EnsureReachability] ignore_operations = [...]` listing
     exactly those 35 ops so the warning goes away, with a plan-doc note
     that real coverage of these ops requires either the Python harness
     or the local-daemon + seed-data path (out of scope for L2).
   - This is *not* "fixing" the underlying gap; it's an explicit
     acknowledgement: the CLI run is a smoke test, not full coverage.
     L3 / future work can introduce the stateful Python harness.

3. **Warnings config**
   - Configure `[warnings] display = [...]` and `fail-on = [...]` so the
     user-facing output is stable: ignore-list suppressed warnings don't
     re-appear under different counts, and validation_mismatch still
     surfaces (it's the L3 signal that needs to stay visible).

4. **Documentation**
   - Update `docs/plans/2026-08-06-schemathesis-contract-testing.md`
     "L2 — silence the 2 warnings (sketch)" section with the actual
     implemented scope (this doc is the source of truth).

## L2 deliverables

| File | Change |
|---|---|
| `tastile-web/scripts/run-schemathesis.mjs` | Read `TASTILE_TEST_TOKEN`; if set, inject `--header "Authorization: Bearer ..."`. |
| `tastile-web/schemathesis.toml` | Add `[checks.EnsureReachability] ignore_operations = [...]` (35 paths); add `[warnings]` block. |
| `tastile-web/package.json` | No change (env-var driven). |
| `tastile-web/docs/plans/2026-08-06-schemathesis-contract-testing.md` | Update L2 sketch to reflect actual scope; link to this doc. |

## The 35 ops to ignore (rationale + verbatim list)

These ops return 404 in the CLI run because schemathesis-generated UUIDs
don't match any existing tile/event/etc. The Python stateful harness is the
real fix; this list is the CLI smoke-test acknowledgement.

```
GET   /auth/tile-quota
GET   /debug/events
GET   /prompts/current
GET   /read/active-tile
GET   /read/events/state
GET   /read/execution
GET   /read/execution-view
GET   /read/runtime-paths
GET   /read/tile/{id}
GET   /read/tile/{id}/editable
GET   /read/tiles
GET   /read/tiles-in-progress
GET   /views/active-tile
GET   /views/calendar/day
GET   /views/calendar/month
GET   /views/calendar/week
GET   /views/calendar/year
GET   /views/pending-prompt
GET   /views/tile-list
GET   /views/timeline/today
POST  /commands/break/end
POST  /commands/break/start
POST  /commands/memo/attach
POST  /commands/prompt/request
POST  /commands/prompt/respond-startup-recovery
POST  /commands/tick
POST  /commands/tick-at
POST  /commands/tick-range
POST  /commands/tile/complete
POST  /commands/tile/create
POST  /commands/tile/defer
POST  /commands/tile/delete
POST  /commands/tile/extend
POST  /commands/tile/start
POST  /commands/tile/update
```

Two of the 35 also need auth and were in the `Missing authentication: 2 ops`
warning: `GET /auth/session` (probably) and `GET /auth/tile-quota` (likely).
Auth injection (item 1) covers that pair automatically.

## Warnings config

```toml
[warnings]
# Display only auth/validation warnings; missing_test_data is silenced
# by the EnsureReachability ignore list (item 2 above).
display = ["missing_auth", "validation_mismatch"]
# A real validation mismatch is the L3 signal that must stay non-zero.
fail-on = ["validation_mismatch"]
```

## Verification

`bun run contract:test --max-examples=2 --rate-limit=20/s` after L2:
- exit code still 1 (15 real failures from L1 + 21-mismatch warning now
  upgraded to `validation_mismatch` *fail-on* via config — expected)
- `Missing authentication` warning **gone** when `TASTILE_TEST_TOKEN` unset
- `Missing valid test data` warning **gone** (EnsureReachability ignores)
- `Validation mismatch` warning visible and exit-non-zero (L3 target)

`TASTILE_TEST_TOKEN=*** bun run contract:test ...` with a real test-user
api-token: should additionally see `Missing authentication` count drop to
zero *and* the auth'd endpoints start producing 200/4xx rather than 401
across the contract test sweep.

## Out of scope (L3 and beyond)

- Fixing the 15 real spec-drift failures (L3 — `2026-08-06c-...`).
- Python stateful harness for create-then-get chains (L3+).
- Test-user provisioning / seed-data scripts (separate concern).
- Adding `example:` to every schema (L3 — `2026-08-06c-...`).
- CI workflow (L3).