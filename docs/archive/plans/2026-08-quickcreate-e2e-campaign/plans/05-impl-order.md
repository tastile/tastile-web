# 05 — Implementation Order & Dependency Graph

## Dependency graph

```
       ┌──────┐
       │  G   │  stack-up (wslc + e2e plumbing)
       └──┬───┘
          │
       ┌──▼───┐
       │  H   │  auth-bridge (secret alignment + header contract)
       └──┬───┘
          │
   ┌──────┼──────┐
   │      │      │
┌──▼──┐┌──▼──┐┌──▼──┐
│  A  ││  B  ││  C  │   Phase 1 — wire already exists, e2e-ize
└──┬──┘└──┬──┘└──┬──┘
   │      │      │
   └──────┼──────┘
          │
   ┌──────┼──────┐
   │      │      │
┌──▼──┐┌──▼──┐   │
│  D  ││  F  │   │   Phase 2 — wire expansion needed (throw sites)
└──┬──┘└──┬──┘   │
   │      │      │
   └──┬───┘      │
      │          │
   ┌──▼──────────▼─┐
   │      E       │     Phase 3 — Condition tree (Phase C/D)
   └──────────────┘
```

## Execution sequence

| Order | Sub-project | Why this order |
|---|---|---|
| 1 | **G** stack-up | Without local core, nothing can be verified. |
| 2 | **H** auth-bridge | Without secret alignment, every e2e fails at 401/403. |
| 3 | **A / B / C** (parallel) | Wire already exists; only e2e plumbing + gap fixes needed. |
| 4 | **D** throw-site removal/expansion | frame rules + §6 Advanced; precedes E so E can reference stable FrameRule. |
| 5 | **F** throw-site removal/expansion | §7 project + tags; lowest-risk wire expansion. |
| 6 | **E** Condition AST editor | Largest UI surface; needs A, C, D stable before condition bindings are sound. |

A, B, C are not strictly ordered — each is independent. D must precede E because E re-uses FrameRule wiring. F is independent and can run in parallel with D/E if staff allows.

## Risk hotspots

- **G** — wslc image rebuild is ~10 min cold. Image cache + `tastile-pgdata` volume should survive across runs; tear-down via `bash scripts/wslc/down.sh`, full reset via `wslc volume rm tastile-pgdata`. Windows-side Defender blocks `cc1.exe`, so do **not** try to build core from `C:\Users\rebui\Desktop\tastile\tastile-core` — the wslc container is the only path that compiles.
- **H** — `tastile-web/.env.development` `TASTILE_WEB_BRIDGE_SECRET` value does **not** match `scripts/wslc/up-v1.sh` default (`wslc-dev-bridge-secret`). Before running `up-v1.sh`, `export BRIDGE_SECRET=<web's value>` or the bridge auth path returns 401.
- **A/B/C** — `tastile-web/e2e/helpers/v1.ts:93-103,135-150` TRUNCATE list misses `v1_tile` and `v1_annotation`. Existing fixtures (`v1CreatePlacement`, `v1CreateWeeklyRecurring`) create rows there. Helper must be extended before any test relying on row counts is meaningful.
- **D** — frame rules are wire expansion; payload schema risk. Touches `quick-create-schedule-wire.ts:249-257` and likely the SourceScheduleDefinition envelope.
- **E** — Condition AST editor is a large UI surface (10 Term kinds × 4 combinators + EvaluationContext binding). Defer until A/C/D green so binding context is stable.

## Acceptance gates

- **G done** — `curl http://127.0.0.1:31400/v1/health` returns `ok`; `wslc container ls` shows `tastile-db` / `tastile-api` / `tastile-worker` running on `tastile-net`.
- **H done** — `curl -H "x-tastile-web-bridge-secret: …" -H "x-tastile-web-session-user: e2e-bypass" -d '{…}' http://127.0.0.1:31400/v1/schedule-definitions` returns 200 with `aggregate.id` and `aggregateMeta.planId`.
- **A / B / C done** — Playwright spec opens QuickCreate, fills default-state fields, submits, then `SELECT count(*) FROM v1_tile` and `v1_placement` are both > 0; `GET /v1/timeline` shows the new placement.
- **D / F done** — Submitting QuickCreate with §5 frameRules or §7 project/tags populated no longer throws; rows persist in the appropriate v1_* table.
- **E done** — Condition tree editor reachable from UI; submitted AST round-trips through `POST /v1/schedule-definitions` and re-appears on `GET /v1/tiles/{id}/editable`.

## Open questions for user

1. **D (§6 Advanced / §5 frameRules)** — wire expansion (new payload fields + Rust handlers) or UI removal (drop the affordances and store stub-empty)?
2. **E (Condition tree)** — keep silent-drop with disabled UI, or build the full AST editor + EvaluationContext binding?
3. **F (§7 project / tags)** — wire expansion or UI removal? Note: no `Project` or `Tag` entity exists in `v1/02-domain-model*` per the gap matrix — wire expansion here likely means a new v1 table.