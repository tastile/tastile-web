# 2026-07-08 Doc Cleanup — manifest (tastile-web)

> **Reason**: implementation-complete or context-stale plan files moved out of
> `tastile-web/docs/plans/` so future sessions don't re-read them as active.

| Source | New location | Class | Replacement |
| --- | --- | --- | --- |
| `docs/plans/2026-07-04-production-deploy-and-422-diag.md` | this dir | Implemented (3-instance CF-origin drift resolved 2026-07-06 per memory `project_tastile_web_three_instances_20260706.md`; POST /v1/tiles 422 root-caused to legacy BFF handlers) | memory `project_tastile_web_three_instances_20260706.md` + memory `feedback_verify_deployed_artifact.md` |
| `docs/plans/2026-07-04-tile-panel-create-flow.md` | this dir | Mostly done (proxy fix commit `2875827`; atomic Recurring commit `9e76301`) | (no full replacement; commit history is enough — open follow-ups tracked in code TODOs) |

## Open follow-ups (not in this archive, not in any active plan)

The web audit (2026-07-07) flagged 3 QuickTileCreate.tsx UI bugs in
`src/components/tiles/QuickTileCreate.tsx` that are **NOT** covered by any active
plan/spec. They should be filed as `tastile-web/docs/plans/2026-07-08-quick-tile-create-bugs.md`
before the next refactor pass. Summary:

1. `allDay` branch: `if (!endIso || new Date(endIso) <= startDate)` snaps to 24h
   only when end ≤ start, but the default end = start + 9h sneaks through →
   produces 9-hour placements instead of all-day spans.
2. `effectiveEndAt` from the 有効終了日 sub-panel never reaches
   `createRecurringCommand` → `v1_recurring_life.active_end` stays `NULL`.
3. The "完了条件と繰り返し 未追加" pill in `QuickTileCreate` never reflects
   sub-panel state.
