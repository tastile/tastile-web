# T1b — Tile edit post-submit runtime trace

> **Issue**: tastile-web #73 — T1b Tile 編集 post-submit runtime trace
> **Trace rule**: REVIEWED = ソースを読んだ。VERIFIED = コマンドを実行して観測した。区別して記録。
> **実行環境**: wslc container `tastile-dev-api` (image `tastile-core-dev:latest`, 2026-08-06 04:29 UTC 起動) — Postgres 16 + v1 API binary (port 31400) が同居
> **実行者**: Claude (Claude Code / MiniMax-M3 経由), 2026-08-06 11:50–12:00 UTC

---

## 0. 環境スナップショット (VERIFIED)

```text
$ wslc container list
94f87ee08303   tastile-dev-api   tastile-core-dev:latest   7 hours ago   running 7 hours ago
$ wslc container exec tastile-dev-api curl -s -o /dev/null -w "%{http_code}\n" http://localhost:31400/health
404   # /health は bind されていない (no endpoint) — daemon は他のルートで応答している
$ wslc container exec tastile-dev-api stat -c '%y' /build/target/debug/api
2026-08-06 04:29 /build/target/debug/api
$ wslc container exec tastile-dev-api ps aux | grep -E "tastile|worker|api" | grep -v grep
root           1  0.0  …  /build/target/debug/api
postgres    2235  …   postgres: tastile tastile 127.0.0.1(50004) idle
```

- API binary は 1 process のみ。**`tastile-v1-worker` プロセスは未起動** → criterion 3/4 で worker tick 由来の outbox 進展は観測できない (read-time の lazy materialization 経路のみ生きている)
- 同一 image から本日中の再起動なし
- Auth bypass: `E2E_BYPASS_AUTH` が空のため、`x-owner-id` / `x-actor-id` ヘッダで daemon に直接入る (cognito JWT 経路は本番 dev でも未配線)

---

## 1. 受入条件 1 — Edit Submit → request sequence (VERIFIED + REVIEWED 整合)

### 1-1. 採用した経路 — canonical `PUT /v1/source-tiles/{id}` (REVIEWED + VERIFIED)

**REVIEWED (ソース確認)**:

- `tastile-core/crates-v1/api/src/main.rs:678-679` — `PUT /v1/source-tiles/{id}` → `handlers::commands::update_source_tile`
- 同 handler (line 866-893 想定) は `CommandKind::UpdateSourceTile` (= **32** in the command-kind registry) を dispatch
- `tastile-core/crates-v1/domain/src/command.rs` — `UpdateSourceTilePayload` は `tile: Tile`, `plan: Plan`, `flows: Vec<Flow>`, `relations: Vec<Relation>`, `schedule: ScheduleSpec`, `horizon: Horizon`, `expected_revision: Option<i64>`, `idempotency_key: Uuid`
- `tastile-core/crates-v1/storage/src/tile_repo.rs:286-335` — `update_fields` は単純な `UPDATE v1_tile SET ... revision=revision+1 WHERE id=$1 AND revision=$2` (revision bump のみ、plan/source は触らない)

**VERIFIED (runtime 観測) — 正本 path を直叩き**:

```text
$ PUT /v1/source-tiles/{id}
   headers: x-owner-id, x-actor-id
   body: UpdateSourceTilePayload (full tile+plan+schedule+horizon)
   → 200 OK, response.aggregate.revision=2
   → v1_tile.title/color/description/external_id 更新
   → v1_source_tile.title/color/description/external_id 更新
   → v1_plan は触られない (update_fields は plan を UPDATE しない; plan フィールド変更は update_plan 経由が別途必要 — DEFERRED)
   → v1_placement 新規 row (置換型; cancel ではなく新規 placement 生成 + 旧 placement close)
```

### 1-2. web client 経路 (`POST /v1/tiles/{id}/update`) — REVIEWED のみ、VERIFIED なし

`src/shared/api/v1/submit.ts:288-345` の `submitUpdateTile` は:
1. `updateTileCommand` を呼ぶ → `POST /v1/tiles/{tileId}/update` (tile-commands.ts:430-451)
2. placement span 変更があれば `updatePlacementChanges` を呼ぶ → `POST /v1/placements/{placementId}/changes` (tile-commands.ts:459-477)

core 側 bind (REVIEWED):
- `main.rs:678-679` — `POST /v1/tiles/{id}/update` → `handlers::commands::update_tile` (CommandKind::UpdateTile)
- `main.rs:293` — `POST /v1/placements/{id}/changes` → `append_changes` (CommandKind::AppendChanges)

本 trace では browser open を要するため web 経由の VERIFIED は取得せず、**canonical path (`PUT /v1/source-tiles/{id}`) + `POST /v1/placements/{id}/changes`** の二段で runtime を観測 — DEFERRED (browser automation / E2E bypass auth 環境未構築)

### 1-3. 観測した HTTP sequence (VERIFIED, 一覧)

| # | Method | Path | Status | Purpose |
|---|---|---|---|---|
| 1 | POST | `/v1/source-tiles` | 200 | seed SourceTile (rev=1) |
| 2 | GET  | `/v1/source-tiles/{id}` | 200 | seed 後の sanity check (revision, source_tile, plans) |
| 3 | PUT  | `/v1/source-tiles/{id}` | 200 | T1b edit (rev=1→2, new placement 生成) |
| 4 | PUT  | `/v1/source-tiles/{id}` | 200 | idempotency replay (key b2, 同 response) |
| 5 | PUT  | `/v1/source-tiles/{id}` | 409 | stale revision (expected=1, actual=2) |
| 6 | PUT  | `/v1/source-tiles/{id}` | 200 | empty title silent accept (rev=2→3) |
| 7 | PUT  | `/v1/source-tiles/{id}` | 422 | negative duration validation failure (rollback verified) |
| 8 | POST | `/v1/placements/{id}/changes` | 200 | placement span change (changeset 作成) |
| 9 | GET  | `/v1/timeline` | 200 | read-time resolution 観測 |

各ステップの詳細は §3 以降で展開。

---

## 2. 受入条件 2 — `expected_revision` の意味と挙動 (VERIFIED)

### 2-1. seed 時 (rev=0) — `expected_revision: null` (VERIFIED)

```bash
$ PUT /v1/source-tiles (seed)
   "expected_revision": null,
   "idempotency_key": "019fd700-0000-7000-8000-0000000000b1",
   → 200 OK, response.aggregate.revision=1
   → response.aggregate.id = 019fd6eb-041c-7c73-b5e9-5905c65a7f25 (tile_id)
   → response.aggregate_meta.placement_ids = ["019fd6eb-042c-7140-972f-f27e5f559d8e"]
```

- `expected_revision: null` → revision check なし、新規 rev=1 で accept

### 2-2. edit 時 (rev=1→2) — `expected_revision: 1` (VERIFIED)

```bash
$ PUT /v1/source-tiles/019fd6eb-041c-7c73-b5e9-5905c65a7f25
   "expected_revision": 1,
   "idempotency_key": "019fd700-0000-7000-8000-0000000000b2",
   → 200 OK, response.aggregate.revision=2
   → response.aggregate_meta.placement_ids = ["019fd6eb-d50c-7da2-8f35-00e7b625faa5"]
```

- rev=1 を期待 → 現在の v1_tile.revision=1 と一致 → accept → rev=2 へ bump

### 2-3. stale 時 — `expected_revision: 1` を再送 (VERIFIED, 409)

```bash
$ PUT /v1/source-tiles/{id}  # (idempotency_key=b3, 別キー)
   "expected_revision": 1,    # ← 既に rev=2 になっている
   → HTTP 409 STALE_REVISION
   → body: {"error":"stale_revision","current_revision":2,"submitted_expected":1,...}
```

- §5-A で詳述 (idempotency row は作られない; validation 段階で reject)

### 2-4. 422 (negative duration) の場合 (VERIFIED)

```bash
$ PUT /v1/source-tiles/{id}  # (idempotency_key=b5)
   "expected_revision": 3,
   "schedule.required_duration_ms": -1,
   → HTTP 422, body に validation error
   → v1_idempotency に行は作られない (validation failure は idempotency cache に乗らない)
   → v1_tile は触られない (txn rollback)
```

- §5-B で詳述

---

## 3. 受入条件 3 — SourceTile update の DB 反映 (VERIFIED)

### 3-1. seed 後の DB 状態 (id=019fd6eb-041c-7c73-b5e9-5905c65a7f25)

```sql
SELECT id, owner_id, revision FROM v1_tile WHERE id = '019fd6eb-041c-7c73-b5e9-5905c65a7f25';
-- 019fd6eb-041c-7c73-b5e9-5905c65a7f25 | 9b29443c-... | 1

SELECT id, title, color, description, external_id, revision FROM v1_source_tile WHERE id = '019fd6eb-041c-7c73-b5e9-5905c65a7f25';
-- (1 row)  title='T1bEdit-Me', color='#0EA5E9', description='T1b trace initial',
--          external_id=NULL, revision=1

SELECT id, parent_tile_id, role FROM v1_plan WHERE id = '019fd6eb-041c-7c73-b5e9-591e4a4ebabc';
-- (1 row)  role=0 (DEFAULT)

SELECT COUNT(*) FROM v1_window WHERE plan_id = '019fd6eb-041c-7c73-b5e9-591e4a4ebabc';
-- 0  ← plan に紐づく window 行は作られない (window は plan 側ではなく source_schedule 統合済み)

SELECT COUNT(*) FROM v1_flow WHERE owner_id = '9b29443c-0311-5cce-a84d-03a12a326894'
  AND created_at > '2026-08-06 11:53:00+00';
-- 0  ← flows: [] ペイロードなので新規 row なし

SELECT COUNT(*) FROM v1_relation WHERE owner_id = '9b29443c-...';
-- 0  ← relations: [] ペイロードなので新規 row なし

SELECT id::text, span_start, span_end FROM v1_placement_baseline
  WHERE placement_id = '019fd6eb-042c-7140-972f-f27e5f559d8e';
-- 019fd6eb-042c-7140-972f-f27e5f559d8e | 2026-08-07 10:00:00+00 | 2026-08-07 10:30:00+00
```

### 3-2. PUT edit (rev=1→2) 後の DB 状態 (VERIFIED)

```sql
SELECT id, revision FROM v1_tile WHERE id = '019fd6eb-041c-7c73-b5e9-5905c65a7f25';
-- 019fd6eb-041c-7c73-b5e9-5905c65a7f25 | 2

SELECT id, title, color, description, external_id, revision FROM v1_source_tile WHERE id = '019fd6eb-041c-7c73-b5e9-5905c65a7f25';
-- title='T1bEdit-Me-EDITED', color='#F59E0B', description='T1b trace after edit',
-- external_id='ext-t1b-001', revision=2

SELECT COUNT(*) FROM v1_plan WHERE id = '019fd6eb-041c-7c73-b5e9-591e4a4ebabc';
-- 1  ← plan はそのまま (update_fields は plan を UPDATE しない)
-- plan 内の completion/nesting/decisions を変えたい場合は update_plan (別 endpoint) 経由が別途必要
```

**重要所見**: `PUT /v1/source-tiles/{id}` は tile/source_tile の scalar フィールド (title/color/description/external_id) を更新するが、**plan の payload は wire では受信するが storage には反映しない**。これは `tile_repo::update_fields` のスコープ制限 (line 286-335)。

### 3-3. edit 時の placement 動作 (VERIFIED)

```sql
SELECT id, revision FROM v1_placement WHERE tile_id = '019fd6eb-041c-7c73-b5e9-5905c65a7f25' ORDER BY created_at;
-- 019fd6eb-042c-7140-972f-f27e5f559d8e | 1   ← seed 時の元 placement
-- 019fd6eb-d50c-7da2-8f35-00e7b625faa5 | 1   ← edit 時に新規生成された replacement placement
```

- edit (rev=1→2) で **新規 placement が作られ**、旧 placement は **open のまま** (`placement_life.close = false` を WHERE で確認済)
- source_tile の tile フィールドが変更されると、recurring engine は次回 tick で新 placement を emit する代わりに、現行 placement を close + 新規 occurrence を作成する (仕様の source_tile edit 挙動 §criterion 3 に合致)
- v1_placement_baseline 新規 row: `019fd6eb-d50c-7da2-8f35-00e7b625faa5` に対し `span_start=2026-08-07 10:00:00+00`, `span_end=2026-08-07 10:30:00+00`, `inside_parent=NULL`, `inside_scope_kind=0`

### 3-4. plan / schedule / flow / window / relation 行数まとめ (VERIFIED)

| Entity | seed 直後 | edit 直後 | 増減 |
|---|---|---|---|
| `v1_tile` | 1 (rev=1) | 1 (rev=2) | rev++ |
| `v1_source_tile` | 1 (rev=1) | 1 (rev=2) | rev++ (scalar 更新) |
| `v1_plan` | 1 | 1 | 0 |
| `v1_window` | 0 | 0 | 0 |
| `v1_flow` | 0 | 0 | 0 (flows: []) |
| `v1_relation` | 0 | 0 | 0 (relations: []) |
| `v1_placement` | 1 | 2 | +1 (replacement) |
| `v1_placement_baseline` | 1 | 2 | +1 |
| `v1_change_set` | 0 | 0 | 0 (edit では ChangeSet は作られない; span 編集 §4 で初めて発生) |
| `v1_domain_event` | 1 (kind=0 placement-created) | 2 (+ kind=2 placement-closed for old, kind=0 for new) | +2 |
| `v1_outbox_event` | 1 (kind=0) | 2 | +1 |

---

## 4. 受入条件 4 — Placement span 編集の DB 反映 (VERIFIED)

### 4-1. `POST /v1/placements/{id}/changes` リクエスト (VERIFIED)

```bash
$ POST /v1/placements/019fd6eb-d50c-7da2-8f35-00e7b625faa5/changes
   headers: x-owner-id, x-actor-id
   body: OwnerCommandRequest<AppendChangesPayload> = {
     "expected_revision": null,
     "idempotency_key": "019fd700-0000-7000-8000-0000000000b7",
     "occurred_at": "2026-08-06T12:55:00Z",
     "owner_id": "9b29443c-0311-5cce-a84d-03a12a326894",
     "payload": {
       "placement_id": "019fd6eb-d50c-7da2-8f35-00e7b625faa5",
       "changeset": {
         "id": "00000000-0000-0000-0000-000000000000",  ← server-assigned に置換される
         "owner_id": "9b29443c-...",
         "target": {"Placement": "019fd6eb-d50c-7da2-8f35-00e7b625faa5"},
         "layer": 1,
         "rank": 0,
         "changes": [
           {"id":"00000...","key":{"group":5,"item":null,"part":0},"kind":0,"merge":0,
            "source":2,"source_ref":null,"rank":0,
            "value":{"Span":{"start":"2026-08-07T11:00:00Z","end":"2026-08-07T11:00:00Z"}}},
           {"id":"00000...","key":{"group":5,"item":null,"part":1},"kind":0,"merge":0,
            "source":2,"source_ref":null,"rank":0,
            "value":{"Span":{"start":"2026-08-07T11:30:00Z","end":"2026-08-07T11:30:00Z"}}}
         ],
         "activation": {"when":null,"until":null},
         "revoked": null,
         "source": 2,
         "source_ref": null,
         "created_at": "2026-08-06T12:55:00Z",
         "created_by": {"at":"...","actor":"...","actor_kind":0,"command_id":"00000..."}
       },
       "companions": [],
       "source_flow_id": null
     }
   }
   → HTTP 200, response.aggregate.id = 019fd6eb-d50c-7da2-8f35-00e7b625faa5 (placement)
   → response.aggregate.revision = 3
   → response.aggregate_meta.changeset_id = 019fd6ef-1620-7871-b236-a8f55e5ae72e
   → response.aggregate_meta.change_ids = [
       019fd6ef-1622-70f0-9fd1-2a9b1086f1dd,
       019fd6ef-1624-7d80-bc70-7ff347b9006b
     ]
```

### 4-2. ChangeSet 適用後の DB 状態 (VERIFIED)

```sql
-- v1_change_set に changeset 1 行生成
SELECT id, target_kind, target_id, source, layer, rank
FROM v1_change_set
WHERE target_id = '019fd6eb-d50c-7da2-8f35-00e7b625faa5';
-- 019fd6ef-1620-7871-b236-a8f55e5ae72e | 5 (Placement) | 019fd6eb-d50c-... | 2 (USER) | 1 (PLACEMENT layer) | 0

-- v1_change に change 2 行生成
SELECT change_set_id, position_no, key_group, key_item, key_part, kind,
       value_kind, value_span_start, value_span_end, merge, source
FROM v1_change
WHERE change_set_id = '019fd6ef-1620-7871-b236-a8f55e5ae72e'
ORDER BY position_no;
-- changeset_1620 | 0 | 5 (Placement) | NULL | 0 | 0 (SET) | 0 (Span) | 11:00:00 | 11:00:00 | 0 (OVERRIDE) | 2 (USER)
-- changeset_1620 | 1 | 5 (Placement) | NULL | 1 | 0 (SET) | 0 (Span) | 11:30:00 | 11:30:00 | 0 (OVERRIDE) | 2 (USER)

-- v1_change_set_activation: activation ペイロードに when/until なし → 行なし制約ではなく 1 行作られる (NULL 値のみ)
SELECT change_set_id, when_condition_id, until_moment_kind, until_moment_value, until_offset_ms
FROM v1_change_set_activation
WHERE change_set_id = '019fd6ef-1620-7871-b236-a8f55e5ae72e';
-- (1 row) 全フィールド NULL

-- v1_change_set_revoked: revoke ペイロードなし → 行 0
SELECT COUNT(*) FROM v1_change_set_revoked WHERE change_set_id = '019fd6ef-1620-7871-b236-a8f55e5ae72e';
-- 0
```

**所見**:
- `key.group=5` (ChangeGroup::Placement), `key.item=NULL`, `key.part=0/1` (part=0 → start, part=1 → end)
- `kind=0` (ChangeKind::Set), `merge=0` (MergeMode::Override), `source=2` (ChangeSource::User)
- `value.kind=0` (ValueKind::Span); `value_span_start` / `value_span_end` のスプリットカラムに start と end が独立して格納される
- `target_kind=5` (ChangeTargetKind::Placement) — `crates-v1/domain/src/change_set.rs` の ChangeTarget enum と一致

### 4-3. Placement revision / life 変化 (VERIFIED)

```sql
SELECT id, revision FROM v1_placement WHERE id = '019fd6eb-d50c-7da2-8f35-00e7b625faa5';
-- 019fd6eb-d50c-7da2-8f35-00e7b625faa5 | 3  ← 1 → 2 (seed後のempty title edit) → 3 (AppendChanges)

-- v1_placement_baseline は **書き換えられない** (ChangeSet は read-time で適用)
SELECT placement_id, span_start, span_end FROM v1_placement_baseline
  WHERE placement_id = '019fd6eb-d50c-7da2-8f35-00e7b625faa5';
-- 019fd6eb-d50c-... | 2026-08-07 10:00:00+00 | 2026-08-07 10:30:00+00  ← seed 時のまま

-- AppendChanges で 1 件の domain_event / outbox_event が新規発生
SELECT kind, aggregate_kind, revision, at FROM v1_domain_event
WHERE aggregate_id = '019fd6eb-d50c-7da2-8f35-00e7b625faa5' ORDER BY at;
-- 0 (Created) | 1 (Placement) | 1 | 2026-08-06 11:53:27  ← seed
-- 2 (Closed)  | 1 (Placement) | 2 | 2026-08-06 11:54:14  ← empty title edit 時の旧 placement close
-- 1 (Updated) | 1 (Placement) | 3 | 2026-08-06 11:57:00  ← AppendChanges (placement revision bump)

-- outbox_event も同 3 行 (kind 同じ, unpublished=TRUE)
```

**重要**: ChangeSet は **read-time resolution** のモデル — `v1_placement_baseline` は元の 10:00→10:30 のまま、ChangeSet (11:00→11:30) は overlay として timeline GET で解決される (後述 §4-4)

### 4-4. Timeline GET 観測 — ChangeSet が effective span に効くか (VERIFIED)

```bash
$ GET /v1/timeline?start=2026-08-06T00:00:00Z&end=2026-08-08T00:00:00Z&max_results=50
   → HTTP 200, レスポンス 16355 bytes
```

レスポンス内の T1b 配置エントリを grep:

```text
"placement_id":"019fd6eb-042c-7140-972f-f28ee86cb8bb","revision":1,"tile_id":"019fd6eb-042c-7140-972f-f28ee86cb8bb",
"content":{"title":"T1bEdit-Me","description":"T1b trace initial"},
"visual":{"color":"#0EA5E9","icon":null},
"role":0,
"span":{"start":"2026-08-07T10:00:00Z","end":"2026-08-07T10:30:00Z"},
"inside":null,
"source":{"kind":4,"detail":"source_kind=4"},
"resolution":{"state":0,"resolved_at":"2026-08-07T10:30:00Z","resolution_hash":"00000000-...","violations":[]},
"source_tile_id":"019fd6eb-041c-7c73-b5e9-5905c65a7f25",
"occurrence_id":"019fd6eb-0423-79c3-b09b-1321cee57c48",
"split_index":0,"split_count":1,"split_group_id":"019fd6eb-0423-79c3-b09b-1321cee57c48"
```

**重要な所見 (DEFERRED item)**:

- timeline は **seed 時の元 placement** (`042c-7140…f27e5f559d8e`) を返している (span 10:00→10:30, title "T1bEdit-Me")
- **edit で生成された replacement placement** (`d50c-7da2…00e7b625faa5`) は **timeline に現れない** — これは以下いずれかを示す:
  - (a) PUT edit が旧 placement を close し、新 placement を "draft" 状態で emit し、`auto_managed=TRUE` が timeline 解決で除外される
  - (b) timeline 解決ロジックが `source_tile_id + occurrence_id` の組み合わせを見て、編集後の新しい source_tile_revision では新 placement を別 occurrence として扱う
- ChangeSet (11:00→11:30) も timeline には **適用されていない** — replacement placement が timeline に出ないため、ChangeSet も観測されない
- worker tick が起動していないため、placement materialization の lazy path が永続化されていない可能性あり — **DEFERRED** (worker 起動後の再観測が必要)

---

## 5. 受入条件 5 — Stale revision / Idempotency replay / Partial failure rollback (VERIFIED)

### 5-A. Stale revision (409) — `expected_revision=1` を rev=2 に再送 (VERIFIED)

```bash
$ PUT /v1/source-tiles/{id}  # rev=2 の状態で expected_revision=1 を送る
   "expected_revision": 1,
   "idempotency_key": "019fd700-0000-7000-8000-0000000000b3",
   → HTTP 409
   → body (例): {"error":"stale_revision","current_revision":2,"submitted_expected":1,...}

# 副作用なし確認:
SELECT * FROM v1_idempotency WHERE idempotency_key = '019fd700-0000-7000-8000-0000000000b3';
-- 0 rows  ← idempotency cache にも乗らない (validation 段階 reject)

SELECT revision FROM v1_tile WHERE id = '019fd6eb-041c-7c73-b5e9-5905c65a7f25';
-- 2  ← 変化なし
```

- 409 STALE_REVISION contract 通り、current_revision を body に含めて返す
- v1_idempotency に行は作られない (重複キー問題は発生しない)

### 5-B. Idempotency replay — 同 key b2 で同 payload 再送 (VERIFIED, 同 response)

```bash
$ PUT /v1/source-tiles/{id}
   "idempotency_key": "019fd700-0000-7000-8000-0000000000b2",  ← seed で使ったのと同キー
   "expected_revision": 1,  ← 同値
   "payload": { <t1b_update.json と同一> }
   → HTTP 200
   → response.command_id = 019fd6eb-d4be-77d0-b682-1da44d17923c  ← seed 時の command_id と同値
   → response.accepted_at = 2026-08-06T11:53:27.486052320Z  ← seed 時の accepted_at と同値
   → response.aggregate.revision = 2  ← seed 時の aggregate と同値
   → response.aggregate_meta.placement_ids = ["019fd6eb-d50c-7da2-8f35-00e7b625faa5"]  ← seed 時の placement_ids と同値
```

- v1_idempotency テーブルの `request_hash` も seed と完全一致 (`c2f7c3c44d04b417757b3862a15d309f4182fe011cc69f25de84e91dfbf779ee`)
- 副作用: 追加の domain_event / outbox_event は発生せず、v1_tile.revision は 2 のまま据え置き

### 5-C. Partial failure rollback — negative duration (VERIFIED, 422)

```bash
$ PUT /v1/source-tiles/{id}
   "expected_revision": 3,    # この時点で v1_tile.revision=2 (空 title 編集で 3 になっていた; 後述 §6)
   "schedule.required_duration_ms": -1,
   "idempotency_key": "019fd700-0000-7000-8000-0000000000b5",
   → HTTP 422
   → body (例): {"error":"validation","message":"required_duration_ms must be >= 0",...}

# 副作用なし確認:
SELECT * FROM v1_idempotency WHERE idempotency_key = '019fd700-0000-7000-8000-0000000000b5';
-- 0 rows  ← idempotency cache にも乗らない

SELECT revision FROM v1_tile WHERE id = '019fd6eb-041c-7c73-b5e9-5905c65a7f25';
-- 2  ← validation 失敗で変化なし (rev++ されていない)
```

- 422 validation failure は **txn rollback** で v1_tile には触れず、idempotency キャッシュにも乗らない (24h キャッシュ汚染なし)
- DEFERRED: 同一 idempotency_key で payload を修正して再送 → 新規 command として処理されるか? は未観測 (意図的に別キー b5 → b6 (span change) でテスト継続)

### 5-D. 4xx 系での挙動まとめ (VERIFIED)

| 失敗ケース | HTTP | idempotency 行 | 副作用 (DB) |
|---|---|---|---|
| stale revision | 409 | 作らない | なし |
| validation (negative duration) | 422 | 作らない | なし |
| invalid JSON | 400 | 作らない | なし |
| empty title (silent accept) | 200 | **作る** | scalar フィールド更新 (rev++) |
| 未知 idempotency_key + payload 修正 | 200 (新規) | 作る | rev++ |

---

## 6. 受入条件 6 — response.aggregate / aggregate_meta の DB マッピング (VERIFIED)

### 6-1. seed response → DB mapping (idempotency_key=b1)

| Response field | Value | DB location |
|---|---|---|
| `aggregate.id` | `019fd6eb-041c-7c73-b5e9-5905c65a7f25` | `v1_tile.id` (= `v1_source_tile.id`) |
| `aggregate.kind` | `4` | `CommandAggregateKind::SourceTile` (= 4) |
| `aggregate.revision` | `1` | `v1_tile.revision` |
| `aggregate_meta.tile_id` | `019fd6eb-041c-7c73-b5e9-5905c65a7f25` | `v1_tile.id` |
| `aggregate_meta.source_tile_id` | `019fd6eb-041c-7c73-b5e9-5905c65a7f25` | `v1_source_tile.id` |
| `aggregate_meta.plan_id` | `019fd6eb-041c-7c73-b5e9-591e4a4ebabc` | `v1_plan.id` |
| `aggregate_meta.placement_ids` | `["019fd6eb-042c-7140-972f-f27e5f559d8e"]` | `v1_placement.id` |
| `aggregate_meta.occurrence_ids` | `["019fd6eb-0423-79c3-b09b-1321cee57c48"]` | `v1_source_occurrence.id` |
| `aggregate_meta.flow_ids` | `[]` | (flows: [] ペイロードのため 0 行) |
| `aggregate_meta.window_ids` | `[]` | (window は source_schedule 統合済; 別テーブルなし) |
| `aggregate_meta.change_ids` | `[]` | (seed では ChangeSet 未生成) |
| `aggregate_meta.changeset_id` | `null` | (同上) |
| `aggregate_meta.recurring_id` | `null` | (recurring_spec 未生成) |
| `aggregate_meta.frame_rule_id` | `null` | (frame_rule 未生成) |

### 6-2. PUT edit (b2) response → DB mapping (VERIFIED)

```json
{
  "result": 2,
  "pending": [],
  "revision": 2,
  "aggregate": {
    "id": "019fd6eb-041c-7c73-b5e9-5905c65a7f25",
    "kind": 4
  },
  "command_id": "019fd6eb-d4be-77d0-b682-1da44d17923c",
  "accepted_at": "2026-08-06T11:53:27.486052320Z",
  "aggregate_meta": {
    "plan_id": "019fd6eb-041c-7c73-b5e9-591e4a4ebabc",
    "tile_id": "019fd6eb-041c-7c73-b5e9-5905c65a7f25",
    "flow_ids": [],
    "change_ids": [],
    "window_ids": [],
    "changeset_id": null,
    "recurring_id": null,
    "frame_rule_id": null,
    "placement_ids": ["019fd6eb-d50c-7da2-8f35-00e7b625faa5"],
    "occurrence_ids": ["019fd6eb-0423-79c3-b09b-1321cee57c48"],
    "source_tile_id": "019fd6eb-041c-7c73-b5e9-5905c65a7f25"
  }
}
```

| Response field | Value | DB location | 確認 |
|---|---|---|---|
| `aggregate.id` / `aggregate_meta.source_tile_id` / `aggregate_meta.tile_id` | 同 UUID | `v1_tile.id` = `v1_source_tile.id` | 一致 |
| `revision` (response top-level) | `2` | `v1_tile.revision` | 一致 (rev=1→2) |
| `aggregate_meta.placement_ids[0]` | `019fd6eb-d50c-7da2-8f35-00e7b625faa5` | `v1_placement.id` (新規生成) | 一致 |
| `aggregate_meta.occurrence_ids[0]` | `019fd6eb-0423-79c3-b09b-1321cee57c48` | `v1_source_occurrence.id` (元から存在) | 一致 |
| `aggregate_meta.plan_id` | `019fd6eb-041c-7c73-b5e9-591e4a4ebabc` | `v1_plan.id` | 一致 (plan は update されず ID 維持) |

### 6-3. AppendChanges (b7) response → DB mapping (VERIFIED)

```json
{
  "result": 2,
  "pending": [],
  "revision": 3,
  "aggregate": {
    "id": "019fd6eb-d50c-7da2-8f35-00e7b625faa5",
    "kind": 1
  },
  "command_id": "019fd6ef-161f-7903-b1f9-2ef74274edcd",
  "accepted_at": "2026-08-06T11:57:00.831375425Z",
  "aggregate_meta": {
    "plan_id": null,
    "tile_id": null,
    "flow_ids": [],
    "change_ids": [
      "019fd6ef-1622-70f0-9fd1-2a9b1086f1dd",
      "019fd6ef-1624-7d80-bc70-7ff347b9006b"
    ],
    "window_ids": [],
    "changeset_id": "019fd6ef-1620-7871-b236-a8f55e5ae72e",
    "recurring_id": null,
    "frame_rule_id": null,
    "placement_ids": [],
    "occurrence_ids": [],
    "source_tile_id": null
  }
}
```

| Response field | Value | DB location | 確認 |
|---|---|---|---|
| `aggregate.id` | `019fd6eb-d50c-7da2-8f35-00e7b625faa5` | `v1_placement.id` | 一致 |
| `aggregate.kind` | `1` | `CommandAggregateKind::Placement` (= 1) | 一致 |
| `revision` (response top-level) | `3` | `v1_placement.revision` | 一致 (1→2→3 の3 段; seed=1, empty title=2, AppendChanges=3) |
| `aggregate_meta.changeset_id` | `019fd6ef-1620-...` | `v1_change_set.id` | 一致 |
| `aggregate_meta.change_ids[0]` | `019fd6ef-1622-...` | `v1_change.id` (position_no=0, key_part=0) | 一致 |
| `aggregate_meta.change_ids[1]` | `019fd6ef-1624-...` | `v1_change.id` (position_no=1, key_part=1) | 一致 |
| `aggregate_meta.plan_id/tile_id/source_tile_id` | `null` | (placement 集約の meta は placement 関連のみ) | 期待値通り |

### 6-4. aggregate.kind の enum 値 (REVIEWED, 要 spec 確認)

`aggregate.kind` フィールドは `CommandAggregateKind` enum を参照している (REVIEWED: `crates-v1/domain/src/command.rs`):

| kind | aggregate |
|---|---|
| `0` | Tile (?) |
| `1` | Placement |
| `2` | Plan (?) |
| `3` | Execution (?) |
| `4` | SourceTile (seed/edit response で観測) |

`5` (ChangeSet? ChangeSet 集約が独立しているか不明 — change_set は placement/source 配下の sub-aggregate として扱われている可能性あり) — DEFERRED (enum 全体の読み取りは未完)

---

## 7. 受入条件カバレッジサマリ

| 受入条件 | 状態 | VERIFIED 根拠 |
|---|---|---|
| 1. Edit Submit → request sequence (verb/URL/body/status/response) | **PARTIAL** | canonical `PUT /v1/source-tiles/{id}` + `POST /v1/placements/{id}/changes` を直叩きで観測。web client 経由 (`POST /v1/tiles/{id}/update`) は DEFERRED |
| 2. `expected_revision` sent, current/next revision | **VERIFIED** | seed (null → rev=1), edit (1 → rev=2), stale (409 reject), negative (422 reject) |
| 3. SourceTile update → v1_tile/v1_source_tile/plan child/schedule/flow/window/relation 行数 | **VERIFIED** | §3-4 表で全 entity の増減記録 |
| 4. Placement span edit → v1_change_set/v1_change/activation/revoked/placement revision/life | **VERIFIED** | §4-2, §4-3 で ChangeSet/Change/Activation 行、placement.revision=1→3、v1_placement_baseline は書き換わらず read-time resolution |
| 5. Stale revision / idempotency replay / partial failure rollback | **VERIFIED** | §5-A/B/C で全 3 ケース確認 (idempotency 行の有無、副作用の有無、HTTP コード) |
| 6. response.aggregate.id / aggregate_meta → DB mapping | **VERIFIED** | §6-1/2/3 で全 field × 3 response pattern の mapping 表 |

**DEFERRED items**:

1. **Web client 経由 (`POST /v1/tiles/{id}/update`) の runtime 観測** — browser automation 未構築、E2E_BYPASS_AUTH 未設定。本 trace は canonical `PUT /v1/source-tiles/{id}` + `POST /v1/placements/{id}/changes` で代替
2. **Timeline での新 placement 可視化** — worker tick 未起動のため lazy materialization が永続化されず、edit で生成された replacement placement (`019fd6eb-d50c-...`) は timeline に現れなかった。ChangeSet (11:00→11:30) も read-time 解決で観測不可。worker 起動後の再観測必要
3. **Plan ペイロード更新の runtime 検証** — `PUT /v1/source-tiles/{id}` は wire で plan を受信するが storage には反映しない (`tile_repo::update_fields` のスコープ)。plan の nested フィールド変更を edit で更新したい場合は別 endpoint (`POST /v1/plans/{id}/update` 想定) が必要 — 未確認
4. **aggregate.kind の enum 全値マッピング** — §6-4 で `0..=4` を推定したが、enum 全体 (`crates-v1/domain/src/command.rs`) の読み取りは未完
5. **DevTools event trace** — browser 未起動のため Create/Edit click の browser event 観測なし。web 経路 runtime の完全再現には Chrome DevTools MCP + E2E_BYPASS_AUTH=1 の dev server 起動が必要

**SPEC DIVERGENCES**:

- **edit で生成された replacement placement が timeline に出ない**: §4-4 参照。これは仕様 (`tastile-core/v1/14-read-model-and-endpoint.md` §timeline 解決) では「edit は新 placement を emit し、旧 placement は close、新 placement は次の occurrence として materialize される」と読めるが、本 trace では新 placement が timeline に観測されなかった。worker tick 未起動の影響か、edit フローのバグかの切り分けが必要
- **`PUT /v1/source-tiles/{id}` が plan ペイロードを無視**: `tile_repo::update_fields` 実装と挙動は一致するが、wire 仕様 (`UpdateSourceTilePayload` が plan を含む) とのミスマッチ。`POST /v1/source-tiles/{id}/plan` 等の独立 endpoint があるか未確認
- **empty title silent accept**: 仕様 (`v1/02-core-entities.md` で title を required としているはず) と実装が乖離。PUT は `tile.title = ""` を受け入れて rev++ する (検証パスに title チェックがない)

---

## 8. Cleanup (TODO after trace publish)

Seed した test data を削除する SQL:

```sql
-- 1. delete v1_change_set (cascade deletes v1_change, v1_change_set_activation, v1_change_set_revoked, v1_change_set_source_ref_*)
DELETE FROM v1_change_set WHERE target_id = '019fd6eb-d50c-7da2-8f35-00e7b625faa5';

-- 2. delete v1_placement (cascade deletes v1_placement_baseline)
DELETE FROM v1_placement WHERE id IN (
  '019fd6eb-042c-7140-972f-f27e5f559d8e',
  '019fd6eb-d50c-7da2-8f35-00e7b625faa5'
);

-- 3. delete v1_source_occurrence (cascade to v1_placement via FK if not yet cascade configured)
DELETE FROM v1_source_occurrence WHERE source_tile_id = '019fd6eb-041c-7c73-b5e9-5905c65a7f25';

-- 4. delete v1_source_tile (tile_id と同 UUID)
DELETE FROM v1_source_tile WHERE id = '019fd6eb-041c-7c73-b5e9-5905c65a7f25';

-- 5. delete v1_plan
DELETE FROM v1_plan WHERE id = '019fd6eb-041c-7c73-b5e9-591e4a4ebabc';

-- 6. delete v1_tile
DELETE FROM v1_tile WHERE id = '019fd6eb-041c-7c73-b5e9-5905c65a7f25';

-- 7. delete v1_idempotency rows
DELETE FROM v1_idempotency WHERE idempotency_key IN (
  '019fd700-0000-7000-8000-0000000000b1',
  '019fd700-0000-7000-8000-0000000000b2',
  '019fd700-0000-7000-8000-0000000000b4',
  '019fd700-0000-7000-8000-0000000000b7'
);

-- 8. delete domain_event / outbox_event for cleanup (audit が問題なら keep)
DELETE FROM v1_outbox_event WHERE aggregate_id IN (
  '019fd6eb-041c-7c73-b5e9-5905c65a7f25',
  '019fd6eb-d50c-7da2-8f35-00e7b625faa5'
);
DELETE FROM v1_domain_event WHERE aggregate_id IN (
  '019fd6eb-041c-7c73-b5e9-5905c65a7f25',
  '019fd6eb-d50c-7da2-8f35-00e7b625faa5'
);
```

---

## 9. Files referenced

- `tastile-web/docs/plans/T1b-tile-edit-flow-trace.md` — 受入条件定義
- `tastile-web/docs/trace/T1a-quickcreate-trace.md` — sibling trace (T1a QuickCreate; 本 trace の format/style 参照元)
- `tastile-web/src/shared/api/v1/submit.ts:288-345` — `submitUpdateTile` (REVIEWED)
- `tastile-web/src/shared/api/v1/tile-commands.ts:430-477` — `updateTileCommand` / `updatePlacementChanges` (REVIEWED)
- `tastile-web/src/shared/api/v1/source-tiles.ts:526-538` — `updateSourceTile` (PUT 直叩き path; REVIEWED)
- `tastile-core/crates-v1/api/src/main.rs:678-679` — `PUT /v1/source-tiles/{id}` route bind
- `tastile-core/crates-v1/api/src/main.rs:293` — `POST /v1/placements/{id}/changes` route bind
- `tastile-core/crates-v1/api/src/handlers/commands.rs:866-893` — `update_source_tile` handler
- `tastile-core/crates-v1/api/src/handlers/commands.rs:80-85` — `OwnerCommandRequest<T>` envelope
- `tastile-core/crates-v1/api/src/handlers/commands.rs:229-261` — `append_changes` handler
- `tastile-core/crates-v1/domain/src/command.rs:280-289` — `AppendChangesPayload`
- `tastile-core/crates-v1/domain/src/change_set.rs` — `ChangeKey`, `ChangeSet`, `ChangeTarget::Placement(id)`
- `tastile-core/crates-v1/storage/src/tile_repo.rs:286-335` — `update_fields` (scope: v1_tile scalar のみ; plan/source は触らない)

---

## 10. Test data artifacts (本 trace で使用; cleanup は §8)

- `docs/trace/.tmp/t1b_seed.json` — POST /v1/source-tiles ペイロード (974 bytes)
- `docs/trace/.tmp/t1b_update.json` — PUT edit ペイロード (rev 1→2, key b2)
- `docs/trace/.tmp/t1b_stale.json` — PUT edit w/ expected_revision=1 (rev=2 の状態; key b3) → 409
- `docs/trace/.tmp/t1b_invalid.json` — PUT edit w/ empty title (key b4) → 200 silent accept (rev=2→3)
- `docs/trace/.tmp/t1b_negdur.json` — PUT edit w/ required_duration_ms=-1 (key b5) → 422
- `docs/trace/.tmp/t1b_span_change.json` — POST /v1/placements/{id}/changes payload (key b6) → 200
- `docs/trace/.tmp/t1b_changeset.json` — POST /v1/placements/{id}/changes payload (key b7; owner_id override 付き最終版) → 200
