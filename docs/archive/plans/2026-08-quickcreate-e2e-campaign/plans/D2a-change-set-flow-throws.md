# D2a — ChangeSet / flow throw の empty-array 化

## メタデータ

- **ID**: D2a
- **Phase**: 2 (throw-site resolution)
- **Target repo**: `tastile-web`
- **Sub-project parent**: D (frame-rules)
- **Depends on**: G/H、`D-frame-rules.md` §A/C
- **Source spec**: `tile-create-e2e-wiring/04-sub-projects/D-frame-rules.md:8-12,20-24`
- **Sibling plans**: D1a (FrameRule wire expansion)、D3a (FrameRule E2E)

## 前提

- `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:246-257` は `Plan.planning.changeSets[]`、`Plan.planning.flows[]`、関連する `advanced.rules[]` 等が populated のとき throw する。
- 本計画では ChangeSet と Plan-level legacy flows を wire expansion せず、create path では empty array として扱う。編集用 ChangeSet は `tastile-core/v1/04` および `crates-v1/domain/src/command.rs:212-241` の edit/plan command に残す。
- `source.flowSequences[]` の現行 canonical 経路は変更しない。Plan-level flows の UI は壊さず、作成時の保存対象を empty stub として明示する。
- DB は既存 `v1_change_set` 等を検証するだけで、新 Rust handler は追加しない。

## 目的

QuickCreate の create submit が ChangeSet/Plan-level flow の未対応入力で throw せず、`[]` を送る SQL stub/normalization 経路を明文化する。既存の source flow sequence と default create を壊さず、未対応データを誤って保存したと見せない。

## 受入条件

- `quick-create-schedule-wire.ts:246-257` に ChangeSet/Plan-level flow の throw が残っていない。
- create payload では `changeSets: []` と Plan-level legacy `flows: []` が明示的に生成される。
- `source.flowSequences[]` は従来どおり canonical `flows[]` に保存され、Plan-level flows が混入しない。
- Rust handler、migration、`v1_change_set`/flow 用の新規 insert は追加されない。
- submit 後の SQL で create-path stub が empty であることを確認できる。FrameRule rows は D1a の責務として保存される。
- UI の未対応入力には Phase D/legacy の説明があり、silent data loss に見えない。

## 実装手順

1. `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:246-257` と payload 型定義を読み、ChangeSet、advanced rules、Plan-level flows、source flows の各フィールドを表にする。
2. `tastile-web/src/features/create-tile/ui/QuickCreate.tsx:21-23` と関連 section のラベルを確認し、未対応 create-time fields に「Phase D / edit-mode only」または同等の既存 i18n 文言を付ける。新しい概念的な UI は追加しない。
3. wire builder の failing test を先に追加する。ChangeSet と Plan-level flow を state に入れても builder が throw せず、`changeSets: []` と Plan-level `flows: []` を返すことを assertion する。
4. `quick-create-schedule-wire.ts:246-257` の throw を削除し、create payload の未対応 ChangeSet/Plan-flow slots を空配列に正規化する。`source.flowSequences[]` の map は既存 code のまま保つ。
5. SQL stub を create contract test/helper に記録する。submit 後に `v1_change_set` の tile scope が 0 件であり、Plan-level flow の専用 persistence table/insert が存在しないことを確認する。SQL は検証用であり migration や handler ではない。
6. UI test を更新し、advanced/legacy flow affordance の説明文が表示されることを確認する。未対応配列が populated でも submit button が throw で停止しないことを確認する。
7. typecheck と対象 unit/component test を実行する。D1a の FrameRule payload と同じ builder で merge conflict が出ないことを確認する。

## 検証手順

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun run typecheck
bun test --runInBand <quick-create-schedule-wire-test-path>
bun test --runInBand <quick-create-ui-test-path>
```

wslc の DB が起動している場合、submit の tile id を `<new-tile-id>` に置換して確認する。

```bash
wslc container exec tastile-db psql -U postgres -d tastile -c \
  "SELECT count(*) AS change_sets FROM v1_change_set WHERE tile_id = '<new-tile-id>';"
```

期待値は `change_sets = 0`。Plan-level flows 用の表を新設しないこと、source flow sequence を入力した別 fixture では既存の flow count が維持されることも確認する。Rust の新 handler がないため Rust test は既存 command suite の regression 実行に限定する。

## リスク

- **利用者が入力を保存済みと誤認**: section header/説明に Phase D または edit-mode only を表示し、空配列化を contract としてテストに固定する。
- **source flow まで捨てる**: state namespace を混同しない。`source.flowSequences[]` のみ canonical flows に残し、Plan-level `flows[]` は別途 empty にする。
- **backend が空配列を reject**: payload schema の required/default を確認し、null ではなく既存 contract が受ける `[]` を送る。reject する場合は API contract を先に修正し、handler追加には進まない。
- **D1a との同時変更で builder が不安定**: D1a の frameRules mapper と D2a の stub normalization を別 helper/別 assertion に分ける。
- **既存 local state の未対応配列**: create submit 時だけ no-op とし、store の既存 shape を不要に削除しない。削除が必要なら別 migration/plan に分離する。

## 関連

- `tile-create-e2e-wiring/04-sub-projects/D-frame-rules.md:8-12,20-24,40-50`
- `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:246-257`
- `tastile-web/src/features/create-tile/ui/QuickCreate.tsx:21-23`
- `tastile-web/src/shared/stores/quick-create-store.ts`
- `tastile-core/v1/04-change-sets.md`
- `tastile-core/crates-v1/domain/src/command.rs:212-241`
- `tile-create-e2e-wiring/04-plans/D1a-frame-rule-creation.md`
- `tile-create-e2e-wiring/04-plans/D3a-frame-rule-e2e.md`
