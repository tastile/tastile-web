# web#215 G4 — v2 scheduler opt-in evaluation in recurring form (2026-11-14)

Validated snapshot:

- tastile-web `215-g4-schedule-v2` @ `f6e53564` (base `release-1-1-0` @ `5627ab15`); CodeRabbit review fixes (midnight-crossing adopt guard, stale-input invalidation, request generation guard, `expired_recurrence`) landed in `d33e13ca`/`f6e53564` and the live flow was re-verified on this head
- host `bun run next dev --port 3124`; verify stack API `127.0.0.1:31400`, PG `127.0.0.1:55432`
- real Chromium via Playwright; normal Better Auth session + bridge cookies (no `E2E_BYPASS_AUTH`); session material limited to `session.json` (sub/exp/owner_id only)

## Flow verified live

1. QuickCreate → workflow `recurring` → repeat mode `daily` → v2 section self-renders (repeatMode `once` hides it).
2. **Opt-in OFF**: zero `/api/v2/*` requests during form interaction (`summary.json.v2Requests` empty until opt-in).
3. Opt-in ON → `v2-eval-run` → `POST /api/v2/scheduler/evaluate` → real `tastile-v2` subprocess result `engine:"v2", ok:true`, `count:15` daily `00:00 → 00:30` candidates (`03-result-dom.txt`, `03-v2-result.png`).
4. **Adopt**: schedulable window `09:00–17:00` → `00:00–00:30` (v2 candidate time-of-day mirrored into v1 `time.schedulableWindow`/`timeOfDay` fields; `timeModel` upgraded from `duration_only` when applicable) (`04-after-adopt.png`).
5. **Discard**: re-evaluate → discard → result panel cleared, schedule fields untouched (`05-after-discard.png`).
6. **Submit through normal v1 path**: recurring tile `verify215-mwgc8rzh` created in real DB as source `01a1d9e0-a358-…`; schedule read-back shows `interval_ms:86400000` (daily), `required_duration_ms:1800000` (30 min), `starts_at` anchored to the adopted window (`submit-source.json`, `submit-summary.json`).
7. Unauthenticated `POST /api/v2/scheduler/evaluate` → `401 {"error":"Unauthorized"}`.

## Honest caveat

v2 occurrences are advisory candidates computed from derived ports (step/span/origin/bounds/range). Adopting mirrors only the representable time-of-day into v1 fields; actual v1 placement results are produced by the v1 worker and are not guaranteed to coincide with v2 candidates. `schedulableWindow` (a daily time-of-day constraint) is not fed back into the v2 input ports — v2 `bounds_*` expects absolute instants.
