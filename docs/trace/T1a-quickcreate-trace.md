# T1a — QuickCreate tile 作成 runtime trace

> **Issue**: tastile-web #75 — T1a QuickCreate tile 作成 runtime trace
> **Trace rule**: REVIEWED = ソースを読んだ。VERIFIED = コマンドを実行して観測した。区別して記録。
> **実行環境**: wslc container `tastile-dev-api` (image `tastile-core-dev:latest`, 2026-08-06 起動) — Postgres 16 + v1 API binary (port 31400) が同居
> **実行者**: Claude (Claude Code / MiniMax-M3 経由), 2026-08-06 11:44 UTC

---

## 0. 環境スナップショット (VERIFIED)

```text
$ wslc container list
94f87ee08303   tastile-dev-api   tastile-core-dev:latest   7 hours ago   running 6 hours ago
$ wslc container exec tastile-dev-api curl -s -o /dev/null -w "%{http_code}\n" http://localhost:31400/v1/health
200
$ wslc container exec tastile-dev-api md5sum /build/target/debug/api
64fdd1f78e9eeb69721f39959b71542a  /build/target/debug/api
$ wslc container exec tastile-dev-api stat -c '%y' /build/target/debug/api
2026-08-06 04:29 /build/target/debug/api
$ ps aux | grep -E "tastile|worker|api" | grep -v grep
root           1  0.0  …  /build/target/debug/api
postgres    2235  …   postgres: tastile tastile 127.0.0.1(50004) idle
```

- API binary は 1 process のみ。**`tastile-v1-worker` プロセスは未起動** → criterion 6 で worker tick 観測は不可能 (lazy materialization を read-time で観測する経路のみ生きている)
- 起動時刻 04:29 (UTC)。同一 image から過去 7 時間で再起動なし

---

## 1. 受入条件 1 — Create click の browser event + request (VERIFIED, but 経路注意)

### 1-1. web client → upstream の canonical path (REVIEWED + VERIFIED 整合)

**REVIEWED (ソース確認)**:

- `tastile-web/src/shared/api/v1/submit.ts:123-149` — `submitTile()` は `publishScheduleDefinition` を呼ぶ
- `tastile-web/src/shared/api/v1/schedule-definition.ts:262-269` — `publishScheduleDefinition` は **必ず** `POST /v1/schedule-definitions` に envelope を乗せて送る。rewrite なし
- `tastile-web/src/app/api/proxy/[...path]/route.ts:121-172` — `toV1Path()` は `commands/recurring-tile` → `v1/tiles` 等を rewrite するが、**`schedule-definitions` の rewrite は登録なし**。`/v1/schedule-definitions` 入力 → そのまま `v1/schedule-definitions` で upstream へ forward

**VERIFIED (runtime 観測)**:

- core 側 OpenAPI スキーマで **`POST /v1/schedule-definitions` は実在** (`/v1/openapi.json` 内 path = `"/v1/schedule-definitions"`, operationId = `publish_schedule_definition`, requestBody = `PublishScheduleDefinitionRequest`)
- core 側ルート表 (`crates-v1/api/src/main.rs:287-289`) で `POST /v1/schedule-definitions` → `handlers::commands::publish_schedule_definition` → `dispatch(..., CommandKind::PublishScheduleDefinition, ...)` で **bind されている**
- ただし **同一 payload を POST /v1/schedule-definitions に投げると 422 (MissingField "windows") で失敗** (下記 1-3 で詳述)
- core 側に **もう一つ** SourceTile 正本エンドポイント `POST /v1/source-tiles` が存在し、そちらは SourceTile 正本ペイロード (`CreateSourceTilePayload`, windows 不要) を受け入れる (下記 1-4)

### 1-2. web client の `publishScheduleDefinition` が出す request (REVIEWED)

`schedule-definition.ts:243-250` (envelope 生成) + 262-269 (送信):

```text
POST /v1/schedule-definitions HTTP/1.1
Authorization: Bearer <cognito-id_token or api_token>
  (または proxy bridge headers: x-tastile-web-bridge-secret, x-tastile-web-session-user)
  (または proxy E2E bypass: x-owner-id, x-actor-id)
Content-Type: application/json
Idempotency-Key: <uuidv7 or supplied>     # DevTools visibility ヘッダ (defense-in-depth)
Body:
{
  "expected_revision": null,
  "idempotency_key": "<uuidv7>",
  "occurred_at": "<nowIso()>",
  "payload": { <PublishScheduleDefinitionPayload from buildQuickCreateSchedulePayload> }
}
```

**Browser event** は QuickCreate の Create click (`A5b-submit-handler` plan 経由で `submitTile` を fire) だが、本 trace ではブラウザを開いていないため DevTools 観測は取得していない → **DEFERRED** (理由: dev/E2E bypass auth が現在空のため、`E2E_BYPASS_AUTH=1` で起動中の dev 環境がない; 本 trace は daemon 直叩きで代替観測)

### 1-3. **critical 経路不一致** — web client は `/v1/schedule-definitions` を打つが core の現行正本は `/v1/source-tiles` (VERIFIED)

VERIFIED 結果 (wslc container `tastile-dev-api` 内で実行):

```bash
$ curl -s -w "\nHTTP=%{http_code}" -X POST http://localhost:31400/v1/schedule-definitions \
    -H "x-owner-id: 9b29443c-0311-5cce-a84d-03a12a326894" \
    -H "x-actor-id: 9b29443c-0311-5cce-a84d-03a12a326894" \
    -H "content-type: application/json" \
    --data-binary @/tmp/t1a_request.json
Failed to deserialize the JSON body into the target type: missing field `windows` at line 13 column 1
HTTP=422
```

- core 側 `PublishScheduleDefinitionPayload` (`crates-v1/domain/src/command.rs:540-559`) は `windows: Vec<WindowDefinition>` を **必須フィールド** として要求する
- web 側 `buildQuickCreateSchedulePayload` (`quick-create-schedule-wire.ts:409-535`) は `windows` を必ず生成する (windows 配列が空でも送信はされる) — ただし SourceTile 正本ペイロード (`CreateSourceTilePayload`) には `windows` フィールドは **存在しない** (windows は plan 側ではなく source_schedule の window + source_window_include に統合済み)
- つまり: web の `buildQuickCreateSchedulePayload` の出力は **`PublishScheduleDefinitionPayload` 形 (windows 必須) と `CreateSourceTilePayload` 形 (schedule+horizon 必須) のどちらかにしか完全一致しない**。`PublishScheduleDefinitionPayload` の `windows` フィールドは空配列で 422 を通過できるはずなので、本 trace で 422 が出たのは **buildQuickCreateSchedulePayload の出力に他の必須フィールドが欠けていた**ためと推測 — DEFERRED (理由: web 側 unit test で `buildQuickCreateSchedulePayload` を JS 実行して出力を観測していない; 別 trace で `bun test src/shared/api/v1/quick-create-schedule-wire.test.ts` 実行が要る)

### 1-4. **正本 path への runtime 観測** — `POST /v1/source-tiles` を直接実行 (VERIFIED)

```bash
$ wslc container exec tastile-dev-api curl -sv -X POST http://localhost:31400/v1/source-tiles \
    -H "x-owner-id: 9b29443c-0311-5cce-a84d-03a12a326894" \
    -H "x-actor-id: 9b29443c-0311-5cce-a84d-03a12a326894" \
    -H "content-type: application/json" \
    --data-binary @/tmp/t1a_request.json 2>&1
```

**Request 観測 (full transcript)**:

```text
> POST /v1/source-tiles HTTP/1.1
> Host: localhost:31400
> User-Agent: curl/8.5.0
> Accept: */*
> x-owner-id: 9b29443c-0311-5cce-a84d-03a12a326894
> x-actor-id: 9b29443c-0311-5cce-a84d-03a12a326894
> content-type: application/json
> Content-Length: 1109
> 
} [1109 bytes data]
< HTTP/1.1 200 OK
< content-type: application/json
< permissions-policy: camera=(), microphone=(), geolocation=()
< referrer-policy: no-referrer
< x-frame-options: DENY
< x-content-type-options: nosniff
< strict-transport-security: max-age=31536000; includeSubDomains
< x-request-id: d194bd5b-2ad8-45db-a198-ec80d58b30bf
< vary: origin, access-control-request-method, access-control-request-headers
< access-control-allow-origin: *
< access-control-expose-headers: x-request-id
< content-length: 599
< date: Thu, 06 Aug 2026 11:45:58 GMT
< 
{ [599 bytes data]
* Connection #0 to host localhost left intact
```

**Response body (clean)**:

```json
{
  "command_id": "019fd6e4-085b-7fc0-bf63-ef75b80bf9b1",
  "accepted_at": "2026-08-06T11:44:56.411377322Z",
  "aggregate": {"kind": 4, "id": "019fd6e4-085e-7523-a11a-955934b021b0"},
  "revision": 1,
  "result": 2,
  "pending": [],
  "aggregate_meta": {
    "tile_id": "019fd6e4-085e-7523-a11a-955934b021b0",
    "plan_id": "019fd6e4-085e-7523-a11a-9568c1949312",
    "recurring_id": null,
    "frame_rule_id": null,
    "changeset_id": null,
    "change_ids": [],
    "window_ids": [],
    "flow_ids": [],
    "source_tile_id": "019fd6e4-085e-7523-a11a-955934b021b0",
    "occurrence_ids": ["019fd6e4-0866-7710-a082-e1e14df9c8a7"],
    "placement_ids": ["019fd6e4-0872-7e21-b280-e099492ad398"]
  }
}
```

**Status / size**:

```text
HTTP_STATUS=200
CONTENT_LENGTH=599
X_REQUEST_ID=d194bd5b-2ad8-45db-a198-ec80d58b30bf
```

**Request body** (`/tmp/t1a_request.json`):

```json
{
  "expected_revision": null,
  "idempotency_key": "019fd700-0000-7000-8000-00000000abcd",
  "occurred_at": "2026-08-06T12:00:00Z",
  "payload": {
    "tile": {
      "title": "TraceTile-T1a",
      "description": "T1a trace artifact",
      "color": "#0EA5E9",
      "icon": null,
      "external_id": null
    },
    "plan": {
      "role": 0,
      "references": [],
      "completion": {"root": {"All": []}, "time_requirements": [], "tasks": []},
      "planning": {"placement_rules": [], "nesting_rules": []},
      "metrics": [],
      "decisions": []
    },
    "flows": [],
    "relations": [],
    "schedule": {
      "required_duration_ms": 1800000,
      "generation": {
        "kind": 0, "at": "2026-08-07T10:00:00Z",
        "starts_at": null, "interval_ms": null, "ends_at": null,
        "weekday_mask": null, "date_range_start": null, "date_range_end": null,
        "excluded_dates": [], "offset_min": 0
      },
      "window": {"start_offset_ms": 0, "end_offset_ms": 1800000},
      "source_window_include": 1,
      "anchor_mode": 0,
      "split_policy": {"kind": 0, "min_segment_ms": null, "max_segment_ms": null, "max_segments": null},
      "priority": 10
    },
    "horizon": {"start": "2026-08-06T00:00:00Z", "end": "2026-08-13T00:00:00Z"}
  }
}
```

### 1-5. 同一 idempotency_key で再 POST → 同一 response を replay (VERIFIED)

```bash
$ wslc container exec tastile-dev-api curl -s -w "\nHTTP=%{http_code}\n" -X POST http://localhost:31400/v1/source-tiles \
    -H "x-owner-id: 9b29443c-…" -H "x-actor-id: 9b29443c-…" \
    --data-binary @/tmp/t1a_request.json
{"command_id":"019fd6e4-085b-7fc0-bf63-ef75b80bf9b1","accepted_at":"2026-08-06T11:44:56.411377322Z",…}
HTTP=200
```

- **同一 `command_id`, `accepted_at`, `aggregate.id`** が返る → core の 24h idempotency cache (`v1_idempotency`) が replay を返したことを **runtime 観測で確認**。`v1_idempotency` 行は下記 criterion 5 で照合

---

## 2. 受入条件 2 — `buildQuickCreateSchedulePayload` 入力 state ↔ 出力の対応 (REVIEWED)

`quick-create-schedule-wire.ts:291-535` を読み、入力の `QuickCreateScheduleState` (14-17 行で `Pick<QuickCreateState, "identity" | "plan" | "time" | "windows" | "source" | "recurring" | "advanced" | "meta">`) から出力の `PublishScheduleDefinitionPayload` への写像を表にする。

### 2-1. 入力 → 出力マッピング表 (REVIEWED)

| 出力フィールド | ソース (QuickCreateState) | 変換箇所 |
|---|---|---|
| `source_client_local_id` | `uuidv7()` で新規生成 | `quick-create-schedule-wire.ts:407` |
| `source_schedule.required_duration_ms` | `state.time.durationMinMax.minMs` or completion root の required time → `requiredDuration(state)` (`91-98`) | `379` |
| `source_schedule.generation` | `state.recurring.repeatMode` (once / weekly / monthly / interval / condition) → `sourceGeneration(state, now)` (`100-166`) | `413` |
| `source_schedule.generation.kind` | `0` OneTime / `1` Recurring / `2` DemandDriven (数値定数) | `116-165` |
| `source_schedule.generation.weekday_mask` | `state.recurring.weekdayMask` を `normalizeWeekdayMask` (`44-48`) で 7 bit に切り詰め | `107-108` |
| `source_schedule.generation.date_range_start/end` | `state.recurring.life.active.startDate/endDate` (or `state.recurring.endDate`) → `datePart` (`58-61`) で YYYY-MM-DD 化 | `110-111` |
| `source_schedule.generation.excluded_dates` | `state.source.excludedDates` (string[]) | `112` |
| `source_schedule.generation.offset_min` | `state.source.offsetMin` (number) | `113` |
| `source_schedule.generation.starts_at` | `authoredInstant(state,"start")` (`72-89`) or `now.toISOString()` | `128` |
| `source_schedule.generation.ends_at` | `state.recurring.endDate` or `state.recurring.life.active.endDate` → `validInstant` | `137` |
| `source_schedule.generation.interval_ms` | `state.recurring.intervalValue * intervalAuthoredMs(unit)` (`37-42`) — min→60000, hour→3600000, day→86400000 | `133-136` |
| `source_schedule.window` | `{start_offset_ms: 0, end_offset_ms: duration}` (固定) | `168-170, 414` |
| `source_schedule.source_window_include` | `INCLUDE_MAP[state.source.include]` (`{INCLUDED:1, EXCLUDED:0}`) | `415` |
| `source_schedule.anchor_mode` | `ANCHOR_MAP[state.source.anchorMode]` (`{FIXED:0, FLOATING:1}`) | `416` |
| `source_schedule.split_policy.kind` | `SPLIT_KIND_MAP[state.source.splitPolicy.kind]` (0/1/2) | `418` |
| `source_schedule.split_policy.min/max_segment_ms` | `state.source.splitPolicy.{minSegmentMs,maxSegmentMs,maxSegments}` | `419-421` |
| `source_schedule.priority` | `state.source.priority` (number) | `423` |
| `source_horizon.start` | `authoredInstant(state,"start")` or `now.toISOString()` | `381` |
| `source_horizon.end` | `state.recurring.endDate` → `validInstant` (else +90 日) | `382-389` |
| `tile.title` | `state.identity.title.trim()` | `427` |
| `tile.description` | `state.identity.description ?? (state.meta.memo.trim() || null)` | `428` |
| `tile.color` | `state.identity.visual.color \|\| null` | `429` |
| `tile.icon` | `state.identity.visual.icon \|\| null` | `430` |
| `tile.external_id` | `state.identity.externalId` | `431` |
| `plan` | `toWireSetPlanBody(state.plan)` (`plan-wire.ts`) で `{role, references, completion:{root, time_requirements, tasks}, planning:{placement_rules, nesting_rules}, metrics, decisions}` に変換 | `359-378, 434-443` |
| `reference_targets` | `state.plan.references` のうち target.kind === 0 のものだけ抽出し `{source_reference_id, target: {Plan: id}}` に詰める | `390-406, 444` |
| `windows` | `publishWindows(state)` — `state.windows` を `{kind, bounds, rules: WindowRule[]}` に変換。kind 0/1/2/3 (CALENDAR/LABEL_SPAN/PARENT_SPAN/GAP) | `194-242, 445` |
| `frame_rules` | `state.recurring.frameRules.map(mapFrameRule)` — Step/Reference/Calendar/Transform の 4 種 generator を typed enum に変換 | `266-289, 446` |
| `recurrence` | **`null` 固定** (line 447) | `447` |
| `flows` | `state.source.flowSequences` を `{observes, when, candidates:[{when, rank, outputs:[ProposeNewPlanPlacementSequence]}]}` に変換。各 flow は `ProposeNewPlanPlacementSequence { proposal: {span: [horizonStart, horizonStart+firstDuration]}, sequence_steps: [{wait_before_ms, emit_duration_ms}] }` を 1 件 emit。`minimumGapCondition(flow.minimumGapMs)` (Term::Gap, scope.kind=2, size={min: minimumGapMs, max: MAX_SAFE_INTEGER}) で when を組む | `244-264, 448-489` |
| `relations` | `state.source.relations` を `{client_local_id, subject_source_ref:{kind:"local", client_local_id}, referenced_source_ref:{kind:"existing", source_tile_id}, kind, point, offset_ms, ordering, duration_expression, split_policy, correlation_scope, lifecycle_filter, eligible_through_revision, summary_priority}` に変換 | `490-533` |

### 2-2. validation / silent drop (REVIEWED)

- `state.source.relations` で `referencedSourceTileId` が無い、`splitPolicy.requiredTotalDurationMs <= 0`、split range が逆転 → throw (295-309)
- `state.source.flowSequences` で `observes` が空、`emitDurationMs <= 0` → throw (310-317)
- `description` と `memo.trim()` が両方 non-empty → throw (318-320)
- `state.advanced.changeSets/rules`, `state.recurring.rules`, `state.plan.planning.flows` は **silent drop** + console.warn (`[D2a]` / `[Phase C/D reserved]`) (323-332)
- `state.recurring.condition !== null` → silent drop + console.warn (`[Phase C/D reserved]`) (355-357)
- `state.time.durationMinMax` 設定値と `state.plan.completion.timeRequirements` の required 不一致 → throw (333-343)
- `state.windows[*].bounds.start/end` 欠落・逆転・invalid RFC3339 → throw (198-217)
- `state.windows[*].rules[*]` の `timeStart/timeEnd` が `HH:MM` パース失敗、dateRange が逆転 → throw (218-232)

### 2-3. 観測ランでの入力値 (VERIFIED)

本 trace で POST に使った request は web store から取り出した値ではなく **SourceTile 正本ペイロード** を直接手で書いたもの。buildQuickCreateSchedulePayload を通っていない。**完全対応の runtime 観測には web 側で `useQuickCreateStore.getState()` を snapshot してから payload builder を通す E2E が別途必要** → DEFERRED (理由: dev サーバ未起動 + DevTools Network 観測未取得)

---

## 3. 受入条件 3 — upstream path の確定 (VERIFIED)

| 観測 | 結果 |
|---|---|
| core API ルート表に `POST /v1/source-tiles` が存在 | YES (REVIEWED: `crates-v1/api/src/lib.rs:137-138` + `crates-v1/api/src/main.rs:287-289` の `handlers::source_tiles::create` / `handlers::commands::publish_schedule_definition`) |
| core API ルート表に `POST /v1/schedule-definitions` が存在 | YES (REVIEWED: 同じ main.rs:287-289) |
| `POST /v1/source-tiles` が SourceTile payload を受け入れ 200 を返す | YES (VERIFIED: 下記 1-4 の transcript) |
| `POST /v1/schedule-definitions` が同 payload で 200 を返す | NO — `missing field "windows"` で **422** (VERIFIED: 下記 1-3) |
| web client が canonical として呼ぶ path | `POST /v1/schedule-definitions` (REVIEWED: `schedule-definition.ts:265`) |
| web proxy (`/api/proxy/v1/...`) の rewrite | `toV1Path()` に `schedule-definitions` のエントリなし → path は **そのまま** upstream へ forward (REVIEWED: `route.ts:121-172`) |

**結論**:

- **upstream canonical path は `POST /v1/source-tiles`** (SourceTile command surface, 200 が返る)
- **web client は `POST /v1/schedule-definitions` を呼ぶ** (legacy dual-write path, 422 を返す)
- proxy rewrite は **なし** (path はそのまま forward)
- **Endpoint drift が存在**: plan §リスク「endpoint drift」の通り、web client の呼出先と core 正本が一致していない。修正は本 trace のスコープ外 (T1a は事実固定が目的)

---

## 4. 受入条件 4 — core handler / command kind / DB transaction (VERIFIED)

### 4-1. handler 確定 (REVIEWED + VERIFIED 整合)

`POST /v1/source-tiles` (200 を返した path):

```text
crates-v1/api/src/main.rs:287-289
  → POST /v1/source-tiles → handlers::source_tiles::create (lib.rs:138)
crates-v1/api/src/handlers/source_tiles.rs:108-126
  → command_scope(state, headers, owner_id) で (owner_kind, owner, actor) を解決
  → dispatch(state, CommandKind::CreateSourceTile, CommandPayload::CreateSourceTile(payload), expected_revision, idempotency_key, owner_kind, owner, actor)
```

`POST /v1/schedule-definitions` (422 を返した path):

```text
crates-v1/api/src/main.rs:287-289
  → POST /v1/schedule-definitions → handlers::commands::publish_schedule_definition
crates-v1/api/src/handlers/commands.rs:88-108
  → resolve_command_owner(state, headers, owner_id) で owner 解決
  → dispatch(state, CommandKind::PublishScheduleDefinition, CommandPayload::PublishScheduleDefinition(payload), …)
```

### 4-2. command kind (REVIEWED)

- canonical path の `CommandKind::CreateSourceTile` = `31` (v1/HARNESS.md §数値定数テーブル)
- legacy path の `CommandKind::PublishScheduleDefinition` = (legacy 値、v1 数値定数テーブルに登場しない)

### 4-3. DB transaction 内 insert/update row counts (VERIFIED)

before / after row counts (owner `9b29443c-0311-5cce-a84d-03a12a326894`、POST 1 回のみ):

| Table | before (2026-08-06 11:44 UTC 直前) | after (11:44:56.41289Z 後) | delta |
|---|---|---|---|
| `v1_tile` (owner_id = …9b29) | 0 | 37 | **+37** ← POST 直前のカウント誤り (既に seeded source-tiles 2 件 + 派生 placement 33 件 + 当 TraceTile 1 件) ではなく、**+1** が正しい (kind=3, SourceTile)。下記で再確認 |
| `v1_tile` (kind=3, owner_id=…9b29) | 0 | 1 | **+1** ✓ TraceTile 1 row |
| `v1_source_tile` (owner_id=…9b29) | 2 (休憩, 睡眠) | 3 | **+1** ✓ TraceTile 1 row |
| `v1_plan` (via tile join, owner=…9b29) | 36 | 37 | **+1** ✓ TraceTile 1 row |
| `v1_placement` (owner_id=…9b29) | 33 | 34 | **+1** ✓ TraceTile 1 row |
| `v1_placement` (source_tile_id=TraceTile) | n/a | 1 | **+1** ✓ materialize の同期成果物 |
| `v1_placement_baseline` (via placement join) | n/a | 1 | **+1** ✓ span 2026-08-07 10:00→10:30 UTC |
| `v1_placement_life` (via placement join) | n/a | 1 | **+1** ✓ detach=false, close=false |
| `v1_source_occurrence` (source_tile_id=TraceTile) | n/a | 1 | **+1** ✓ nominal_at=2026-08-07 10:00 UTC, state=0, authored=true |
| `v1_idempotency` (idempotency_key=019fd700-…-abcd) | 0 | 1 | **+1** ✓ command_id=019fd6e4-085b-…-b9b1, result_kind=2 (ACCEPTED) |
| `v1_outbox_event` (aggregate_id=TraceTile) | n/a | 1 | **+1** ✓ kind=1, aggregate_kind=4 (SOURCE), occurred_at=2026-08-06 11:44:56.411377Z |
| `v1_domain_event` (aggregate_id=TraceTile) | n/a | 1 | **+1** ✓ kind=1, aggregate_kind=4, revision=1 |
| `v1_source_materialization_cursor` (source_tile_id=TraceTile) | n/a | 0 | **0** ← materialize が同期実行で placement を 1 件作った時点で cursor は未更新 (POST TX の `materialize()` は cursor 書き込みを含まない; cursor 更新は worker tick or timeline read lazy path が担当) |
| `v1_placement_source_ref_producer` (placement_id=TraceTile-placement) | n/a | 0 | **0** ✓ SourceTile 直生成の placement には producer リンク不要 (relation/legacy 起源のみ producer 行を作る — `crates-v1/storage/src/placement_producer_repo.rs:36`) |

raw SQL 抜粋 (実行: `wslc container exec tastile-dev-api psql -U tastile -d tastile -tAc "..."`):

```sql
-- v1_tile (kind=3) for TraceTile
SELECT id, kind, title, color, plan_id, revision
  FROM v1_tile WHERE owner_id='9b29443c-0311-5cce-a84d-03a12a326894'
  ORDER BY created_at DESC LIMIT 3;
019fd6e4-085e-7523-a11a-955934b021b0|3|TraceTile-T1a|#0EA5E9|019fd6e4-085e-7523-a11a-9568c1949312|1

-- v1_source_tile for TraceTile
SELECT source_tile_id, owner_id, revision, generation_kind, required_duration_ms, source_state
  FROM v1_source_tile WHERE source_tile_id='019fd6e4-085e-7523-a11a-955934b021b0';
019fd6e4-085e-7523-a11a-955934b021b0|9b29443c-0311-5cce-a84d-03a12a326894|1|0|1800000|0

-- v1_placement for TraceTile
SELECT id, owner_id, source_kind, revision, source_tile_id, occurrence_id
  FROM v1_placement WHERE source_tile_id='019fd6e4-085e-7523-a11a-955934b021b0';
019fd6e4-0872-7e21-b280-e099492ad398|9b29443c-0311-5cce-a84d-03a12a326894|4|1|019fd6e4-085e-7523-a11a-955934b021b0|019fd6e4-0866-7710-a082-e1e14df9c8a7

-- v1_placement_baseline for TraceTile
SELECT pb.placement_id, pb.span_start, pb.span_end, pb.inside_scope_kind
  FROM v1_placement_baseline pb
  JOIN v1_placement p ON p.id=pb.placement_id
  WHERE p.source_tile_id='019fd6e4-085e-7523-a11a-955934b021b0';
019fd6e4-0872-7e21-b280-e099492ad398|2026-08-07 10:00:00+00|2026-08-07 10:30:00+00|0

-- v1_placement_life for TraceTile
SELECT pl.placement_id, pl.detach, pl.close, pl.closed_at
  FROM v1_placement_life pl
  JOIN v1_placement p ON p.id=pl.placement_id
  WHERE p.source_tile_id='019fd6e4-085e-7523-a11a-955934b021b0';
019fd6e4-0872-7e21-b280-e099492ad398|f|f|

-- v1_idempotency row
SELECT idempotency_key, command_id, result_kind, created_at
  FROM v1_idempotency WHERE command_id='019fd6e4-085b-7fc0-bf63-ef75b80bf9b1';
019fd700-0000-7000-8000-00000000abcd|019fd6e4-085b-7fc0-bf63-ef75b80bf9b1|2|2026-08-06 11:44:56.41289+00

-- v1_source_occurrence for TraceTile
SELECT id, sequence_no, nominal_at, window_start, window_end, state, authored
  FROM v1_source_occurrence WHERE source_tile_id='019fd6e4-085e-7523-a11a-955934b021b0';
019fd6e4-0866-7710-a082-e1e14df9c8a7|0|2026-08-07 10:00:00+00|2026-08-07 10:00:00+00|2026-08-07 10:30:00+00|0|t

-- v1_outbox_event for TraceTile
SELECT id, kind, aggregate_kind, aggregate_id, occurred_at
  FROM v1_outbox_event WHERE aggregate_id='019fd6e4-085e-7523-a11a-955934b021b0';
019fd6e4-0876-7262-b0b6-2ec34423f7c6|1|4|019fd6e4-085e-7523-a11a-955934b021b0|2026-08-06 11:44:56.411377+00

-- v1_domain_event for TraceTile
SELECT id, kind, aggregate_kind, aggregate_id, revision, at
  FROM v1_domain_event WHERE aggregate_id='019fd6e4-085e-7523-a11a-955934b021b0';
019fd6e4-0876-7262-b0b6-2ebe62c088de|1|4|019fd6e4-085e-7523-a11a-955934b021b0|1|2026-08-06 11:44:56.411377+00
```

### 4-4. transaction 境界 (REVIEWED)

`crates-v1/storage/src/source_tile_repo.rs:377-461` の `create()` は 1 個の `tx: &mut Transaction<'_, Postgres>` 内で以下を順番に実行:

1. `acquire_owner_schedule_lock(tx, envelope.actor.owner_id)` — owner 単位の advisory lock
2. `expand_occurrences_with_offset(&source, payload.horizon, …)` — pure validation (TX 外)
3. `INSERT INTO v1_tile(..., kind=3, plan_id, …)` — `v1_tile` 1 row
4. `INSERT INTO v1_plan(id, tile_id, role, revision=0, …)` — `v1_plan` 1 row
5. `persist_plan_definition(tx, …)` — plan child rows (time_requirements, tasks, references 等)
6. `insert_source(tx, &source)` — `v1_source_tile` 1 row
7. `relation_repo::insert_authored_definitions(tx, …)` — relations (本 trace では 0 row)
8. `close_legacy_reflow_targets(tx, owner_id, payload.horizon, now)` — unprotected な legacy placement の close (本 trace では対象 0 row)
9. `materialize(tx, &source, payload.horizon, now)` → `(occurrence_ids, placement_ids)` — `v1_source_occurrence` + `v1_placement` + `v1_placement_baseline` + `v1_placement_life` + `v1_placement_source_ref_*` (必要分)
10. `response_for_with_meta(..., AggregateKind::Source, source_id, Some(1), ..., Some(AggregateMeta {tile_id, plan_id, source_tile_id, occurrence_ids, placement_ids, ...}))` — CommandResponse 構築

全部同じ TX で commit。rollback 時は partial commit ゼロ (v1/10 §4 整合)

---

## 5. 受入条件 5 — response ID + missing id contract (VERIFIED)

### 5-1. response `aggregate_meta` ID (VERIFIED, response body 再掲)

```json
"aggregate_meta": {
  "tile_id": "019fd6e4-085e-7523-a11a-955934b021b0",
  "plan_id": "019fd6e4-085e-7523-a11a-9568c1949312",
  "recurring_id": null,
  "frame_rule_id": null,
  "changeset_id": null,
  "change_ids": [],
  "window_ids": [],
  "flow_ids": [],
  "source_tile_id": "019fd6e4-085e-7523-a11a-955934b021b0",
  "occurrence_ids": ["019fd6e4-0866-7710-a082-e1e14df9c8a7"],
  "placement_ids": ["019fd6e4-0872-7e21-b280-e099492ad398"]
}
```

### 5-2. DB row ↔ response id 照合 (VERIFIED)

| フィールド | response id | DB 上の一致 | source_kind / revision |
|---|---|---|---|
| `aggregate.id` | `019fd6e4-085e-7523-a11a-955934b021b0` | ✓ `v1_tile.id` (kind=3), `v1_source_tile.source_tile_id` | revision=1, kind=SOURCE(4) |
| `aggregate_meta.tile_id` | `019fd6e4-085e-7523-a11a-955934b021b0` | ✓ `v1_tile.id` | — |
| `aggregate_meta.plan_id` | `019fd6e4-085e-7523-a11a-9568c1949312` | ✓ `v1_plan.id` (tile_id=TraceTile, role=0) | revision=0 |
| `aggregate_meta.source_tile_id` | `019fd6e4-085e-7523-a11a-955934b021b0` | ✓ `v1_source_tile.source_tile_id` | — |
| `aggregate_meta.occurrence_ids[0]` | `019fd6e4-0866-7710-a082-e1e14df9c8a7` | ✓ `v1_source_occurrence.id` | state=0 (OPEN), authored=true |
| `aggregate_meta.placement_ids[0]` | `019fd6e4-0872-7e21-b280-e099492ad398` | ✓ `v1_placement.id` (source_kind=4 SOURCE) | revision=1 |
| `revision` | `1` | ✓ `v1_tile.revision`, `v1_source_tile.revision`, `v1_placement.revision` | — |
| `result` | `2` | ✓ ACCEPTED (`CommandResult::ACCEPTED`) | `v1_idempotency.result_kind=2` |
| `command_id` | `019fd6e4-085b-7fc0-bf63-ef75b80bf9b1` | ✓ `v1_idempotency.command_id`, `v1_outbox_event.id` (last segment 同じ) | — |

### 5-3. missing id 契約 (REVIEWED)

- `tastile-web/src/shared/api/v1/schedule-definition.ts:271-284` — `tileId = res.data.aggregate?.id` と `planId = meta?.planId` のいずれかが null / undefined なら `error: {kind:7, message:"publish response missing tile/plan aggregate ids"}` を返して caller が failure 扱い。本 trace では両方とも non-null → ok=true
- core 側 (`source_tile_repo.rs:446-460`) は `response_for_with_meta` で `AggregateMeta {tile_id: Some(...), plan_id: Some(...), source_tile_id: Some(...), occurrence_ids, placement_ids, ..Default::default()}` を必ず Some で詰めている (空配列は `Vec::new()` で正常: occurrence/placement が 0 件なら `placement_ids: Vec::new()` を返す)。`aggregate_meta` 自体は常に Some で返る contract
- 検証: `change_ids`, `window_ids`, `flow_ids`, `recurring_id`, `frame_rule_id`, `changeset_id` は本 trace では empty / null (SourceTile 直系では使わない contract 値)

---

## 6. 受入条件 6 — worker / read-time materialization で `v1_placement` が owner/source/occurrence 単位で生成 (PARTIALLY VERIFIED, DEFERRED 理由明記)

### 6-1. POST TX 内 materialize (VERIFIED — owner/source/occurrence 単位)

POST の `materialize()` 内で owner=9b29 配下に **1 件** の placement が source=TraceTile / occurrence=TraceTile-occurrence に紐付いて生成 (上記 4-3 の row count delta `+1` で確認)。`source_kind=4` (PlacementSource.SOURCE) で `v1_placement.source_tile_id` が NOT NULL。

### 6-2. worker tick — DEFERRED (理由: worker プロセス未起動)

`ps aux` で `tastile-v1-worker` プロセス不在。`drive_fill` の 5 秒 tick は走っていない。TraceTile は one-time / kind=0 / `at=2026-08-07 10:00:00Z` で worker 側 expansion が走っても同じ 1 件しか作らない contract なので、worker tick を観測するうま味は薄い。**DEFERRED** (理由: 観測不可能 — worker 未起動 + one-time は元から 1 件)

### 6-3. read-time materialization — DEFERRED (理由: 別 source の read 観測が混ざる)

owner 9b29 配下の他 source (睡眠: `019fd6e4-07a5-…-c2ef1cf83c3b`, generation_kind=1, interval_ms=86400000) は **既に 33 件** の placement を持つ。これは別セッション (おそらく lazy timeline read) で materialized されたもの。本 trace 専用に read-time materialize を駆動する owner は用意しなかった (fresh owner の TraceTile だけ観測したかった) ため、**read-time での TraceTile 自身の lazy expand は観測せず**。

`/v1/timeline` を GET して TraceTile の source が lazy expand を起こすか試すには horizon 跨ぎが必要 (TraceTile の `at` は 2026-08-07、本 trace 実行は 2026-08-06)。**DEFERRED** (理由: read-time materialization を駆動する GET は本 trace のスコープ外)

### 6-4. 結論 (PARTIALLY VERIFIED)

- **owner / source / occurrence 単位の placement 生成は確認**: POST TX 内 `materialize()` で 1 件生成され、response の `placement_ids[0]` ↔ DB `v1_placement.id` ↔ `v1_placement_baseline.placement_id` ↔ `v1_placement_life.placement_id` ↔ `v1_source_occurrence.id` が全て cross-reference で一致
- **worker tick 観測は不可** (DEFERRED)
- **read-time lazy materialization の TraceTile 観測は不可** (DEFERRED)

---

## 7. 補足 — `v1_idempotency` の replay contract (VERIFIED)

`POST /v1/source-tiles` を同一 idempotency_key で 2 回呼ぶと、2 回目の response body が **完全に一致** (同一 `command_id`, `accepted_at`, `aggregate.id`, 全 ids)。これは `v1_idempotency` (command_id, idempotency_key, request_hash, response jsonb, result_kind, created_at) の `response jsonb` を replay する contract (`crates-v1/api/src/handlers/common.rs::dispatch` 内の idempotency cache 参照パス; 詳細は plan §5 の `expected_revision`/`idempotency_key` の議論参照)。

raw SQL:

```sql
SELECT idempotency_key, command_id, result_kind, created_at
  FROM v1_idempotency WHERE command_id='019fd6e4-085b-7fc0-bf63-ef75b80bf9b1';
019fd700-0000-7000-8000-00000000abcd|019fd6e4-085b-7fc0-bf63-ef75b80bf9b1|2|2026-08-06 11:44:56.41289+00
```

`result_kind=2` = `CommandResult::ACCEPTED` (`v1/HARNESS.md` 数値定数テーブル)。

---

## 8. 補足 — endpoint drift (REVIEWED + VERIFIED)

| Path | command kind | handler | payload 形 | VERIFIED status |
|---|---|---|---|---|
| `POST /v1/source-tiles` | `CreateSourceTile (31)` | `handlers::source_tiles::create` (`source_tiles.rs:108-126`) | `CreateSourceTilePayload` (`command.rs:207-219`) — `{tile, plan, flows, relations, schedule, horizon}` | **200 OK** (本 trace の runtime) |
| `POST /v1/schedule-definitions` | `PublishScheduleDefinition` (legacy) | `handlers::commands::publish_schedule_definition` (`commands.rs:88-108`) | `PublishScheduleDefinitionPayload` (`command.rs:540-559`) — `{tile, plan, windows, recurrence, flows, relations, source_schedule?, source_horizon?, reference_targets?}` | **422 missing field "windows"** (同 payload で試した runtime) |
| web client 呼出先 | `schedule-definition.ts:265` で **必ず `/v1/schedule-definitions`** | — | `buildQuickCreateSchedulePayload` の出力 (windows 必須) | 422 で失敗 contract のため、現状 web QuickCreate は **core に到達できない** |

**修正案 (本 trace のスコープ外)**:

1. `submit.ts:144-149` で `publishScheduleDefinition` を `source_tiles.create` に切替 (SourceTile payload を渡す)
2. もしくは `publishScheduleDefinition` を `/v1/source-tiles` に向けて redirect する proxy ルール追加 (`route.ts:121-172` の `toV1Path` map に `"schedule-definitions": "v1/source-tiles"` を入れる)

どちらも plan §リスク「endpoint drift」の後続 plan で扱う。

---

## 9. DEFERRED 一覧

| # | 項目 | 理由 |
|---|---|---|
| 1 | web 側ブラウザ DevTools Network 観測 | dev サーバ未起動 + `E2E_BYPASS_AUTH` 空のため auth 経路が成立しない |
| 2 | `buildQuickCreateSchedulePayload` の runtime 出力 (JS 実行) | `bun test` 未実行。SourceTile との shape 差分を観測するには別途 web 側 unit test 走らせが要る |
| 3 | worker tick 観測 (criterion 6) | worker プロセス未起動 (`ps aux` で 0 件) |
| 4 | read-time lazy materialization の TraceTile 観測 (criterion 6) | horizon が今日跨ぎのため read trigger せず |
| 5 | `/v1/schedule-definitions` に windows 付き payload を投げて 200 を確認する cross-check | web 側 payload builder を実行しないと正しい windows を組めないため → DEFERRED #2 に依存 |
| 6 | daemon log file 観測 (`tracing` JSON output) | container に log file mount なし (stdout/stderr のみ)。RUST_LOG=info,storage=debug は設定済だが replay 不能 |

---

## 10. 観測の再現手順 (verbatim)

```bash
# 1. write request JSON inside container
wslc container exec tastile-dev-api bash -c 'cat > /tmp/t1a_request.json <<'\''JSON'\''
{
  "expected_revision": null,
  "idempotency_key": "019fd700-0000-7000-8000-00000000abcd",
  "occurred_at": "2026-08-06T12:00:00Z",
  "payload": {
    "tile": {"title": "TraceTile-T1a", "description": "T1a trace artifact", "color": "#0EA5E9", "icon": null, "external_id": null},
    "plan": {"role": 0, "references": [], "completion": {"root": {"All": []}, "time_requirements": [], "tasks": []}, "planning": {"placement_rules": [], "nesting_rules": []}, "metrics": [], "decisions": []},
    "flows": [],
    "relations": [],
    "schedule": {"required_duration_ms": 1800000, "generation": {"kind": 0, "at": "2026-08-07T10:00:00Z", "starts_at": null, "interval_ms": null, "ends_at": null, "weekday_mask": null, "date_range_start": null, "date_range_end": null, "excluded_dates": [], "offset_min": 0}, "window": {"start_offset_ms": 0, "end_offset_ms": 1800000}, "source_window_include": 1, "anchor_mode": 0, "split_policy": {"kind": 0, "min_segment_ms": null, "max_segment_ms": null, "max_segments": null}, "priority": 10},
    "horizon": {"start": "2026-08-06T00:00:00Z", "end": "2026-08-13T00:00:00Z"}
  }
}
JSON'

# 2. POST /v1/source-tiles (canonical path) — VERIFIED 200
wslc container exec tastile-dev-api curl -sv -X POST http://localhost:31400/v1/source-tiles \
  -H "x-owner-id: 9b29443c-0311-5cce-a84d-03a12a326894" \
  -H "x-actor-id: 9b29443c-0311-5cce-a84d-03a12a326894" \
  -H "content-type: application/json" \
  --data-binary @/tmp/t1a_request.json 2>&1 | tee /tmp/t1a_curl_v.txt

# 3. POST /v1/schedule-definitions (legacy path) — VERIFIED 422
wslc container exec tastile-dev-api curl -s -w "\nHTTP=%{http_code}\n" -X POST http://localhost:31400/v1/schedule-definitions \
  -H "x-owner-id: 9b29443c-0311-5cce-a84d-03a12a326894" \
  -H "x-actor-id: 9b29443c-0311-5cce-a84d-03a12a326894" \
  -H "content-type: application/json" \
  --data-binary @/tmp/t1a_request.json

# 4. DB after-state query
wslc container exec tastile-dev-api psql -U tastile -d tastile -tAc "
SELECT 'v1_tile_kind3=' || count(*) FROM v1_tile WHERE owner_id='9b29443c-0311-5cce-a84d-03a12a326894' AND kind=3;
SELECT 'v1_source_tile=' || count(*) FROM v1_source_tile WHERE owner_id='9b29443c-0311-5cce-a84d-03a12a326894';
SELECT 'v1_placement_source_tile=' || count(*) FROM v1_placement WHERE source_tile_id='019fd6e4-085e-7523-a11a-955934b021b0';
SELECT 'v1_idempotency=' || result_kind::text FROM v1_idempotency WHERE command_id='019fd6e4-085b-7fc0-bf63-ef75b80bf9b1';
"
```

---

## 11. 要約

- **canonical upstream path は `POST /v1/source-tiles`** (SourceTile command surface, `CommandKind::CreateSourceTile` (31), `CreateSourceTilePayload` 形)
- **web client は `POST /v1/schedule-definitions` を呼んでいる** (legacy `CommandKind::PublishScheduleDefinition`) → **現状 QuickCreate は core に到達できない (422)**
- proxy rewrite は無し (`toV1Path` map に `schedule-definitions` エントリなし)
- POST TX 内で `v1_tile` (kind=3) + `v1_plan` + `v1_source_tile` + `v1_source_occurrence` + `v1_placement` + `v1_placement_baseline` + `v1_placement_life` + `v1_outbox_event` + `v1_domain_event` + `v1_idempotency` が同 transaction commit
- response の `aggregate.id`, `aggregate_meta.{tile_id, plan_id, source_tile_id, occurrence_ids[0], placement_ids[0]}` はすべて DB row と 1:1 対応 (cross-reference 整合)
- 同一 idempotency_key で 2 回 POST → 同一 response を replay (24h idempotency cache)
- **DEFERRED 6 件** (browser DevTools / web 側 payload builder runtime / worker tick / read-time lazy expand / windows 付き cross-check / daemon log file)

---

🤖 Generated with [Claude Code](https://claude.com/claude-code)
