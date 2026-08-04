# E6b — Condition scope e2e

## メタデータ

- **ID**: E6b
- **Phase**: 3（Condition tree）
- **Target repo**: `tastile-web`
- **Sub-project parent**: E
- **Depends on**: E2a, E6a, G, H, A, C
- **Source spec**: `tastile-core/v1/05-condition-and-reference.md`
- **Sibling plans**: E3c

## 前提

- ユーザー指定のシナリオは QuickCreate の `recurring.condition = Reference(other_tile)` である。
- ただし現行 wire には recurring.condition slot がなく silent drop であり（`02-ui-coverage-audit.md:68-70,146-148`）、E1b はこれを Phase 4 まで disabled にする計画である。
- よって E6b は、E6a で core/web の attach point と wire 拡張が実装済みであることを前提に実施する。E1b のみが完了した状態では test を green と報告しない。
- e2e は Docker ではなく G の wslc Postgres/API と H の bridge auth を利用する（`02-ui-coverage-audit.md:159-170`）。

## 目的

QuickCreate で別 Tile を指す Reference condition を送信し、atomic publish 後に `v1_recurring.condition` の reference pointer が保存されることを、実データで証明する。

## 受入条件

- test が先に target `other_tile` を作成し、その canonical tile ID または typed pointer を取得する。
- QuickCreate の source tile で `recurring.condition` を Reference(other_tile) に設定できる。
- submit が 2xx で完了し、source の recurring ID を特定できる。
- `v1_recurring.condition->>'reference'` に target pointer が存在し、target tile ID と一致する。
- source tile の ID が reference target として誤保存されていない。
- DB 接続不能による skip を成功扱いにしない。実行ログに test passed と 0 failed がある。
- E1b の disabled UI 契約を破らず、未実装時は明確な blocked/precondition failure になる。

## 実装手順

1. `tastile-web/e2e/helpers/v1.ts` の既存 tile 作成・auth・truncate helper を確認し、target Tile を API 経由で作る fixture を選ぶ。直接 SQL insert は target の typed pointer 契約を検証できないため避ける。
2. `e2e/condition-scope.spec.ts` を作り、target tile を作成して ID／kind を保存する。テストデータの title は source と target で明確に分ける。
3. QuickCreate を開き、E6a で定めた accessible control または test id で Reference target を選択する。旧 E1b の disabled state しかない場合は test を skip せず、precondition failure として実装未完を露呈させる。
4. source tile を submit し、response または read endpoint から recurring ID を特定する。ID が response にない場合は owner と unique test title を併用する。
5. wslc Postgres で `v1_recurring` の condition JSON を query し、`condition->>'reference'` を parse する。pointer の target ID／typed kind／scope を field 単位で assertion する。
6. source と target を含む teardown を実行し、FK 順序を守る。既存 truncate helper の Docker command が残っていれば G migration の helper を使う。
7. 実スタックで spec を再実行し、browser action、HTTP response、DB row を確認する。

## 検証手順

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bunx playwright test e2e/condition-scope.spec.ts --workers=1
```

期待値は実 Postgres に source／target の row が作成され、source recurring row の `condition` JSON に reference があり、pointer の target が先に作成した `other_tile` と一致すること。補助確認として `GET /v1/timeline` または既存 editable/read endpoint が source を返すことも確認する。

## リスク

- 現行仕様では `v1_recurring` は legacy read-only、new writes は Source(3) が canonical と記載されている（`01-domain-spec-fields.md:90-100`）。E6b の指定 table が実 migration／endpoint に存在しない場合、推測で別 table に assertion を移さず、core contract の不一致として停止する。
- `condition->>'reference'` が JSON object／array のため、文字列 contains だけでは誤検出する。JSON parse 後に target ID を exact match する。
- target の owner／auth が source と異なると forbidden になる。H の bridge owner provisioning と同一 owner fixture を使う。
- E1b の disabled affordance と E6b の enabled flow は Phase境界が衝突する。実装順を E6a の wire/UI enablement 後に固定する。

## 関連

- `C:/Users/rebui/Desktop/tastile/tastile-core/v1/05-condition-and-reference.md`
- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md:8-24,38-55`
- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/01-domain-spec-fields.md:60-68,90-100,131-149`
- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/02-ui-coverage-audit.md:68-70,115-124,146-170`
- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/05-impl-order.md:41-45,52-61`
- 実装対象: `C:/Users/rebui/Desktop/tastile/tastile-web/e2e/condition-scope.spec.ts`

## 補足

E6b の assertion path はユーザー指定の `v1_recurring.condition->>'reference'` を保持する。実スキーマが canonical SourceTile 側に移行済みなら、E6a／E6b の受入条件を先に core spec と照合して更新し、存在しない列を検証するテストを作らない。
