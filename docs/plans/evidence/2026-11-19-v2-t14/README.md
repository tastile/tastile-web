# T14 evidence — scheduler-v1-expand via real Web BFF + real Wasm (web#219)

Date: 2026-11-19. Branch: `219-v2-v1-expand` @ c7b54d5.
Core artifact: tastile-core `examples/scheduler-v1-expand` @ fe858e1
(PR tastile-core#398). Store seeded by `scripts/v2-seed-store.sh` with
`V2_SCHEDULER_PROFILE=scheduler-v1-expand` into `/tmp/v2-web-store-expand`
(lock `scheduler-v1-expand.lock.json`, `lock_digest sha256:2f1000c9…`).

## Environment (VERIFIED by execution)

- `node node_modules/next/dist/bin/next dev --port 3124` with
  `TASTILE_ENV=development E2E_BYPASS_AUTH=1 TASTILE_V2_ENABLED=true`
  `TASTILE_V2_CLI=…/crates-v2/target/release/tastile-v2`
  `TASTILE_V2_STORE=/tmp/v2-web-store-expand`
  `TASTILE_V2_LOCK=/tmp/v2-web-store-expand/scheduler-v1-expand.lock.json`
- CLI: `crates-v2/target/release/tastile-v2 run <lock> --input …`
  executes the real `scheduler-v1-expand.wasm` component (wasm-tools
  lifted, registered in the v2 store).

## Results (all HTTP 200 via `POST /api/v2/scheduler/evaluate`)

| case | response (abridged) |
| --- | --- |
| golden fixture, run 1 | `{"engine":"v2","ok":true,"status":"ok","occurrences":[[1767232800000,1767234600000]],"count":1,"elapsed_ms":51}` |
| golden fixture, run 2 (determinism) | identical `occurrences`, `status:"ok"`, `cache_hits:1`, `elapsed_ms:7` |
| `span_ms=-5` | `status:"invalid_window"`, `occurrences:[]`, `count:0` — typed domain outcome, NOT fallback |
| `bounds_start/bounds_end` set | `status:"unsupported"`, `occurrences:[]` — v1 has no absolute-bound analog |
| no `opt_in` | `{"engine":"disabled"}` — v1 default path untouched |

Browser evidence: `13-api-trace.json` records a real Chromium
(Playwright) page on `/dashboard/v2-scheduler` issuing the same POST —
response `engine:"v2", status:"ok"`, `elapsed_ms:52`. Screenshots in
`screenshots/` (gitignored per policy §30/§31).

## Known gaps (honest status)

- Same-fixture **v1 materialization** comparison (`GET /v1/timeline` /
  schedule-definitions → worker placements) requires the Core API stack
  (Postgres + `tastile-v1-api`), which was not running in this
  environment. `scripts/v2-v1-occurrence-diff.ts` is the prepared harness
  for that comparison; it has NOT been executed here.
- The dedicated page's Evaluate button could not be click-driven in this
  dev server because the dashboard shell enters a dev-mode reload loop
  without the full Core/backend env; the in-page `fetch` issued by the
  same client code path was used instead (recorded in `13-api-trace.json`).
- Fallback paths (timeout / spawn failure / malformed output) are covered
  by `scheduler-eval.test.ts` (12 cases) but were not re-exercised
  against the live server in this run.
