# E1b — recurring.condition affordance 維持（disabled）

## メタデータ

- **ID**: E1b
- **Phase**: 3（Condition tree）
- **Target repo**: `tastile-web`
- **Sub-project parent**: E（Condition tree）
- **Depends on**: A, C, G, H; E1a の現状確認
- **Source spec**: `04-sub-projects/E-condition-tree.md:8-24`
- **Sibling plans**: E2a, E3b, E3c, E6a, E6b

## 前提

- `recurring.condition` は `quick-create-store.ts` に存在するが、wire payload に slot がなく、`quick-create-schedule-wire.ts:213-450` が参照しないため silent drop になる（`02-ui-coverage-audit.md:68-70,146-148`）。
- この計画では affordance を削除せず、AST editor の実装前であることを明示する disabled UI にする。親仕様の Phase 1 e2e では AST editor は Phase 4 に延期する（`E-condition-tree.md:8-24`）。
- 新規の `condition` wire slot や core Rust の変更は行わない。

## 目的

ユーザーが `recurring.condition` の存在を認識でき、入力できない理由も理解できる状態にする。未対応フィールドを送信時に誤って編集可能に見せないことで、silent drop の誤解を防ぐ。

## 受入条件

- `recurring.condition` のラベル／説明は UI に残る（`quick-create-store.ts` の状態契約と一致）。
- affordance は disabled で、クリック・キーボード操作・入力変更が発生しない。
- disabled 理由として tooltip に正確に `Condition editor ships in Phase 4` を表示する。
- submit payload に condition を追加せず、既存の default QuickCreate submit は回帰しない。
- キーボード操作とスクリーンリーダーで disabled 状態が判別できる。

## 実装手順

1. `tastile-web/src/features/create-tile/ui/` で `recurring.condition` の描画箇所を特定し、`QuickCreate.tsx`／該当 sub-panel の file:line を固定する。
2. 既存の tooltip primitive と disabled control のパターンを同じ UI ディレクトリ内で確認し、既存のアクセシビリティ属性を再利用する。
3. 条件 affordance の control を disabled にし、ラベルまたは wrapper に `Condition editor ships in Phase 4` の tooltip を付ける。
4. disabled control の click/change handler が store mutation を呼ばないことを確認し、不要な新規 wire slot・serializer は追加しない。
5. 既存 UI テストに、表示・disabled 属性・tooltip 文言・操作不能を検証する最小テストを追加する。
6. 差分を確認し、E1b の UI とテスト以外のファイルを変更していないことを確認する。

## 検証手順

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun test -- <condition-affordance-test-file>
bun run lint
```

Playwright またはブラウザで QuickCreate を開き、recurring.condition の affordance にフォーカス／hover する。期待値は disabled 表示、tooltip の完全一致文言、store state 不変である。submit payload の確認では `quick-create-schedule-wire.ts:213-450` に condition の出力がないことを差分で確認する。

## リスク

- Tooltip は disabled native element では発火しない UI 実装があるため、必要なら disabled wrapper に tooltip を付ける。ただし wrapper 自体を操作可能にしない。
- 既存 `ConditionEditor.tsx` を誤って有効化すると Phase 4 の scope を先取りする。`E-condition-tree.md:18-24` の editor 方針を超えない。
- `recurring.condition` の silent drop 自体は解消しない。これは意図した延期であり、受入条件に明記する。

## 関連

- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md:8-24,46-61`
- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/02-ui-coverage-audit.md:68-70,86,146-148`
- `C:/Users/rebui/Desktop/tastile/tile-create-e2e-wiring/05-impl-order.md:43-45,52-54`
- 実装対象: `C:/Users/rebui/Desktop/tastile/tastile-web/src/features/create-tile/ui/`
