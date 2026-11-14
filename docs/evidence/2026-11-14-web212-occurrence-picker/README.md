# web#212/#214 occurrence picker — live verification (2026-11-14)

Validated snapshot:

- tastile-web `212-recurring-start-occurrence` @ `cd9a943c7fd833559887d7875e452c7465c9566f` (+ a11y follow-up `cb3c375f`)
- core verify image `tastile-core-verify:rel110-d0c2ce0` (release-1-1-0 code), API `127.0.0.1:31400`, PG `127.0.0.1:55432`
- host `bun run next dev --port 3124`; real PostgreSQL `tastile_verify`; real Chromium via Playwright
- auth: Better Auth sign-in + bridge cookies (no `E2E_BYPASS_AUTH`); session material not included

## Recurring source (`verify212-mwg7a6z5`, source `01a1d960-6ee3-…`)

Daily `interval_ms` source, 30 min required, 14d horizon → 33 occurrences → 33 open placements.

- `recurring-summary.json`, `recurring-session.json`, `recurring-placements-source.json`, `recurring-picker-dom.txt`
- `recurring-01-tasks-list.png`, `recurring-02-occurrence-picker.png`, `recurring-03-after-start.png`
- `recurring-active-tile.json`: active execution `01a1d96a-9283-…` on placement `01a1d96a-3257-…` (span 2026-11-28T01:00–01:30Z)
- `recurring-execution-basis.json`: `placement_id`/`effective_placement_id` = selected placement
- `completion-recurring-run2.json`: finished execution → occurrence `01a1d960-8237-…-7c7a2d4f4515` `met:true`, `completed_segments 1/1`; all other occurrences remain `met:false`
- First run (`completion-after-finish.json`, exec `01a1d967-994d-…`) shows the same lineage for occurrence `01a1d960-6ee6-…-2595ea4da9ef`.

## Split source (`verify212split-mwg7m7se`, source `01a1d968-f879-…`)

`split_policy kind=1` (`min 30m / max 60m / max 5`), 3h required → 33 occurrences × 3 segments = 99 placements; each segment carries its own `plan_id` (the case the predicate fix covers).

- `split-summary.json`, `split-placements-source.json`, `split-picker-dom.txt`, `split-01..03-*.png`
- `split-active-tile.json` / `split-execution-basis.json`: execution `01a1d96a-0339-…` on placement `01a1d968-fa3b-…` (`split_index 0`, span 2026-11-28T05:00–06:00Z)
- `completion-split-after-finish.json`: segment `split_index:0` `met:true`, `completed_segments 1/3`, occurrence `met:false` (remaining segments correctly unmet)

Picker candidate counts observed live: recurring 19–28, split 57 (global `GET /v1/placements` caps at 500 `ORDER BY span_start DESC`; candidates were inside the window).
