# Sub-project A — Tile + Plan + Meta (minimum) wire + e2e

## 1. 目的

Default-state QuickCreate submission persists **one row to `v1_tile`** and **one row to `v1_plan`** in core's Postgres, observable via `GET /v1/timeline`. The wire already routes the §1 Identity + §2 Plan + §7 Meta (minus `project`, `tags`, `frame_rule`, `flows`) fields end-to-end; the deliverable is (a) real-DB verification of that path and (b) the e2e plumbing to prove it.

## 2. 対象フィールド

| Field | Store path | Wire path (file:line) | Status |
|---|---|---|---|
| `Tile.kind` | `identity.kind` | `quick-create-schedule-wire.ts:347` (implied via `tile` payload) | ✓ |
| `Tile.content.title` | `identity.title` | `:343` | ✓ |
| `Tile.content.description` | `identity.description` ∨ `meta.memo` | `:344` | ✓ |
| `Tile.visual.color` | `identity.visual.color` | `:345` | ✓ |
| `Tile.visual.icon` | `identity.visual.icon` | `:346` | ✓ |
| `Tile.externalId` | `identity.externalId` | `:347` | ✓ (UUIDv7 raw; spec is `String?`, schema-drift risk noted in §6) |
| `Plan.role` | `plan.role` ∨ `meta.isLabelOnly` | `:350` | ✓ |
| `Plan.references[]` | `plan.references[]` | `:351` (with `reference_targets` derived `:308-324`) | ✓ UUID-only persistence |
| `Plan.completion.{root,timeRequirements,tasks}` | `plan.completion.*` | `:352` | ✓ |
| `Plan.planning.{placement_rules,nesting_rules}` | `plan.planning` | `:354-355` | ✓ |
| `Plan.metrics[]` | `plan.metrics` | `:357` | ✓ |
| `Plan.decisions[]` | `plan.decisions` | `:358` | ✓ |
| `meta.ownerSubjectId` | header-derived | `handlers/common.rs:823` (UUIDv5) | ✓ via H |

## 3. 変更手順

1. **No source change required.** All fields in §2 already traverse `buildQuickCreateSchedulePayload` (`:213-450`) → `publishScheduleDefinition` → `POST /v1/schedule-definitions` and core's `CreateSourceTilePayload` (`crates-v1/api/src/commands.rs:112`, `command.rs:198`) consumes the same envelope.

2. **Edit `tastile-web/e2e/quick-tile-create-e2e.spec.ts`** to assert default-state submission produces rows. Steps:
   - Replace `docker exec tastile-core-db-1 psql …` cleanup (`:14-23`) with `wslc container exec tastile-db psql -U tastile -d tastile_db -c "TRUNCATE v1_placement, v1_event, v1_change_set, v1_window, v1_recurring, v1_annotation, v1_tile RESTART IDENTITY CASCADE;"`. Add `v1_tile`, `v1_annotation` to the existing list (current helper at `e2e/helpers/v1.ts:93-103,135-150` omits both — `v1CreatePlacement` and `v1CreateWeeklyRecurring` create rows there).
   - Replace post-submit v0 verification (if any) with a real-DB assertion: count `v1_tile` rows where `title = <submitted-title>` and `v1_plan` rows where `tile_id = <new-tile-id>`.
   - Optional: assert `GET /v1/timeline?from=…&to=…` contains the new `source_tile_id`.

3. **Run `bun run test:e2e quick-tile-create-e2e.spec.ts`** against `bash scripts/wslc/up-v1.sh`-started core. Green = done.

## 4. e2e 検証

- Spec: `tastile-web/e2e/quick-tile-create-e2e.spec.ts` (existing, modified).
- Pre-state: empty DB after TRUNCATE.
- Action: open QuickCreate, fill `title="E2E smoke"` + `description="…"`, leave §3-§7 at defaults, submit.
- Assertions:
  - `wslc container exec tastile-db psql -t -c "SELECT count(*) FROM v1_tile WHERE title='E2E smoke'"` → `1`
  - Same for `v1_plan` with the resulting `tile_id`.
  - `GET /v1/timeline` shows the source tile.
- Pass = 200, one of each row, timeline contains it.

## 5. スコープ外

- `Plan.planning.flows[]` (THROW `:249-257`) — sub-project D.
- `Plan.references[]` editor (target/pick) — UUID-only persistence stays; no editor in this round.
- `Plan.metrics[]` / `Plan.decisions[]` editors — UUID-only persistence stays; sub-project E.
- `Tile.frame_rule` — sub-project D.
- `meta.project`, `meta.tags[]` (THROW `:240-242`) — sub-project F.

## 6. リスク

- **`Tile.externalId` schema drift**: spec says `String?` (`v1/02:33`), web passes raw UUIDv7. Core's handler may or may not coerce. Mitigation: in e2e, leave `externalId` blank for the smoke test; investigate validator separately if needed.
- **`Plan.references[]` UUID validation**: web emits raw strings, core expects UUIDv7 refs (`v1/02:61`). With default state this is empty, so no risk in the smoke test; verify separately if/when references editor ships.
- **`Plan.completion` default state**: the wire folds a single default "Mark done" task into the completion tree (`:269-276`); core accepts this without error, but verify no invariant violation against `v1/13`.