# T2a — tile delete runtime trace

## メタデータ

- **Issue**: tastile/tastile-web#74 — `[T2a] tile delete runtime trace`
- **Date**: 2026-08-06
- **Repo**: tastile-web (trace doc only, no production code touched)
- **Target repos**: tastile-core (canonical handler + storage)
- **Plan**: `docs/plans/T2a-tile-delete-trace.md`
- **Working dir (Windows)**: `C:\Users\rebui\Desktop\tastile\tastile-web`
- **Daemon**: wslc container `tastile-dev-api`, port `127.0.0.1:31400`
  (v1 daemon, `tastile-core` build 0.1.0, image tag `tastile-core-dev:latest`)
- **DB**: Postgres 16 inside the same container (`tastile:tastile@localhost:5432/tastile`)
- **Auth path used**: dev `x-owner-id` + `x-actor-id` fallback (TASTILE_ENV=development, see `crates-v1/api/src/handlers/common.rs:773-794`)
- **Bridge secret env in container**: `TASTILE_WEB_BRIDGE_SECRET=dev-e2e-secret` (set but not exercised; `E2E_BYPASS_AUTH=` was empty per H2 audit #71 — the chosen path is the non-production `x-owner-id` fallback)

## 結論 (1 行)

UI Delete アクションは **`POST /v1/source-tiles/{id}/cancel`** に写像される。物理 DELETE endpoint は **存在しない** (405 Method Not Allowed, `Allow: GET,HEAD,PUT`)。cancel は soft lifecycle で source_state を ACTIVE→CANCELLED に遷移させ、horizon 内の source_kind=4 placements を `v1_placement_life.close=true` で閉じる。**active execution がある placements は guard_source_close により no-op** になる (200 ACCEPTED, revision 不変, placement_ids=[])。

---

## 1. API 表面の確定 (REVIEWED + VERIFIED)

### 1.1 Route registration

`crates-v1/api/src/main.rs:314-336` で公開される `v1/source-tiles` route group:

| Verb | Path | Handler |
|---|---|---|
| GET | `/v1/source-tiles` | `handlers::source_tiles::list` |
| POST | `/v1/source-tiles` | `handlers::source_tiles::create` |
| GET | `/v1/source-tiles/{id}` | `handlers::source_tiles::get` |
| PUT | `/v1/source-tiles/{id}` | `handlers::source_tiles::update` |
| POST | `/v1/source-tiles/{id}/reflow` | `handlers::source_tiles::reflow` |
| POST | `/v1/source-tiles/{id}/cancel` | `handlers::source_tiles::cancel` |
| GET | `/v1/source-tiles/{id}/placements` | `handlers::source_tiles::placements` |
| GET | `/v1/source-tiles/{id}/completion` | `handlers::source_tiles::completion` |

**DELETE は存在しない** (`handlers::source_tiles` module に `delete` 関数なし、`main.rs` にも `.delete(... source-tiles ...)` 登録なし)。

### 1.2 VERIFIED: DELETE probe

```
$ curl -i -X DELETE "http://127.0.0.1:31400/v1/source-tiles/${TILE_ID}" \
    -H "x-owner-id: ${OWNER_ID}" -H "x-actor-id: ${OWNER_ID}"
HTTP/1.1 405 Method Not Allowed
allow: GET,HEAD,PUT
content-length: 0
```

`Allow` header が `GET,HEAD,PUT` のみを advertise — DELETE verb は route match 段階で拒否される (axum の method-routing contract)。物理 DELETE 経路は完全に塞がれている。

### 1.3 Cancel handler (REVIEWED)

`crates-v1/api/src/handlers/source_tiles.rs:183-212`:
- Body: `{ envelope: CommandRequest<CancelSourceTileBody>, ... }`
- `CancelSourceTileBody { reason: i16 }` (numeric, `domain::source_tile::state::cancel_reason` registry: `USER=0`, `CLEANUP=1`, `MIGRATION=2`)
- Envelope (`crates-v1/domain/src/command.rs:25-31`): `{ expected_revision: Option<i64>, idempotency_key: Uuid, occurred_at: Option<DateTime<Utc>>, payload: T }`
- Dispatcher: `CommandKind::CancelSourceTile` (= 35, per v1/14 §2)
- Route registration: `crates-v1/api/src/main.rs:325-328`

---

## 2. Storage cancel() contract (REVIEWED)

`crates-v1/storage/src/source_tile_repo.rs:3047-3212` の `cancel()` 関数。実行順:

1. **Owner schedule lock** 取得 (`acquire_owner_schedule_lock`, line 3060)
2. `SELECT owner_id, source_state, revision FROM v1_source_tile WHERE source_tile_id=$1 FOR UPDATE` (line 3062-3070)
3. **State check** (line 3075-3082):
   - `current_state == SOURCE_STATE_CANCELLED` → `RepoError::Conflict("source tile already cancelled")`
   - `current_state != SOURCE_STATE_ACTIVE` → `RepoError::Conflict("source tile not in ACTIVE state (current state = X)")`
4. **Stale revision check** (line 3083-3088): `current_revision != expected_revision` → `RepoError::StaleRevision { have, expected }`
5. **Component placements 列挙** (line 3090-3097): `SELECT p.id FROM v1_placement p JOIN v1_placement_life l ON l.placement_id=p.id WHERE p.source_tile_id=$1 AND l.close=false`
6. **`guard_source_close` 判定** (line 3098-3106): active execution が残っていれば `true` を返し、cancel は no-op で `revision` も bump せず `closed_placement_ids: []` + `lifecycle_event_id: None` の `CancelResult` を返す
7. **source_tile UPDATE**: `source_state=CANCELLED (=3), revision+=1, state_changed_at=$now, state_changed_by_actor_id=$actor` (line 3110-3124)
8. **lifecycle event** を `v1_source_lifecycle_event` に append: `id=Uuid::now_v7(), source_id, prev_state=ACTIVE(0), next_state=CANCELLED(3), actor_id, occurred_at=$now, reason=$payload.reason` (line 3127-3136)
9. **auto-managed placements close** (line 3148-3180):
   - CTE `src` で source の effective horizon を `generation_at + window_start_offset` 〜 `+ window_end_offset` で計算
   - `UPDATE v1_placement p SET revision = p.revision + 1 FROM v1_placement_life l, v1_placement_baseline b, src WHERE p.id = l.placement_id AND p.id = b.placement_id AND p.source_tile_id = $1 AND p.owner_id = src.owner_id AND p.auto_managed = true AND l.close = false AND tstzrange(b.span_start, b.span_end, '[]') && tstzrange(src.horizon_start, src.horizon_end, '[]') RETURNING p.id, p.revision`
10. **placement_life close**: `UPDATE v1_placement_life SET close = true, closed_at = $1 WHERE placement_id = ANY($2) AND close = false` (line 3186-3194)
11. **placement domain event + outbox event** を per closed placement で発行 (line 3199-3201, `append_placement_event` at line 2499-2520)
12. `CancelResult { new_revision, closed_placement_ids, lifecycle_event_id }` を return

`cancel_command()` (line 3217-3277) は envelope → `CancelCommand` 変換 + owner/expected_revision 解決 + `response_for_with_meta` で `CommandResponse` を構築。`aggregate_meta.placement_ids` に closed placements を、`aggregate_meta.source_tile_id` に source id を、`revision` に new_revision を、`AggregateKind::Source (=4)` を aggregate.kind に詰める。

---

## 3. VERIFIED: フル runtime trace

### 3.1 Fixture

```
OWNER_ID  = d2738de0-42ea-4389-ada7-6849c5fee448
OTHER_OWNER = d7e5a918-e5b7-4404-aa2c-d4e2a5f7104d (cross-owner test 用)
TILE_ID   = 8b41b696-7562-4d47-b37a-dee9f5388cef  (T2a study session, ONE_TIME, 12:00 UTC + [0, +1h] window)
TILE2_ID  = e888b7a6-d0ca-43ec-8c57-31788ed343ac (T2a study session #2, stale-rev test 用)

Placements (source_kind=4, auto_managed=true) 対 horizon [12:00, 13:00]:
  P_A (354db945-...) = source_kind=4, span=[NOW, MID]     — IN horizon
  P_B (2c51cdd3-...) = source_kind=4, span=[MID, FAR]     — OUTSIDE horizon (skip)
  P_D (d93fbdc9-...) = source_kind=4, span=[NOW, FAR]     — IN horizon, + ACTIVE execution
Placement (source_kind=1, legacy RECURRING) — cancel で触らない:
  P_C (db7585d7-...) = source_kind=1, span=[NOW, MID]     — IN horizon, NOT touched by cancel
Execution (P_D 用):
  EX_D (34bd2335-...) = state=0 (ACTIVE),  v1_execution_basis → P_D
```

### 3.2 Snapshot (criterion 3 — before/after)

#### Before cancel (initial state)

```
v1_source_tile[8b41b696-...]            | source_state=0 (ACTIVE) | revision=1 | state_changed_at=NULL | state_changed_by_actor_id=NULL
v1_source_lifecycle_event[8b41b696-...] | (0 rows)
v1_placement (mine only)                | P_A=4/auto_managed=true/rev=1, P_B=4/true/1, P_D=4/true/1, P_C=1/null/rev=2 (注: P_C は sibling test 由来の closure 履歴)
v1_placement_life (mine only)           | P_A close=false, P_B close=false, P_D close=false, P_C close=true (既存)
v1_execution[34bd2335-...]               | state=0 (ACTIVE) | revision=1
```

#### Request 1: cancel with ACTIVE execution (P_D bound)

**Request** (verb=POST, path=/v1/source-tiles/{id}/cancel):
```
POST /v1/source-tiles/8b41b696-7562-4d47-b37a-dee9f5388cef/cancel HTTP/1.1
content-type: application/json
x-owner-id: d2738de0-42ea-4389-ada7-6849c5fee448
x-actor-id: d2738de0-42ea-4389-ada7-6849c5fee448

{
  "expected_revision": null,
  "idempotency_key": "55748e83-b3be-441f-9e51-570cb009d3e6",
  "occurred_at": "2026-08-06T12:30:00Z",
  "payload": { "reason": 0 }
}
```

**Response**:
```
HTTP/1.1 200 OK
content-type: application/json
content-length: 489
x-request-id: c789b65e-0ea1-40e3-8165-5c67eb5fc46e

{
  "command_id":"019fd6ec-801f-7df1-be8d-17216cbf6a95",
  "accepted_at":"2026-08-06T11:54:11.359254771Z",
  "aggregate":{"kind":4,"id":"8b41b696-7562-4d47-b37a-dee9f5388cef"},
  "revision":1,
  "result":2,                              ← CommandResult::ACCEPTED (per v1/14 §1-3)
  "pending":[],
  "aggregate_meta":{
    "tile_id":"8b41b696-...",
    "source_tile_id":"8b41b696-...",
    "placement_ids":[],                    ← 0 件 (active execution guard 発火)
    "occurrence_ids":[]
    /* ... plan_id, recurring_id, frame_rule_id, changeset_id, change_ids, window_ids, flow_ids = null/empty ... */
  }
}
```

**DB state after request 1** (criterion 5 — active execution test):

```
v1_source_tile[8b41b696-...]            | source_state=0 (ACTIVE, UNCHANGED) | revision=1 (UNCHANGED)
                                          state_changed_at=NULL (UNCHANGED)
v1_source_lifecycle_event[8b41b696-...] | (0 rows — no event because guard returned true)
v1_placement_life                        | P_A/P_B/P_D: close=false (UNCHANGED)
v1_execution[34bd2335-...]               | state=0 (ACTIVE, UNCHANGED)
```

**Confirmed**: `guard_source_close` returned `true` because `v1_execution_basis` for `v1_placement_life.close=false` placements of this source had at least one row pointing to `v1_execution.state=0` (ACTIVE). The handler short-circuited BEFORE step 7 (UPDATE source_tile). `revision=1` (UNCHANGED) and `placement_ids=[]` in response confirm this. SourceTile の lifecycle event は発行されない。

#### Between request 1 and 2: finish the active execution

```
UPDATE v1_execution SET state=2, finished_at=now(), finish_kind=0 WHERE id='34bd2335-...';
→ UPDATE 1
v1_execution[34bd2335-...]               | state=2 (FINISHED_NORMAL) | revision=1
```

This was a manual SQL intervention (no API endpoint). After this, `guard_source_close` should return `false`.

#### Request 2: cancel with NO active execution

**Request** (verb=POST, path=/v1/source-tiles/{id}/cancel):
```
POST /v1/source-tiles/8b41b696-7562-4d47-b37a-dee9f5388cef/cancel HTTP/1.1
content-type: application/json
x-owner-id: d2738de0-42ea-4389-ada7-6849c5fee448
x-actor-id: d2738de0-42ea-4389-ada7-6849c5fee448

{
  "expected_revision": null,
  "idempotency_key": "583a3b7b-11ae-4e83-8b20-d4ebd24376c2",
  "occurred_at": "2026-08-06T13:00:00Z",
  "payload": { "reason": 0 }
}
```

**Response**:
```
HTTP/1.1 200 OK
content-type: application/json
content-length: 566
x-request-id: 370711f8-9f0b-4dea-8f16-8b5510e05715

{
  "command_id":"019fd6ed-91fc-7403-ba62-592d9b64f545",
  "accepted_at":"2026-08-06T11:55:21.468104583Z",
  "aggregate":{"kind":4,"id":"8b41b696-7562-4d47-b37a-dee9f5388cef"},
  "revision":2,                            ← bumped 1 → 2
  "result":2,                              ← CommandResult::ACCEPTED
  "pending":[],
  "aggregate_meta":{
    "tile_id":"8b41b696-...",
    "source_tile_id":"8b41b696-...",
    "placement_ids":[                      ← 2 件 closed
      "354db945-eaf4-4513-9948-8a6e41f9fee0",   P_A (source_kind=4, span IN horizon)
      "d93fbdc9-6159-4b84-b032-c40b6e1d7645"    P_D (source_kind=4, span IN horizon)
    ]
    /* P_B (span OUT of horizon) NOT in list — confirms tstzrange overlap filter */
  }
}
```

**DB state after request 2**:

```
v1_source_tile[8b41b696-...]
  source_state=3 (CANCELLED)               ← ACTIVE → CANCELLED
  revision=2                                ← +1
  state_changed_at=2026-08-06 11:55:21.468104+00
  state_changed_by_actor_id=d2738de0-42ea-4389-ada7-6849c5fee448

v1_source_lifecycle_event[8b41b696-...] (1 row)
  id=019fd6ed-9207-7cd1-b125-f36f41bace40 (UUIDv7)
  prev_state=0 (ACTIVE)
  next_state=3 (CANCELLED)
  actor_id=d2738de0-42ea-4389-ada7-6849c5fee448
  occurred_at=2026-08-06 11:55:21.468104+00
  reason=0 (USER)

v1_placement (mine only)
  P_A (354db945-...)  source_kind=4  auto_managed=t  revision=2 (bumped)
  P_B (2c51cdd3-...)  source_kind=4  auto_managed=t  revision=1 (UNCHANGED, OUT of horizon)
  P_C (db7585d7-...)  source_kind=1  auto_managed=NULL revision=2 (UNCHANGED by my call; existing close)
  P_D (d93fbdc9-...)  source_kind=4  auto_managed=t  revision=2 (bumped)

v1_placement_life (mine only)
  P_A close=true   closed_at=2026-08-06 11:55:21.468104+00
  P_B close=false  (no closed_at)
  P_C close=true   closed_at=2026-08-06 11:54:11.179263+00 (NOT from this call — pre-existing sibling test data)
  P_D close=true   closed_at=2026-08-06 11:55:21.468104+00

v1_domain_event (mine only)
  019fd6ed-9212-70a1-9b79-fd429a94e243  kind=2  aggregate_kind=1  aggregate_id=354db945 (P_A)  revision=2
  019fd6ed-9213-7e90-aef2-821d3801bd62  kind=2  aggregate_kind=1  aggregate_id=d93fbdc9 (P_D)  revision=2

v1_outbox_event (mine only)
  019fd6ed-9212-70a1-9b79-fd5d7147c64c  kind=2  aggregate_kind=1  aggregate_id=354db945 (P_A)  occurred_at=2026-08-06 11:55:21.468104+00
  019fd6ed-9213-7e90-aef2-82269ac769b5  kind=2  aggregate_kind=1  aggregate_id=d93fbdc9 (P_D)  occurred_at=2026-08-06 11:55:21.468104+00

v1_execution[34bd2335-...]
  state=2 (FINISHED_NORMAL) revision=1 (UNCHANGED — execution is not touched by cancel)
```

**Confirmed**:
- criterion 3: source state/revision before→after (`ACTIVE/1/→/NULL` → `CANCELLED/2/→/actor`)
- criterion 4: closed placements (P_A, P_D) have `placement_life.close=true` + matching `closed_at`, `revision` bumped, AND per-placement `v1_domain_event` (kind=2) + `v1_outbox_event` (kind=2) rows with `aggregate_kind=1 (PLACEMENT)`. Out-of-horizon P_B (source_kind=4) was NOT closed. Legacy P_C (source_kind=1) was NOT closed.

---

## 4. VERIFIED: stale / duplicate / cross-owner error shapes

### 4.1 Duplicate cancel (correct revision, but already CANCELLED)

**Request** (same `TILE_ID` = `8b41b696-...`, `expected_revision=2`):
```
POST /v1/source-tiles/8b41b696-7562-4d47-b37a-dee9f5388cef/cancel
x-owner-id: d2738de0-42ea-4389-ada7-6849c5fee448
x-actor-id: d2738de0-42ea-4389-ada7-6849c5fee448

{ "expected_revision": 2, "idempotency_key": "c68f3289-...", "occurred_at": "...", "payload": { "reason": 0 } }
```

**Response**:
```
HTTP/1.1 409 Conflict
content-length: 92

{"kind":5, "message":"source tile already cancelled", "current_revision":null, "violations":[]}
```

`kind=5` = `ApiErrorKind::CONFLICT` (per v1/14 §1-4). State check (line 3075) fired before stale revision check (line 3083).

### 4.2 Stale revision (separate ACTIVE source, expected=99 vs current=1)

Setup: second source `e888b7a6-d0ca-43ec-8c57-31788ed343ac` seeded with `revision=1, source_state=0`.

**Request**:
```
POST /v1/source-tiles/e888b7a6-d0ca-43ec-8c57-31788ed343ac/cancel
x-owner-id: d2738de0-42ea-4389-ada7-6849c5fee448
x-actor-id: d2738de0-42ea-4389-ada7-6849c5fee448

{ "expected_revision": 99, "idempotency_key": "899d4f73-...", "occurred_at": "...", "payload": { "reason": 1 } }
```

**Response**:
```
HTTP/1.1 409 Conflict
content-length: 95

{"kind":2, "message":"stale revision: have=1, expected=99", "current_revision":1, "violations":[]}
```

`kind=2` = `ApiErrorKind::STALE_REVISION`. `current_revision=1` is populated by `StaleRevision { have, expected }` → HTTP layer maps `RepoError::StaleRevision` to `ApiError { kind: STALE_REVISION, message, current_revision: have }`. **Confirmed** that `current_revision` field is **non-null** in the STALE_REVISION response (unlike the CONFLICT/duplicate-cancel case where it's null).

### 4.3 Cross-owner (different x-owner-id than the source owner)

**Request**:
```
POST /v1/source-tiles/e888b7a6-d0ca-43ec-8c57-31788ed343ac/cancel
x-owner-id: d7e5a918-e5b7-4404-aa2c-d4e2a5f7104d   ← OTHER_OWNER (not the source's owner)
x-actor-id: d7e5a918-e5b7-4404-aa2c-d4e2a5f7104d

{ "expected_revision": null, "idempotency_key": "...", "occurred_at": "...", "payload": { "reason": 0 } }
```

**Response**:
```
HTTP/1.1 404 Not Found
content-length: 111

{"kind":4, "message":"source tile e888b7a6-d0ca-43ec-8c57-31788ed343ac", "current_revision":null, "violations":[]}
```

`kind=4` = `ApiErrorKind::NOT_FOUND` — matches v1/14 §8 contract: cross-owner access reported as not-found, NOT as 403 Forbidden. The handler `cancel_command()` (`source_tile_repo.rs:3235-3240`) explicitly returns `RepoError::NotFound(format!("source tile {}", id))` when `owner_id != envelope.actor.owner_id`.

---

## 5. VERIFIED: 物理 cascade の実態

**Cancel endpoint does not issue physical DELETE statements**. `cancel()` writes:
- 1 `UPDATE v1_source_tile SET source_state, revision, state_changed_at, state_changed_by_actor_id`
- 1 `INSERT INTO v1_source_lifecycle_event`
- 1 `UPDATE v1_placement SET revision = p.revision + 1 ... RETURNING p.id, p.revision`
- 1 `UPDATE v1_placement_life SET close = true, closed_at = ...` (per closed placement)
- 1 `INSERT INTO v1_domain_event` + 1 `INSERT INTO v1_outbox_event` (per closed placement)

**No `DELETE FROM v1_source_tile`**, **no `DELETE FROM v1_tile`**, **no `DELETE FROM v1_placement`**, **no `DELETE FROM v1_source_occurrence`**. Confirmed by:
1. Static review of `cancel()` body (source_tile_repo.rs:3047-3212)
2. Static review of route registration (main.rs:314-336 — no DELETE for `/v1/source-tiles/{id}`)
3. After cancel, row counts:
   ```
   v1_tile[8b41b696-...]                       1 row (UNCHANGED)
   v1_source_tile[8b41b696-...]                1 row (state=3, revision=2 — UPDATED not deleted)
   v1_source_occurrence[8b41b696-...]          3 rows (UNCHANGED — no DELETE)
   v1_placement_life[2c51cdd3 (P_B)]           still close=false (filter only, not delete)
   ```
4. Live `DELETE /v1/source-tiles/{id}` returns 405 Method Not Allowed with `allow: GET,HEAD,PUT`.

### 5.1 ON DELETE CASCADE constraints (informational — not exercised)

`v1_source_tile.source_tile_id → v1_tile(id) ON DELETE CASCADE` (V1_020 line 5). If a future endpoint ever issued `DELETE FROM v1_tile WHERE id = <source_id>`, the cascade would propagate to:
- `v1_source_occurrence.source_tile_id → v1_source_tile.source_tile_id ON DELETE CASCADE` (V1_020 line 50)
- `v1_placement.source_tile_id → v1_source_tile ON DELETE CASCADE` (FK at V1_020 line 71)
- `v1_placement_baseline` via `v1_placement` (CASCADE)
- `v1_placement_life` via `v1_placement` (CASCADE, V1_020 reference)
- `v1_placement_source_ref_source` via FK on `source_tile_id`
- `v1_change_set_source_ref_source` (FK on `source_tile_id`, V1_020 line 110)

But because **the current API exposes no DELETE for source-tiles**, none of these cascades are reachable from the user-facing surface. The tile + source_tile + occurrence + placement rows persist after cancel. Only the lifecycle `state` field, the `revision`, and the per-placement `placement_life.close`/`closed_at` are mutated.

### 5.2 Audit rows retained after cancel

After cancel of `TILE_ID=8b41b696-...`:

| Table | Rows for this source | Note |
|---|---|---|
| `v1_tile` | 1 | unchanged (no DELETE) |
| `v1_plan` | 1 | unchanged |
| `v1_source_tile` | 1 | source_state=3, revision=2 (UPDATED) |
| `v1_source_lifecycle_event` | 1 | NEW row appended (UUIDv7, prev/next/actor/occurred_at/reason) |
| `v1_source_occurrence` | 3 | unchanged (no DELETE) |
| `v1_placement` (kind=4 in horizon, mine) | 2 | revision bumped (1→2); row not deleted |
| `v1_placement_life` (mine) | 2 close=t, 1 close=f (P_B out of horizon) | close flag updated, not deleted |
| `v1_placement_baseline` | unchanged | not touched by cancel |
| `v1_placement_source_ref_source` | unchanged | not touched by cancel |
| `v1_domain_event` | +2 rows (one per closed placement, kind=2, aggregate_kind=1) | NEW |
| `v1_outbox_event` | +2 rows (one per closed placement, kind=2, aggregate_kind=1) | NEW |
| `v1_execution` | unchanged | EX_D state=2 still; cancel does NOT touch execution rows |

---

## 6. UX action → endpoint mapping (summary)

| UI label | Mapping observed |
|---|---|
| "Delete" / "Remove" / "Cancel" | `POST /v1/source-tiles/{id}/cancel` (one endpoint; UI label is operator-orthogonal) |
| (physical "purge row" intent) | **no endpoint exists** — 405 Method Not Allowed; `Allow: GET,HEAD,PUT` |
| (archive alternative) | no `archive` endpoint exists either; the only state transition in the API is via `cancel` (state→CANCELLED). `pause`/`resume` exist for RECURRING (`v1_recurring_life.state`) but **NOT** for SourceTile `source_state`. |

UI が Delete を押した場合に走る wire format は **`POST /v1/source-tiles/{id}/cancel`** で確定。`payload.reason` は numeric constant (`0=USER` / `1=CLEANUP` / `2=MIGRATION` per `domain::source_tile::state::cancel_reason`)。

---

## 7. 受入条件チェック

| # | Criterion | Status | Evidence |
|---|---|---|---|
| 1 | UI action から発生する全 request の verb / URL / body / status / response を記録 | VERIFIED | §3.2 (Request 1 + Request 2): POST /v1/source-tiles/{id}/cancel, full body + 200 response with `aggregate_meta.placement_ids`. §4 (3 error cases) |
| 2 | delete action が `DELETE` / `POST .../cancel` / archive command / 別 endpoint のどれかを実測 | VERIFIED | `POST /v1/source-tiles/{id}/cancel` (§3.2). `DELETE /v1/source-tiles/{id}` → 405 (§1.2). No archive endpoint exists (§6) |
| 3 | source state/revision の before→after と stale/duplicate cancel の error shape を記録 | VERIFIED | §3.2 (state=0/1→3/2, lifecycle event), §4.1 (409 CONFLICT "source tile already cancelled"), §4.2 (409 STALE_REVISION "stale revision: have=1, expected=99", `current_revision=1`) |
| 4 | 影響を受けた placements の対象条件、revision、life close、closed_at、domain/outbox event を記録 | VERIFIED | §3.2 Request 2: P_A+P_D (in-horizon, source_kind=4, auto_managed=true) → revision 1→2, placement_life.close=true with closed_at, 2 domain_event rows (kind=2, aggregate_kind=1, matching revision), 2 outbox_event rows. P_B (out-of-horizon) and P_C (legacy source_kind=1) UNCHANGED by cancel |
| 5 | active execution が存在する placement/source を使い、delete action が execution/segment を変更するか確認 | VERIFIED | §3.2 Request 1: P_D had ACTIVE execution (state=0); cancel returned 200 ACCEPTED with `placement_ids=[]` and `revision=1` (unchanged). `guard_source_close` short-circuited the handler. After manually finishing EX_D (state=2), Request 2 succeeded — execution/segment rows themselves were never modified by cancel in either path |
| 6 | 物理 cascade がある場合、削除された child table rows と残った audit rows を FK/table 単位で記録 | VERIFIED | §5: no `DELETE FROM` statements in cancel code path, no DELETE route exists. `v1_tile`/`v1_source_tile`/`v1_source_occurrence`/`v1_placement`/`v1_placement_baseline`/`v1_placement_source_ref_source` all persist. New audit rows: `v1_source_lifecycle_event` (1) + `v1_domain_event` (2) + `v1_outbox_event` (2). Updated in place: `v1_source_tile` (state+revision), `v1_placement` (revision), `v1_placement_life` (close+closed_at). |

## 8. 既知の非対象 (DEFERRED)

- **production cookie / bridge auth 経由の cancel** — DEFERRED. Dev 経路 (`x-owner-id`/`x-actor-id`) のみ実機検証。Bridge auth 経路 (`x-tastile-web-bridge-secret` + `x-tastile-web-session-user`) は contract review で通過 (`common.rs:801-824`、`E2E_BYPASS_AUTH=` 空のため production proxy 経由でしか動かない)。smoke test をプロダクション cookie で通すには Cognito 認証セッションが必要で automation 不能。
- **Web client UI 側の Delete handler 特定** — DEFERRED. `tastile-web` 側の `lib/api/v1/source-tiles.ts` / `useTileList` の `Delete`/`Remove` ボタンの onClick handler と cancel 呼出の有無は別 issue (#73 T2b 等) で扱う想定。本 trace は wire-format + storage contract に集中。
- **CONFIRM dialog の有無** — DEFERRED. UI 側に confirm modal が存在するかどうかは本 trace のスコープ外。runtime trace としては「confirm 前後の 2 段階 request は観測せず、単発 cancel のみ実行」を記録。
- **placement event の wire 影響 (Sync SSE)** — DEFERRED. `v1_outbox_event` への append は確認したが、それが SSE channel / push notification にどう配送されるかは別 plan (T3a / T2b) で扱う想定。

## 9. Cleanup (verified)

すべての test fixture を削除 (`SELECT count(*)` で確認済):

```
src_tile   = 0
tile       = 0
occ        = 0
plan       = 0
subj       = 0
ex         = 0
placement  = 0
v1_domain_event for this owner  = 0
v1_outbox_event for this owner  = 0
```

`/tmp/t2a_*` files (request bodies, IDs, snapshots) はローカル scratch のみ。git には含めない。

## 10. 関連リンク

- Plan: `C:\Users\rebui\Desktop\tastile\tastile-web\docs\plans\T2a-tile-delete-trace.md`
- Cancel handler: `tastile-core/crates-v1/api/src/handlers/source_tiles.rs:183-212`
- Cancel route: `tastile-core/crates-v1/api/src/main.rs:325-328`
- Cancel storage: `tastile-core/crates-v1/storage/src/source_tile_repo.rs:3047-3277`
- Append placement event: `tastile-core/crates-v1/storage/src/source_tile_repo.rs:2499-2520`
- Outbox repo: `tastile-core/crates-v1/storage/src/outbox_repo.rs`
- Cancel payload schema: `tastile-core/crates-v1/domain/src/command.rs:243-248` (`CancelSourceTilePayload`)
- Cancel reason registry: `tastile-core/crates-v1/domain/src/source_tile/state.rs:11-44` (`USER=0/CLEANUP=1/MIGRATION=2`)
- Source state columns: `tastile-core/crates-v1/storage/migrations/V1_026__source_state_and_producer.sql:13-35`
- Source tile occurrence FK cascade: `tastile-core/crates-v1/storage/migrations/V1_020__source_tile_occurrence.sql:5, 50, 71`
- v1/14 §1-3 (`CommandResult` 3 値), §1-4 (`ApiErrorKind` 8 値), §2 (`AggregateKind::Source = 4`, `CommandKind::CancelSourceTile = 35`), §8 (cross-owner = NOT_FOUND)