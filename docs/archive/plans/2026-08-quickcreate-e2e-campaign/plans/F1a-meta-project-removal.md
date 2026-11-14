# F1a — `meta.project` UI 除去と wire の silent drop 化

## メタデータ

- **ID**: F1a
- **Phase**: 2
- **Target repo**: `tastile-web`
- **Sub-project parent**: F (Meta Attrs)
- **Depends on**: A, G, H
- **Source spec**: `04-sub-projects/F-meta-attrs.md` §3, §4
- **Sibling plans**: F1b (`meta.tags` 除去), F2a (`v1_project` 新規テーブル spec), F2b (`v1_tag` 新規テーブル spec)

## 前提

- `tastile-core/v1/02-core-entities.md` に `Project` エンティティは定義されておらず、`v1/02` 全 16 ファイル中の grep でも `Project` または `Tag` という語は Tile / Plan / Placement / Execution のいずれにも現れない（gap matrix の行 "Project / Tags (n/a)" と一致）。
- `tastile-core/crates/v1/api/src/main.rs:258-710` に `/v1/projects` または `/v1/tags` エンドポイントは存在しない（gap matrix 確認済み）。
- wire 経路の throw サイトは `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:240-242` の `if (state.meta.project || state.meta.tags.length > 0) throw new Error("projects and tags are not supported by atomic schedule publish");`。
- UI 側 `state.meta.project: string | null` は `tastile-web/src/shared/stores/quick-create-store.ts`（gap matrix §A）の `MetaSlice` に保持され、デフォルトは `null`。
- source spec §3「Demote (Recommended)」採用。`Remove` ではなく `Demote`（UI affordance を残しつつ submit 時に drop）ではなく、本計画では Remove（affordance 自体を取り去り、submit 時の drop ロジックも除去）を採用する。`Demote` を採用すると "Phase E — not yet persisted" badge を残す選択肢もあるが、本計画では **Remove（完全除去）** を採用する。理由: gap matrix の "Project / Tags (n/a)" 行が恒久的な不在を意味する場合、badge を出して入力させ続けるのは誤った期待を生むため。
- sibling plan F1b と同時に着手・同時にマージする想定。F2a / F2b は user decision 待ちで本計画のスコープ外。

## 目的

`state.meta.project` を wire 経路と UI から完全に取り除き、QuickCreate 提出時に throw しないこと（投げないこと）と、ユーザーが入力不能になることを保証する。`state.meta.tags: string[]` の除去は sibling plan F1b が担当する（本計画は project のみ）。

## 受入条件

- `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:240-242` の `if (state.meta.project || state.meta.tags.length > 0) throw …` 行が完全に取り除かれる（または `state.meta.tags.length > 0` 部分のみ残し、project 条件は除去）。
- `state.meta.project` を参照する箇所が `tastile-web/src/` 配下のどこにも存在しない（`git grep "meta\.project"` で 0 hit）。
- `MetaSubPanel.tsx` から project picker コントロール（input / select / autocomplete）が除去され、ユーザーは project 値を入力できない。
- `QuickCreate.tsx:491` の `meta.tags.map((tag) => …)` chips が F1b と同時に除去される（本計画は project のみ除去）。
- submit 経路で `state.meta.project` が non-null でも throw せず、`publishScheduleDefinition` (`schedule-definition.ts:212`) まで到達する。
- unit test: `quick-create-schedule-wire.test.ts` に「`meta.project = 'MyProject'` でも throw せず payload 構築が成功する」テストケースが追加され PASS する。
- e2e: F1b 同時 e2e（`F-meta-attrs.spec.ts`）の §7 project 非空 + tags 非空の経路で submit が成功し、`v1_tile` 行が 1 件作成される。

## 実装手順

1. **throw ブロックの除去**: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:240-242` の以下の 3 行を削除する:
   ```ts
   if (state.meta.project || state.meta.tags.length > 0) {
     throw new Error("projects and tags are not supported by atomic schedule publish");
   }
   ```
   F1b 完了後は `state.meta.tags.length > 0` 部分も両方不要になるが、F1a 単独マージ時は project 条件のみ落とす形にする: `if (state.meta.tags.length > 0) throw …` の 1 行に縮約する。F1a / F1b 同時マージの場合は完全削除。

2. **`state.meta.project` フィールドの除去**: `tastile-web/src/shared/stores/quick-create-store.ts` の `MetaSlice`（§A）の `project: string | null` フィールドを削除し、関連する setter / reset ロジックから project 代入を除去する。
   - grep 実行: `git grep -n "meta\.project\|meta:.*project" tastile-web/src/` で出現箇所を列挙し、各箇所から `project` キーを抜く。
   - 影響ファイル候補: `quick-create-store.ts`, `MetaSubPanel.tsx`, `QuickCreate.tsx`, `quick-create-schedule-wire.test.ts`, その他 Type 型 export 経由の参照。

3. **UI 除去**: `tastile-web/src/features/create-tile/ui/MetaSubPanel.tsx` から project picker コンポーネント（`<input>` / `<select>` / autocomplete）を削除する。残るのは tags 関連（F1b が除去）または空 fragment。
   - 該当行（source spec §2 より）: `MetaSubPanel.tsx` 内の `meta.project` state を参照する input 要素。
   - QuickCreate の `<MetaSubPanel>` マウント箇所（`QuickCreate.tsx:1018`）は MetaSubPanel 自体が空になってもマウント維持で OK（F1b 完了後に MetaSubPanel 自体を unmount する選択肢は F1b 側で決定）。

4. **Type 整合**: `MetaState` interface（store）から `project: string | null` を削除後、`tsc --noEmit` がエラーなしで完了することを確認する。`Pick<QuickCreateState, …>` の `meta` を含む型を使う箇所（wire, components）があれば追従。

5. **unit test 更新**: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.test.ts` で以下をテストする:
   - 既存の throw 経路テスト（もしあれば）を削除する。
   - 新規テスト `meta.project が store 型から消えたことを確認`（コンパイル時に `state.meta.project` が存在しない型エラーで担保される、明示的な test は不要）。
   - 新規テスト `submit.ts エラーパスから project 参照が消えていることを確認`: `tastile-web/src/features/create-tile/lib/submit.ts` のエラー文字列に "project" が含まれないこと（grep で確認）。
   - sibling plan F1b と統合した統合テスト: 「`meta.tags = ['work']` + project フィールド非存在 でも `publishScheduleDefinition` が呼ばれて payload が構築される」。

6. **e2e テスト追加**: `tastile-web/e2e/f-meta-attrs.spec.ts` を新規作成する。F1b と統合した 1 ファイル（spec 冒頭にコメントで F1a / F1b の同時 green を宣言）。F1a 単独でマージする場合は F1b 部分（tags）を `test.fixme` で残す。
   - QuickCreate を開く → §7 Meta の tags input に `'work'` を入力（project picker は存在しないため入力不可を確認）→ submit。
   - 成功 toast を待つ。
   - `wslc container exec tastile-db psql -tAc "SELECT count(*) FROM v1_tile"` = 1。
   - `getByText(/Phase E/)` が DOM にないこと（F1a は Remove 採用のため badge なし）。

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
   git grep -n "meta\.project" src/
   # 期待: 0 hit（project 参照が完全消滅）
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
   wslc container exec tastile-db psql -U tastile -d tastile_db -c "SELECT title, owner, content->>'description' AS description FROM v1_tile"
   # 期待: 1 行、project 列なし、tags 列なし
   ```
7. **回帰確認**:
   ```bash
   bun run lint
   # 期待: unused import などの lint error なし
   ```

## リスク

- **Remove 採用の妥当性**: 将来 core に Project エンティティが実装された場合、本計画の除去作業を rollback し、再発火する `POST /v1/tiles/{id}/project` エンドポイント経由の永続化実装に置き換える必要がある。gap matrix §A "Project / Tags (n/a)" 行が「n/a のまま」が確定するまでは本計画の判断は暫定。
- **`Pick<QuickCreateState, …>` の `meta` キーが他 wire で必要**: `quick-create-schedule-wire.ts:7-10` の `QuickCreateScheduleState` は `meta` を含む。`memo` は継続利用されるため `meta` キーは維持する。`meta` から `project` キーを抜くだけ。
- **既存ユーザー入力の消失**: 既にユーザーが project を入力して下書き保存された localStorage / sessionStorage データがあれば、フィールド除去で読まれなくなる。`hydrate` 経路で型エラーが出ないことを §検証手順 step 3 の `tsc` で担保する。
- **F1b との順序**: F1b が先にマージされ F1a が後マージになると、wire throw ブロックが「`state.meta.tags.length > 0` のみ」の状態で中間リリースされ、project だけ許容される瞬間が生まれる。F1a / F1b を 1 PR にまとめて同時マージする。

## 関連

- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/F-meta-attrs.md` §2 (現状), §3 (選択肢), §4 (変更手順)
- **Sibling plans**:
  - `04-plans/F1b-meta-tags-removal.md` (tags 除去、同時マージ)
  - `04-plans/F2a-meta-project-spec.md` (将来 wire 拡張する場合の v1_project table spec — 採用しない場合 no-op)
  - `04-plans/F2b-meta-tags-spec.md` (将来 wire 拡張する場合の v1_tag table spec — 採用しない場合 no-op)
- **Throw サイト**: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:240-242`
- **UI**: `tastile-web/src/features/create-tile/ui/MetaSubPanel.tsx`, `tastile-web/src/features/create-tile/ui/QuickCreate.tsx:491,1018`
- **Store**: `tastile-web/src/shared/stores/quick-create-store.ts` (MetaSlice, defaultRecurring の隣)
- **Submit エラーパス**: `tastile-web/src/features/create-tile/lib/submit.ts:62-63`
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