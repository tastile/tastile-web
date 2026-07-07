# tile 作成/編集パネルの失敗 fix + アーキ修正 (2026-07-04)

## 概要

tastile-web の QuickTileCreate パネル (ダッシュボード / カレンダー / スケジュールで
タイル新規作成/編集を行う UI) が API を叩くと連続失敗する件を、proxy の即時修正 +
並行稼働中の v1 クライアント設計上の根本問題 (POST 前 GET / クライアント採番 UUID) を
整理する。

## 観察された失敗 (ユーザー報告: 2026-07-04 以前)

ブラウザ DevTools で観測された status code と原因マッピング:

| status | path | 真因 |
| --- | --- | --- |
| 401 | `/api/proxy/*` | bridge secret 必須化 (commit 386f733 "Refactor code structure" で auto-bootstrap から hard-require へ変更)。cookie 喪失 or auth race |
| 500 | `/v1/labels` | daemon 側バグ。query 任意で 500。out-of-scope |
| 404 | `/views/pending-prompt` | proxy の `toV1Path` マッピング欠落 (`src/lib/api/endpoints.ts:688` には存在)。daemon は `/v1/prompts/pending` のみ受理 |
| 400 | `/v1/timeline/today` | daemon handler が `start` クエリ必須。パネルからは無 query で届く |

## 即時修正 (このコミットで実施)

| 場所 | 変更 |
| --- | --- |
| `src/app/api/proxy/[...path]/route.ts:551` 付近 | `toV1Path` マップに `views/pending-prompt → v1/prompts/pending`, `prompts/current → v1/prompts/pending` を追加 |
| `src/app/api/proxy/[...path]/route.ts:447` 付近 | `upstreamPath === "v1/timeline/today"` かつ `start` クエリ無しの場合、UTC 今日の 00:00 を補って daemon へ転送 |
| `src/app/api/proxy/route.test.ts` | マッピング 2 件のリグレッションテストを追加 |

即時修正は daemon 側を触らず、proxy 層のパス翻訳とクエリ補完で吸収する。

## アーキ上の問題 (本プランの本来スコープ)

ユーザーからの指摘:

> というかなんでタイルのUUIDをフロントが渡してるの? UUIDを生成するのはバックエンドからだし
> そもそもPOSTの前にGETが出来てるのもおかしい。APIの返り値でUUIDがあるなら別だけど
> そもそも作成できてないから

v1 仕様 (`tastile-core/v1/10-invariants.md`) では識別子は UUIDv7 のみで文字列禁止 / 0 を
センチネルにしない / ドメインイベント集約はサーバ採番が基本。現在の `tastile-web` の
実装がこれを逸脱している箇所を列挙する。

### A. `createManualPlacementCommand` が POST→GET→POST の 3 段

- 場所: `src/lib/api/v1/tile-commands.ts:732-770`
- 流れ: `POST /v1/tiles` → response から `tileId` (OK) → `GET /v1/tiles/{tileId}` で
  自動生成された `plan_id` を読み返し → `POST /v1/placements`
- 問題:
  1. **GET が fragility point**. 200 でも 404/500 でも二度目の request に依存。
     Step 1 成功 → Step 2 失敗 で Tile が孤立する。
  2. **不要なラウンドトリップ**. 3 段ハネる のは POST レスポンスに `plan_id` が
     含まれないため。
- あるべき姿:
  - **daemon 側**: `POST /v1/tiles` レスポンスに `aggregate.plan_id` を含める
    (Tile と Plan は同一 TX で作成されるので Payload に既に存在する情報)
  - **frontend 側**: `readTileCommand` の step-2 GET を撤廃。レスポンスを直接読む。

### B. `loadFromRecurringTile` の GET-before-POST

- 場所: `src/lib/stores/quick-create-store.ts:392-479`
- 流れ: パネル open → `editingId=tileId` を store に格納 → GET /v1/tiles/{tileId} →
  レスポンスから form を hydration
- 問題:
  1. **GET が失敗すると form が空のまま edit mode になり、Save 押下時に何が
     送られるか分からない** (実際 Save はデフォルト値で UPDATE するため title が
     消える事故が起きる)
  2. panel 入力値は user が上書きするので hydration の必然性が低い (title / desc /
     color / icon / recurrence 程度であれば upstream event が既に持っている)
- あるべき姿:
  - **simple edit**: GET 不要。`editingId` と upstream が持つ patch 対象値だけで
    UPDATE_TILE コマンドを送れる。
  - **complex edit (recurrence 詳細 / plan 構造の編集)**: 必要なので GET は残す。
    ただし失敗時は silent fallback ではなく banner で通知し Save をブロックする。

### C. クライアント側 UUIDv7 生成

- 場所: `src/lib/api/v1/tile-commands.ts`
  - L313: `frameRuleId = uuidv7()` ← **Frame Rule のドメイン集約 ID**. サーバ採番が正。
    リトライで別 ID が送られサーバ側に重複 Frame Rule を作る可能性
  - L579, L595, L613: `id: uuidv7()` / `command_id: uuidv7()` ← ChangeSet / Change /
    Command 監査メタデータ。サーバ採番が正。
- 仕様整合: v1/10 §「識別子は UUIDv7 のみ」は型制約であって「サーバ採番」を
  規定していないが、`v1/04` の ChangeSet layer / rank / Key の解決モデルでは
  `revoked` や append-only event ordering の都合上、サーバ採番が前提。
- あるべき姿:
  - `command_id` (envelope): クライアント採番 OK (idempotency のため)
  - `idempotency_key`: クライアント採番 OK
  - **それ以外** (frameRuleId / changeset.id / change.id / actor.command_id):
    POST body から削除し、サーバが Payload を埋めて返す

### D. Plan Completion 派生

- 場所: `src/lib/stores/quick-create-store.ts:125-179` の `defaultConditionRoot()` 等
- 状態: 現時点では v1 仕様の Plan.completion 木をクライアント側で組み立てて送るが、
  サーバは最終的に有効な木に正規化する (想定)。 2026-07-02 v1-completion プランで
  サーバ側を統一済。frontend 側の過剰組み立てを縮小する余地はあるが、UX 観点で
  現時点では残置 OK。**本プランスコープ外**。

## 触るファイル (アーキプランスコープ)

| 種類 | ファイル | 修正 |
| --- | --- | --- |
| daemon | `tastile-core/crates/v1/api/src/main.rs` (POST /v1/tiles handler) | `plan_id` をレスポンス `aggregate` へ追加 |
| daemon | `tastile-core/crates/v1/api/src/main.rs` (POST /v1/recurring/{id}/frame-rules handler) | Frame Rule ID をサーバ採番化、Payload 側の `id` 任意 |
| daemon | `tastile-core/crates/v1/storage/src/change_set.rs` 等 | ChangeSet / Change の `id` サーバ採番化 (idempotency_key 以外) |
| frontend | `src/lib/api/v1/tile-commands.ts:732-770` | GET-after-POST 撤廃 |
| frontend | `src/lib/api/v1/tile-commands.ts:262-340` | `frameRuleId` 採番を撤去し client payload から除く |
| frontend | `src/lib/api/v1/tile-commands.ts:570-617` | ChangeSet / Change `id` を Payload から除く |
| frontend | `src/lib/stores/quick-create-store.ts:392-479` | `loadFromRecurringTile` の GET を optional 化。simple edit は GET 不要 |

## 触らないファイル

- `tastile-core/crates/v0/*` — 凍結
- `tastile-core/crates/tastile-scheduler`, `tastile-daemon`, `tastile-cli`,
  `tastile-mcp`, `tastile-plugin-runtime` — 凍結
- `tastile-core/crates/v1/api/src/main.rs` の handler 経路以外 (Storage /
  Domain は触る余地ありだが、aggregation ロジックの侵入は禁止)
- `tastile-web/src/app/api/events/*` — 旧イベント互換ルート (E2E bypass 用)
- `tastile-web/src/lib/hooks/use-daemon-execution.ts` — 既に deprecated

## 不変条件への影響

- v1/10 §1 「識別子は UUIDv7 のみ」: 維持 (生成場所の正規化であって型制約ではない)
- v1/10 §2 「0 をセンチネルにしない」: 影響なし
- v1/10 §3 「JSONB / metadata_json を正本に保存しない」: 維持
- v1/10 §4 「直接 DB を触らない」: 維持 (Store 抽象は変更なし)
- v1/10 §5 「解決 layer → rank → Key」: 維持
- v1/10 §6 「Execution は Placement だけから開始」: 維持
- v1/14 §1-2 「Command/Response Envelope」: aggregator のレスポンスフィールド追加は
  additive 互換 (破壊変更なし)

## 受け入れ条件

1. **即時**: bun test で `src/app/api/proxy/route.test.ts` 緑
2. **アーキ**:
   - `cargo test --workspace` で既存 178 件が引き続き Green
   - 新 AT: `at_create_placement_returns_plan_id_in_response` を
     `crates/v1/api/tests/` に追加し Green
   - 新 AT: `at_frame_rule_id_is_server_assigned` を同様
   - 新 AT: `at_load_from_recurring_tile_handles_get_failure_gracefully`
     を `tastile-web/src/lib/stores/quick-create-store.test.ts` に追加
3. **手動検証** (本コミット後):
   - chrome devtools で `/api/proxy/views/pending-prompt` が 200 を返す
   - `/api/proxy/views/timeline/today` が 200 を返す (`start` が自動付与)
   - パネルから新規 Placement Tile を作成し `tile.id`, `placement.id` が
     server-generated UUIDv7 として response に返る

## 実装順序 (本コミットはこのプランの前半のみ)

```
✅ Step 1: proxy の toV1Path に pending-prompt / prompts/current を追加
✅ Step 2: proxy の timeline/today で start 補完
⏳ Step 3: POST /v1/tiles レスポンスに plan_id 追加 (daemon)
⏳ Step 4: Frame Rule ID サーバ採番化 (daemon + frontend)
⏳ Step 5: ChangeSet / Change ID サーバ採番化 (daemon + frontend)
⏳ Step 6: loadFromRecurringTile の GET optional 化 (frontend)
⏳ Step 7: AT 追加 + 全 Green
```

Step 3 以降は daemon 側を含むため別 PR で進める。本コミットは Step 1-2 で panel
を通せる状態に戻すところまで。

## コミット

`fix(v1/web): route pending-prompt / timeline/today via daemon v1 endpoints`
