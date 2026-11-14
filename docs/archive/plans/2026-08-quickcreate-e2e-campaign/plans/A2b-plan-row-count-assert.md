# A2b1 — v1_plan 行数・role 検証計画

## メタデータ

- **ID**: A2b1
- **Phase**: 1
- **Target repo**: `tastile-web` + `tastile-core`
- **Sub-project parent**: A — Tile + Plan + Meta (minimum) wire + e2e
- **Depends on**: A2a
- **Source spec**: `04-sub-projects/A-tile-plan.md` §3 step 2

## 前提

- A2a が完了し、QuickCreate の送信結果から submitted tile UUID と plan ID を取得できる状態である。
- QuickCreate の送信経路は `buildQuickCreateSchedulePayload`（`tastile-web/src/lib/.../quick-create-schedule-wire.ts:213-450`、実際の import path は A2a の変更に合わせて確認）から `POST /v1/schedule-definitions` を通り、core の `CreateSourceTilePayload`（`tastile-core/crates-v1/domain/src/command.rs:198-210`）が `tile` と `plan` を同一 command payload として受け取る。
- Plan の保存は `SetPlanPayload`（`tastile-core/crates-v1/domain/src/command.rs:242-250`）の `tile_id` と `role` を使い、`PlanRole::EXECUTABLE` の数値は `0`（`tastile-core/v1/HARNESS.md` の定数表）である。
- e2e は `tastile-web/e2e/quick-tile-create-e2e.spec.ts:1-64` を実行し、DB 操作は web 側から直接行わず `wslc container exec tastile-db psql ...` を使う。

## 目的

QuickCreate で 1 tile を送信したとき、core の Postgres に tile と結び付いた plan が重複なく 1 行だけ作成され、role が `EXECUTABLE (0)` であることを、submitted tile UUID と plan ID をキーにして実 DB で証明する。

## 受入条件

- submitted tile UUID を `<submitted-tile-uuid>` として `SELECT count(*) FROM v1_plan WHERE tile_id = '<submitted-tile-uuid>';` が `1` を返す。
- 取得した `<plan-id>` について `SELECT tile_id, role FROM v1_plan WHERE id = '<plan-id>';` が submitted tile UUID と role `0`（EXECUTABLE）を返す。
- DB を `v1_tile` と `v1_plan` の両方について TRUNCATE した直後に 1 tile を送信すると、両テーブルの対象行が 1 対 1 で対応し、orphan plan または複数 plan が存在しない。

## 実装手順

1. `tastile-web/e2e/quick-tile-create-e2e.spec.ts:11-23` の cleanup helper を A2a の cleanup 方針から引き継ぎ、対象 test の開始前に `v1_tile` と `v1_plan` を含む TRUNCATE が実行されることを確認する。A2b では少なくとも次の SQL を使う。
   ```sql
   TRUNCATE v1_plan, v1_tile RESTART IDENTITY CASCADE;
   ```
   実際の stack cleanup では既存の placement/event 等の依存表も A2a の指定どおり同じ command に含める。

2. `tastile-web/e2e/quick-tile-create-e2e.spec.ts:30-46` の submit 部分に、A2a が提供する submitted tile UUID と plan ID の取得処理を接続する。取得元は response body または A2a が固定した DB lookup とし、画面表示タイトルの検索だけで tile を特定しない。

3. `tastile-web/e2e/quick-tile-create-e2e.spec.ts:47-63` の occurrence assertion の前後に、submitted tile UUID を bind した plan count query を追加する。
   ```sql
   SELECT count(*) FROM v1_plan WHERE tile_id = '<submitted-tile-uuid>';
   ```
   結果を trim して整数化し、`1` と assert する。SQL 文字列の組み立てでは UUID 以外のユーザー入力を埋め込まない。

4. 同じ e2e test に plan ID lookup を追加し、`v1_plan` の persisted identity と role を確認する。
   ```sql
   SELECT tile_id, role FROM v1_plan WHERE id = '<plan-id>';
   ```
   返却行が 1 行であること、`tile_id === submitted-tile-uuid`、`role === 0` を assert する。文字列 `EXECUTABLE` を DB に保存・検索する実装にはしない。

5. `tastile-core/crates-v1/domain/src/command.rs:242-250` と、実際に `SetPlanPayload` を INSERT へ変換する `tastile-core/crates-v1/storage/src/plan_repo.rs:21-` を照合し、`tile_id` が plan の結合キーとして保存され、role が数値 `0` のまま SQL に渡ることを確認する。A2b で core の永続化コードを変更する必要がある場合だけ、最小修正を同ファイルに限定して追加する。変更不要なら core は no source change とする。

6. e2e 内の negative setup を明示する。TRUNCATE 後に submit するため、既存 row による count の水増しを許さず、`v1_tile` の submitted UUID に対する plan count と `v1_plan` の plan ID lookup を同一 test の同一 submission に結び付ける。

7. SQL assertion と occurrence assertion が共存することを確認し、A2b の完了時点で変更対象が `tastile-web/e2e/quick-tile-create-e2e.spec.ts` と、必要な場合のみ `tastile-core/crates-v1/storage/src/plan_repo.rs` に限定されていることを `git diff --stat` で確認する。

## 検証手順

1. core の v1 stack を起動する。
   ```bash
   cd C:/Users/rebui/Desktop/tastile/tastile-core
   bash scripts/wslc/up-v1.sh
   ```
   期待: `tastile-db` と API が running、`curl http://127.0.0.1:31400/v1/health` が HTTP 200。

2. web 側で対象 e2e spec を実行する。
   ```bash
   cd C:/Users/rebui/Desktop/tastile/tastile-web
   bun run test:e2e quick-tile-create-e2e.spec.ts
   ```
   期待: QuickCreate の submit と既存 occurrence assertion が PASS し、A2b の SQL assertion も PASS する。

3. 実行後、submitted UUID と plan ID を使って SQL を再確認する。
   ```bash
   wslc container exec tastile-db psql -U tastile -d tastile_db -At -c "SELECT count(*) FROM v1_plan WHERE tile_id = '<submitted-tile-uuid>';"
   # 期待: 1

   wslc container exec tastile-db psql -U tastile -d tastile_db -At -F '|' -c "SELECT tile_id, role FROM v1_plan WHERE id = '<plan-id>';"
   # 期待: <submitted-tile-uuid>|0
   ```

4. negative setup を含む clean run を少なくとも 1 回確認する。TRUNCATE 直後に submit した結果として、対象 tile に対する plan count が `1`、plan ID lookup が 1 行、role が `0` であることを実測する。テストが skip した場合は成功と扱わず、Postgres 接続可能な状態で再実行する。

5. 変更が core に及んだ場合は core 側でも検証する。
   ```bash
   cd C:/Users/rebui/Desktop/tastile/tastile-core
   cargo fmt --manifest-path crates-v1/Cargo.toml --all -- --check
   cargo test --manifest-path crates-v1/Cargo.toml --workspace -- --test-threads=1
   ```
   Windows 側で C dependency が阻害される場合は、プロジェクトの wslc 検証経路を使う。実行ログに `test result: ok` と `0 failed` が出るまで VERIFIED と宣言しない。

## リスク

- **Orphan plan**: tile insert 後に plan insert が失敗すると、submitted tile に plan が無い、または tile に紐付かない plan が残る可能性がある。TRUNCATE 後の `tile_id` count と plan ID lookup を同一 submission に対して実行し、1-to-1 を検出する。command transaction の部分成功が疑われる場合は core の transaction 境界を A2b の範囲で調査する。
- **Role mismatch**: web の default state、`meta.isLabelOnly`、または payload mapping が `role=1` を送ると EXECUTABLE 契約に反する。DB の `role` を文字列表示や UI から推測せず、数値 `0` を直接 assert する。
- **Stale database rows**: cleanup が `v1_tile` / `v1_plan` を消し切らないと count assertion が偽陽性になる。test の最初に両テーブルを TRUNCATE し、必要な依存表を CASCADE で同時に掃除する。
- **Identifier acquisition drift**: A2a の response shape が変わると plan ID または tile UUID の抽出が壊れる。A2b は A2a の確定した取得契約を再利用し、タイトル検索を代替キーにしない。
- **環境差**: Docker 前提の既存 helper を残すと wslc stack で cleanup が失敗する。`docker exec` を新たに追加せず、指定の `wslc container exec tastile-db` 経路に統一する。

## 関連

- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/04-sub-projects/A-tile-plan.md` §1, §3 step 2, §4
- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/04-plans/G1a-wslc-image-build.md` — plan structure / wslc verification style
- `C:/Users/rebui/Desktop/tastile/tastile-web/e2e/quick-tile-create-e2e.spec.ts:11-63` — existing cleanup, submit, occurrence assertion
- `C:/Users/rebui/Desktop/tastile/tastile-core/crates-v1/domain/src/command.rs:198-210` — `CreateSourceTilePayload`
- `C:/Users/rebui/Desktop/tastile/tastile-core/crates-v1/domain/src/command.rs:242-250` — `SetPlanPayload` (`tile_id`, numeric `role`)
- `C:/Users/rebui/Desktop/tastile/tastile-core/crates-v1/storage/src/plan_repo.rs:21-` — Plan persistence implementation
- `C:/Users/rebui/Desktop/tastile/tastile-core/v1/02-core-entities.md` — Plan role semantics
- `C:/Users/rebui/Desktop/tastile/tastile-core/v1/10-invariants.md` — transaction atomicity, numeric constants, normalized persistence
- `C:/Users/rebui/Desktop/tastile/tastile-core/v1/14-read-model-and-endpoint.md` — command/read API contract
