# C4b — Split policy（min/max/max_segments）延期計画

## メタデータ

- **ID**: C4b
- **Phase**: 1
- **Target repo**: `tastile-web`
- **Sub-project parent**: C
- **Depends on**: C4a
- **Source spec**: `04-sub-projects/C-recurring-source.md` §「対象フィールド」の `split_policy` partial rows + §「リスク」

## 前提

- `SourceSchedule.split_policy.kind` は `source_schedule.rs:112-118` の `SplitPolicy` に対応し、`Unsplit=0` / `Split=1` である。
- QuickCreate の現行 UI は `source.splitPolicy` の kind だけを wire に出し、`min_segment_ms` / `max_segment_ms` / `max_segments` を入力・送信しない。
- したがって `splitPolicy=SPLIT` を選ぶと、`kind=1` のまま segment fields が無い payload になり、core の validation により HTTP 400 になる（親仕様の §「リスク」では server rejection を 400 と記録している）。
- この計画では Split の server 実装、segment fields のデータモデル、DB migration は扱わない。C4a が再開されるまで UI から到達不能にする。

## 目的

現行 build で未対応の Split を QuickCreate から選べないようにし、segment fields が無い不完全な wire payload を server に送らない。Split を将来再開する場合は、C4a で min/max/max_segments の UI・wire mapping・validation contract を先に確定する。

対応方針は次の二択を記録する。

1. **(a) 推奨**: Split selector の Split option を disabled にし、segment fields が追加されるまで選択不能にする。
2. **(b) 代替**: Split 自体を延期し、仮に選択操作が発生した場合は UI に「not supported in this build」と表示する。

本計画では (a) を実装方針とする。既存の `UNSPLIT` default / wire mapping は変更しない。

## 受入条件

- Split は現行 UI から到達不能である。Split option は disabled で、ユーザーが選択・送信できない。
- Split option に tooltip または同等の補助説明として **「not supported」** が表示され、未対応理由をユーザーが把握できる。
- Split を送信する経路を作らず、QuickCreate の通常作成で server から Split 起因の 422 は発生しない（本件の server validation rejection は 400 とし、UI guard により到達しない）。

## 実装手順

1. `tastile-web` の QuickCreate Source セクションから `source.splitPolicy` selector component を特定する。既存 wire-builder で `source.splitPolicy` を参照している箇所を検索し、selector の実ファイルと行番号を記録する。候補を推測で作らず、実際の call site を使用する。
2. selector component の option 定義部分（`<option>` / Mantine `Select` / `Radio` 等、特定後の `file:line`）で、既存の `UNSPLIT` option はそのまま維持し、`SPLIT` option だけを disabled にする。
3. 同じ `SPLIT` option に tooltip を付け、表示文言を正確に **`not supported`** とする。既存の tooltip / a11y パターンがある場合はそれを再利用し、未対応の Split を enabled に戻す条件や client-side segment defaults は追加しない。
4. selector の change handler / controlled value 更新を確認し、disabled option が keyboard、pointer、直接イベントのいずれでも `source.splitPolicy` を Split に更新しないことを保証する。必要な場合のみ、既存 handler に最小限の guard を追加する。
5. selector の近接 unit test が存在する場合は、Split option の `disabled` と tooltip 文言を検証するテストを追加する。テストが無い場合でも、既存 test harness に過剰な新規 abstraction を作らず、検証は手動 probe を正本とする。
6. `source.splitPolicy` の wire-builder は変更しない。C4a 再開時に segment fields を追加する場所として、現行 wire mapping の該当箇所（`tastile-web` 内の SourceSchedule builder、調査時点の `file:line`）を関連メモに記録する。
7. 変更後に `git diff --check` と web の型・unit 検証を実行し、Split guard 以外のファイル変更がないことを確認する。

## 検証手順

1. `tastile-web` の開発サーバーを起動し、ブラウザで QuickCreate を開く。
2. Source セクションの Split policy selector を表示する。
3. `Split` option が disabled であることを、pointer 操作と keyboard 操作の両方で確認する。選択後の値が `Unsplit` のまま変化しないことを確認する。
4. disabled Split option を hover / focus し、tooltip または補助説明に **`not supported`** が表示されることを確認する。
5. 通常の `Unsplit` のまま tile を作成し、ブラウザの Network panel で `POST /v1/schedule-definitions` の request を確認する。Split payload（`split_policy.kind=1`）が送信されないことを確認する。
6. 作成結果が成功し、server response が 400/422 ではないことを確認する。特に UI が server validation error を silently swallow して成功表示する状態でないことを確認する。
7. 既存の web checks を実行する。
   ```bash
   bun run typecheck
   bun run test:unit
   git diff --check
   ```
   期待結果: exit code 0。unit test を追加した場合は Split option disabled / tooltip assertion が PASS する。

## リスク

- **server 422 の silent swallow**: 親仕様の server validation rejection は 400 とされているが、実装・proxy・client の層によって 422 に変換される可能性がある。UI がエラーを握りつぶして成功 toast を表示すると、Split の不正 wire payload が見えなくなる。そのため acceptance は「Split を UI から unreachable」に置き、Network panel で `kind=1` の送信が無いことを必ず確認する。
- **disabled option の実装差**: native select、Mantine selector、custom radio では disabled と tooltip の実現方法が異なる。selector の既存 component contract を壊さず、disabled state が実際に操作を遮断する方法を選ぶ。
- **翻訳キーの増加**: 本計画の固定表示文言は `not supported`。既存 i18n の規約が selector に必須なら、既存の未対応文言キーを再利用し、新規翻訳体系や広範な文言変更はしない。
- **C4a との境界**: min/max/max_segments の入力、単位変換、wire serialization、server validation の詳細は C4a 再開時に扱う。C4b で仮の `0` や空値を送る実装を追加してはならない。

## 関連

- `C:\Users\rebui\Desktop\tastile\tile-create-e2e-wiring\04-sub-projects\C-recurring-source.md` — C の親仕様。`split_policy.kind` は wired、segment fields は partial。
- `C:\Users\rebui\Desktop\tastile\tastile-core\crates-v1\domain\src\source_schedule.rs:110-118` — `SplitPolicy` と `min_segment_ms` / `max_segment_ms` / `max_segments` の定義。
- `C:\Users\rebui\Desktop\tastile\tile-create-e2e-wiring\04-plans\G1a-wslc-image-build.md` — plan の 8-section 構成テンプレート。
- C4a — Split segment fields の UI / wire mapping を再開する前提となる依存計画。
- `C:\Users\rebui\Desktop\tastile\tile-create-e2e-wiring\05-impl-order.md` — 実装順序。C4b は C4a に依存する延期項目。
