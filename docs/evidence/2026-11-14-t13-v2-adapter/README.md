# T13 v2 web adapter — live acceptance evidence (2026-11-14)

Validated snapshot:

- tastile-web `t13-v2-web-adapter` @ `97e47159a05fbcb897373b0775532da1f7ead0bd`
- tastile-core v2 binary built from `399190030ba25cab8d7fba63a600002e9895843d`
- `tastile-v2` SHA-256 `ecec15cb0040942594ad16862d059315c0e0964b1e476a8d561a38c09ec47e42`
- lock `/tmp/v2-t13/scheduler.lock.json`, digest `sha256:f454cdbcc0dd2d4ad1bdde2c8ef92f927fd46206086040f756adc279449e0c95`
- store `/tmp/v2store-t13` seeded by `scripts/v2-seed-store.sh`
- verify stack: `tastile-verify-{api,worker,db}`, image `tastile-core-verify:rel110-d0c2ce0`, API `127.0.0.1:31400`, PG `127.0.0.1:55432`
- web: host `bun run next dev --port 3124` with `TASTILE_V2_ENABLED=true`, `TASTILE_V2_CLI`, `TASTILE_V2_STORE`, `TASTILE_V2_LOCK`

Auth: real Better Auth email sign-in + `/api/auth/bridge` hand-off (session + `tastile_uid`/`tastile_api_token` cookies). No `E2E_BYPASS_AUTH`. Session cookies are NOT included in this bundle.

## Files

| file | observation |
| --- | --- |
| `01-unauth.txt` | POST without session → `401 {"error":"Unauthorized"}` |
| `02-no-optin.txt` / `02b-optin-false.txt` | `opt_in` absent/false → `200 {"engine":"disabled"}` |
| `03-v2-success.txt` | opt-in + valid input → `{"engine":"v2","ok":true,"count":46,...}` via real `tastile-v2` subprocess |
| `04a..04d-*.txt` | unknown top-level key / non-integer `step_ms` / missing `input` / malformed JSON → `400`, no subprocess spawned |
| `05-disabled-no-env.txt` | server restarted without `TASTILE_V2_ENABLED` → `{"engine":"disabled"}` |
| `06-fallback-missing-cli.txt` | `TASTILE_V2_CLI=/nonexistent` → `{"engine":"fallback","ok":false,"fallback_reason":"v2_spawn_failed"}` |
| `07-typed-cli-error.txt` | `TASTILE_V2_LOCK=/nonexistent` → `{"engine":"v2","ok":false,"error":{"code":"v2_failure"}}` typed failure preserved |
| `10-v2-page-before.png` / `11-v2-result.png` | real-browser screenshots of `/dashboard/v2-scheduler` |
| `12-v2-dom.txt` | rendered DOM containing `engine: v2 · http 200 · ok=true`, `count: 2`, golden-vector occurrences |
| `13-api-trace.json` | network trace: `POST /api/v2/scheduler/evaluate → 200` |

Unit coverage on the same head: `bun test src/lib/v2-adapter/scheduler-eval.test.ts` → 9 pass / 0 fail.

Scope note: `/dashboard/v2-scheduler` is a technical demonstration page only. Practical integration into the existing schedule UI is tracked separately (tastile-web#215).
