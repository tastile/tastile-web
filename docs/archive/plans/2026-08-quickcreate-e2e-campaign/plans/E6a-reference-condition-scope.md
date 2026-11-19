# E6a — Reference condition scope

## メタデータ

- **ID**: E6a
- **Phase**: 3（Condition tree）
- **Target repo**: `tastile-web`（core contract を参照）
- **Sub-project parent**: E
- **Depends on**: E2a, A, C, G, H
- **Source spec**: `tastile-core/v1/05-condition-and-reference.md`
- **Sibling plans**: E6b

## 前提

- `Reference` は別の Tile／Plan を指す typed pointer であり、その Condition は target の state に対して評価される（`v1/05-condition-and-reference.md`）。
- Plan の `references[]` は `01-domain-spec-fields.md:29-34`、wire の `references` と `reference_targets` は `02-ui-coverage-audit.md:115-124` にある。
- Condition は target tile 自体の identity を直接埋め込むのではなく、既存 Reference の target binding と一貫する必要がある。
- `Reference` の pick/scope 詳細は別スコープ（`E-condition-tree.md:46-48`）だが、Condition がどこに attach するかは E6 の e2e に必要な最小契約だけ定義する。

## 目的

Reference condition の attach point、pointer の表現、評価 scope を web 型・store・wire の境界で明文化し、`recurring.condition` または completion Condition のどちらに置くかを曖昧にしない。

## 受入条件

- Reference condition の target は既存 `references[]`／`reference_targets[]` の typed pointer と同一の ID／kind 契約を使う。
- Condition AST の Term として Reference を表せる（E2a の 10 Term kinds と整合）。
- serialization は `v1/05` と `condition.rs` の externally tagged shape を維持し、target pointer を generic JSON や独自 enum に落とさない。
- scope が文書化される。すなわち Condition は pointer の target Tile／Plan の state を評価し、現在編集中の source tile の state と混同しない。
- completion root と recurring condition の attach point を分けて扱う。後者は E1b の disabled Phase 4 affordanceを尊重し、未対応の UI submit を有効化しない。
- unit test で target kind、pointer、scope metadata の serialization を固定する。

## 実装手順

1. `tastile-core/v1/05-condition-and-reference.md` の Reference 定義、target kind、pick／when／scope に関する行を確認し、`condition.rs` と `command.rs` の実 wire field を照合する。
2. `tastile-web` の `references[]` store 型、Reference editor、`reference_targets` builder を特定し、既存 ID の source of truth を一つに決める。
3. E2a の Reference Term variant に target pointer と必要な scope/evaluation field を追加または接続する。未定義 field は作らない。
4. Condition serializer／wire builder の completion attach point を実装し、Reference Term が target pointer と共に payload へ出ることを unit test で確認する。
5. `recurring.condition` は E1b の disabled state のままにし、scope 定義だけを shared type／コメントで再利用可能にする。
6. target Tile／Plan の kind mismatch、missing target、source tile を誤って参照するケースの validation test を追加する。
7. typecheck と対象 unit test を実行し、core spec と差分をレビューする。

## 検証手順

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun test -- <reference-condition-test-file>
bun run typecheck
```

fixture は target Tile pointer と target Plan pointer を各 1 件用意する。期待値は completion condition payload に typed reference が保持され、source tile の ID を暗黙に代入しないこと。実際の endpoint e2e は E6b で行う。

## リスク

- `Reference` の typed pointer と Condition Term の reference ID を別 ID と誤認すると、core の target 解決が失敗する。
- Reference の full editor（EXACT/SERIES/FILTER/CONTEXT、pick variants）は scope 外であり、E6a で実装を広げない（`E-condition-tree.md:46-48`）。
- recurring.condition は現時点で wire slot がなく、E6a で silent drop を wire 拡張に変えてはいけない。

## 関連

- `C:/Users/rebui/Desktop/tastile/tastile-core/v1/05-condition-and-reference.md`
- `C:/Users/rebui/Desktop/tastile/tastile-core/crates-v1/domain/src/condition.rs`
- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/01-domain-spec-fields.md:29-34,60-65`
- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/02-ui-coverage-audit.md:51-57,115-124,146-148`
- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md:18-24,46-55`
- 実装対象: `C:/Users/rebui/Desktop/tastile/tastile-web/src/features/create-tile/`

## 補足

Reference の attach point に関して spec と現行 payload が食い違う場合、最終決定は `tastile-core/v1/05-condition-and-reference.md` と Rust source に従い、plan 実行中に勝手な fallback を追加しない。
