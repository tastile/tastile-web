# F1b — `meta.tags[]` UI 除去と wire の silent drop 化

## メタデータ

- **ID**: F1b
- **Phase**: 2
- **Target repo**: `tastile-web`
- **Sub-project parent**: F (Meta Attrs)
- **Depends on**: A, G, H
- **Source spec**: `04-sub-projects/F-meta-attrs.md` §3, §4
- **Sibling plans**: F1a (`meta.project` 除去), F2a (`v1_project` 新規テーブル spec), F2b (`v1_tag` 新規テーブル spec)

## 前提

- `tastile-core/v1/02-core-entities.md` に `Tag` エンティティは定義されておらず、Tile / Plan / Placement / Execution のいずれにも Tag は存在しない（gap matrix の行 "Project / Tags (n/a)" と一致）。
- `tastile-core/crates/v1/api/src/main.rs:258-710` に `/v1/tags` エンドポイントは存在しない（gap matrix 確認済み）。
- wire 経路の throw サイトは `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:240-242` の `if (state.meta.project || state.meta.tags.length > 0) throw …`。
- UI 側 `state.meta.tags: string[]` は `tastile-web/src/shared/stores/quick-create-store.ts` の `MetaSlice` に保持され、デフォルトは `[]`。
- `tastile-web/src/features/create-tile/ui/QuickCreate.tsx:491` で `meta.tags.map((tag) => …)` chips を描画している（source spec §2 より）。
- source spec §3「Demote (Recommended)」採用。F1a と同じく **Remove**（affordance 自体を取り去り、submit 時の drop ロジックも除去）を採用する。
- F1b は F1a と 1 PR で同時マージする想定。F1a との順序依存: F1b を先にマージすると中間状態で project のみ許容されるバグ window が生まれるため、絶対同時マージ。

## 目的

`state.meta.tags[]` を wire 経路と UI から完全に取り除き、QuickCreate 提出時に throw しないこと（投げないこと）と、ユーザーが tag を入力・削除できないことを保証する。`state.meta.project: string | null` の除去は sibling plan F1a が担当する（本計画は tags のみ）。

## 受入条件

- `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:240-242` の `if (state.meta.project || state.meta.tags.length > 0) throw …` 行が完全に取り除かれる（F1a 同時マージ時）または `state.meta.project` 部分のみ残し tags 条件は先に除去される。
- `state.meta.tags` を参照する箇所が `tastile-web/src/` 配下のどこにも存在しない（`git grep "meta\.tags"` で 0 hit、ただし F1a 同時マージでない場合は F1a 部分でのみ残存許容）。
- `MetaSubPanel.tsx` から tag 入力（input / chip add）コントロールが除去され、tag chip 描画（`QuickCreate.tsx:491` の `meta.tags.map`）も消える。
- submit 経路で `state.meta.tags` が `['work']` でも throw せず、`publishScheduleDefinition` (`schedule-definition.ts:212`) まで到達する。
- unit test: `quick-create-schedule-wire.test.ts` に「`meta.tags = ['work']` でも throw せず payload 構築が成功する」テストケースが追加され PASS する。
- e2e: F1a 同時 e2e（`F-meta-attrs.spec.ts`）の §7 tags 非空の経路で submit が成功し、`v1_tile` 行が 1 件作成される。

## 実装手順

1. **throw ブロックの除去**: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:240-242` の以下の 3 行を削除する:
   ```ts
   if (state.meta.project || state.meta.tags.length > 0) {
     throw new Error("projects and tags are not supported by atomic schedule publish");
   }
   ```
   F1a 完了後は完全削除。F1b 単独マージ時は `if (state.meta.project) throw …` の 1 行に縮約する（F1a が先行マージするシナリオは本計画では禁止）。

2. **`state.meta.tags` フィールドの除去**: `tastile-web/src/shared/stores/quick-create-store.ts` の `MetaSlice`（§A）の `tags: string[]` フィールドを削除し、関連する setter（addTag / removeTag 等）/ reset ロジックから tags 代入を除去する。
   - grep 実行: `git grep -n "meta\.tags\|addTag\|removeTag" tastile-web/src/` で出現箇所を列挙し、各箇所から tags キーを抜く。
   - 影響ファイル候補: `quick-create-store.ts`（`MetaSlice`, `addTag`, `removeTag`, `reset`）, `MetaSubPanel.tsx`（tag chip list）, `QuickCreate.tsx:491`（chip rendering）, `quick-create-schedule-wire.test.ts`, その他 tag 参照 component。

3. **UI 除去**: `tastile-web/src/features/create-tile/ui/MetaSubPanel.tsx` から tag 入力コンポーネント（chip add input, 削除ボタン）を削除する。残るのは project 関連（F1a が除去）または空 fragment。
   - `tastile-web/src/features/create-tile/ui/QuickCreate.tsx:491` の `meta.tags.map((tag) => …)` ブロックを削除する。
   - MetaSubPanel 自体が空（project + tags 両方除去）になった場合、QuickCreate.tsx:1018 の `<MetaSubPanel>` マウント自体を unmount しても OK。

4. **Type 整合**: `MetaState` interface（store）から `tags: string[]` を削除後、`tsc --noEmit` がエラーなしで完了することを確認する。

5. **unit test 更新**: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.test.ts` で以下をテストする:
   - 既存の throw 経路テスト（`state.meta.tags = ['work']` で throw を期待するもの）を削除し、silent drop テストに置き換える: 「`state.meta.tags = ['work']` でも payload 構築が成功し、payload 内に tags フィールドが含まれない」。
   - sibling plan F1a と統合した統合テスト: 「`meta.tags = ['work']` + project フィールド非存在 でも `publishScheduleDefinition` が呼ばれて payload が構築される」。

6. **e2e テスト追加**: `tastile-web/e2e/f-meta-attrs.spec.ts` を新規作成する（F1a と統合）。F1b 単独でマージする場合は F1a 部分（project）を `test.fixme` で残す。
   - QuickCreate を開く → §7 Meta の tags input に `'work'` を入力 → submit。
   - 成功 toast を待つ。
   - `wslc container exec tastile-db psql -tAc "SELECT count(*) FROM v1_tile"` = 1。
   - tag chip が DOM に存在しないこと（`getByText('work')` が tag chip selector 内では 0 hit、description 内の偶然一致は除外）。

7. **実行**:
   ```bash
   cd C:/Users/rebui/Desktop/tastile/tastile-web
   bun run lint
   bun test src/shared/api/v1/quick-create-schedule-wire.test.ts
   bun run test:e2e f-meta-attrs.spec.ts
   ```

## 検証手順

1. **grep 確認**:
   ```bash
   cd C:/Users/rebui/Desktop/tastile/tastile-web
   git grep -n "meta\.tags\|addTag\|removeTag" src/
   # 期待: 0 hit（tags 参照が完全消滅、F1a 同時マージ時）
   ```
2. **wire throw 除去確認**:
   ```bash
   git grep -n "projects and tags are not supported" src/
   # 期待: 0 hit
   ```
3. **type check**:
   ```bash
   bun run tsc --noEmit
   # 期待: exit 0、no error
   ```
4. **unit test**:
   ```bash
   bun test src/shared/api/v1/quick-create-schedule-wire.test.ts
   # 期待: 全 PASS
   ```
5. **e2e**:
   ```bash
   bun run test:e2e f-meta-attrs.spec.ts
   # 期待: exit 0、submit 成功、`v1_tile` count=1
   ```
6. **DB 直接確認**（e2e 実行後）:
   ```bash
   wslc container exec tastile-db psql -U tastile -d tastile_db -c "SELECT title, owner, content->>'description' AS description, content FROM v1_tile"
   # 期待: 1 行、`content` JSONB 内に `tags` キーなし
   ```
7. **回帰確認**:
   ```bash
   bun run lint
   # 期待: unused import などの lint error なし
   ```

## リスク

- **Remove 採用の妥当性**: 将来 core に Tag エンティティが実装された場合、本計画の除去作業を rollback し、再発火する `POST /v1/tiles/{id}/tags` エンドポイント経由の永続化実装に置き換える必要がある。gap matrix §A "Project / Tags (n/a)" 行が「n/a のまま」が確定するまでは本計画の判断は暫定。
- **chip rendering 除去漏れ**: `QuickCreate.tsx:491` の `meta.tags.map` 以外の場所で chip を描画している component があれば除去漏れする。grep で `tags\.map` を `src/` 全体で検索して全箇所除去すること。
- **F1a との順序**: F1a が先にマージされ F1b が後マージになると、wire throw ブロックが「`state.meta.project` のみ」の状態で中間リリースされ、tags だけ許容されない偏った状態が生まれる。F1a / F1b を 1 PR にまとめて同時マージする。
- **既存ユーザー入力の消失**: 既にユーザーが tags を入力して下書き保存された localStorage / sessionStorage データがあれば、フィールド除去で読まれなくなる。`hydrate` 経路で型エラーが出ないことを §検証手順 step 3 の `tsc` で担保する。
- **他 feature での `meta.tags` 参照**: `tastile-web/src/features/create-tile/` 以外（例: `dashboard` 配下の旧 tile 表示）で `meta.tags` を参照している箇所があれば除去漏れする。`git grep` を `src/` 全体に対して実行する。

## 関連

- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/F-meta-attrs.md` §2 (現状), §3 (選択肢), §4 (変更手順)
- **Sibling plans**:
  - `04-plans/F1a-meta-project-removal.md` (project 除去、同時マージ)
  - `04-plans/F2a-meta-project-spec.md` (将来 wire 拡張する場合の v1_project table spec — 採用しない場合 no-op)
  - `04-plans/F2b-meta-tags-spec.md` (将来 wire 拡張する場合の v1_tag table spec — 採用しない場合 no-op)
- **Throw サイト**: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:240-242`
- **UI**: `tastile-web/src/features/create-tile/ui/MetaSubPanel.tsx`, `tastile-web/src/features/create-tile/ui/QuickCreate.tsx:491`
- **Store**: `tastile-web/src/shared/stores/quick-create-store.ts` (MetaSlice, addTag, removeTag)
- **Wire test**: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.test.ts`
- **Domain gap matrix**: `tile-create-e2e-wiring/03-gap-matrix.md` 行 "Project / Tags (n/a)"
- **実装順**: `tile-create-e2e-wiring/05-impl-order.md` §Execution sequence 行 5 (F)
- **Memory anchors**:
  - `feedback_verify_ui_in_browser.md` (e2e で実 DB 確認)
  - `feedback_observe_actual_behavior.md` (throw 0 件を devtools console で確認)
  - `feedback_no_fragmented_reimplementations.md` (Remove 採用で「break?」判定を撒かない)
- **Out of scope (deferred)**:
  - F2a (v1_project table 設計 — 採用しない)
  - F2b (v1_tag table 設計 — 採用しない)
  - core 側 Project / Tag エンティティ追加（gap matrix の "n/a" が確定するまで着手しない）