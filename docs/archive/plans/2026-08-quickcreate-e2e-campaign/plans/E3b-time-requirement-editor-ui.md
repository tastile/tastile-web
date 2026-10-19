# E3b — TimeRequirement editor UI

## メタデータ

- **ID**: E3b
- **Phase**: 3（Condition tree）
- **Target repo**: `tastile-web`
- **Sub-project parent**: E
- **Depends on**: E2a, A, C, G, H
- **Source spec**: `tastile-core/v1/13-completion.md:16-22,49-93`
- **Sibling plans**: E3c, E6a, E6b

## 前提

- QuickCreate の completion は `plan.completion.{root,timeRequirements,tasks}` として wire 済み（`02-ui-coverage-audit.md:51-54`）。
- 現状は default `{required: 30-90min}` に縮退しており、editor がない（`E-condition-tree.md:26-32`）。
- 本計画の UI 契約はユーザー指定どおり `minMinutes`, `maxMinutes`, `kind`。core の詳細な observation（scope/source/aggregate/quantifier）は別計画で拡張し、ここで勝手に追加しない。
- `CompletionSubPanel` の実位置・行番号は実装開始時に検索し、計画記載の既存契約（`02-ui-coverage-audit.md:86`）に合わせる。

## 目的

`CompletionSubPanel` 内に 0-N 件の TimeRequirement を編集できる sub-form を追加し、各行の最小分数・最大分数・種別を store の `plan.completion.timeRequirements` に保持する。

## 受入条件

- Add／remove で TimeRequirement 行を 0-N 件管理できる。
- 各行に `minMinutes` number、`maxMinutes` number、`kind` select（`DURATION | DEADLINE | RANGE`）がある。
- min/max は finite、非負、min ≤ max を UI validation する。
- 既存 `durationMinMax` と wire の `required_duration_ms` 整合性を壊さない（`quick-create-schedule-wire.ts:263-268`）。
- 編集中の値は store と同期し、再 render で失われない。
- inputs/select に label、名前、keyboard 操作、エラー表示がある。
- default QuickCreate と既存 completion root/task の表示・submit が回帰しない。

## 実装手順

1. `tastile-web/src/features/create-tile/ui/CompletionSubPanel.tsx` と store の completion slice を読み、既存の row/add/remove パターンを特定する。
2. `TimeRequirement` の web-facing shape を E2a の型・既存 wire 型に合わせて確定する。minutes と wire milliseconds の変換境界を一箇所に置く。
3. `TimeRequirementEditor`（既存命名規約に従う）を作り、`minMinutes`、`maxMinutes`、`kind` の controlled controls を実装する。
4. `CompletionSubPanel` に editor を組み込み、追加・削除 callback を store action に接続する。
5. min/max validation と kind の許可値 validation を追加し、invalid state では submit をブロックする既存フォーム契約に接続する。
6. UI unit test を追加する。初期表示、追加、編集、削除、validation、kind 切替を検証する。
7. typecheck と対象テストを実行し、wire builder がこの shape を期待する field に変換することを確認する。

## 検証手順

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun test -- <completion-sub-panel-test-file>
bun run typecheck
```

ブラウザで QuickCreate を開き、Completion を展開して 2 行を追加し、値を入力して再開閉する。期待値は値が保持され、invalid range にエラーが出て submit できないこと。valid 値では `buildQuickCreateSchedulePayload` の completion time requirements に対応する値が出ることを unit test でも確認する。

## リスク

- core の `TimeRequirement` は本来 observation が必須（`v1/13:60-92`）。この小計画の UI shape が wire の必須 default と衝突する場合、既存 default observation を維持し、UI scope を明記する。
- minutes と milliseconds の二重変換で off-by-one／丸めが起きる。変換は整数分のみとし、既存 wire の単位を尊重する。
- `CompletionSubPanel` が fresh object を props に渡す場合、callback の object dependency で render loop を作らない。

## 関連

- `C:/Users/rebui/Desktop/tastile/tastile-core/v1/13-completion.md:16-22,49-93`
- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/01-domain-spec-fields.md:39-48`
- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/02-ui-coverage-audit.md:51-59,86,133-144`
- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md:26-32`
- 実装対象: `C:/Users/rebui/Desktop/tastile/tastile-web/src/features/create-tile/ui/CompletionSubPanel.tsx`
