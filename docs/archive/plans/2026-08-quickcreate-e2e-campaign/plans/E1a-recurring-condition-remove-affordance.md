# E1a — recurring.condition UI affordance removal

## メタデータ

- **ID**: E1a
- **Phase**: 3
- **Target repo**: `tastile-web`
- **Sub-project parent**: E
- **Depends on**: A, B, C, D
- **Source spec**: `04-sub-projects/E-condition-tree.md` §2

## 前提

- UI coverage audit の `02-ui-coverage-audit.md:71,149` は、`recurring.condition` が UI で編集可能である一方、publish payload に対応スロットがなく submit 時に silent drop されると記録している。
- `src/shared/stores/quick-create-store.ts:97-112,450-461` は `recurring.condition: ConditionNode | null` を保持し、初期値を `null` にしている。
- `src/features/create-tile/ui/SourceGenerationPanel.tsx:295-333` は condition mode で条件の追加・削除・編集 UI を表示する。
- `src/shared/api/v1/quick-create-schedule-wire.ts:213-216` の `buildQuickCreateSchedulePayload` には `recurring.condition` の transport slot がなく、Phase C/D までは wire 拡張を行わない。
- Option A を採用し、Condition AST の wire 対応や core API の変更は本計画のスコープ外とする。

## 目的

`recurring.condition` をユーザーが編集できないようにし、既存・開発用の in-memory state に非 null 値が残っている場合は、store の ignored flag と wire の警告によって silent drop を可視化する。payload shape は変更せず、submit の成功経路を維持する。

## 受入条件

- `src/features/create-tile/ui/SourceGenerationPanel.tsx:295-333` の `recurring.condition` 追加・削除・編集 affordance が非表示または disabled となり、ユーザー操作では値を変更できない。
- `recurring.condition` が non-null の state を `buildQuickCreateSchedulePayload` に渡すと、`console.warn("[Phase C/D reserved] recurring.condition ignored")` が記録され、store-level ignored flag も `true` になって dev tools から確認できる。
- 警告対象 state でも payload 構築と submit は例外なく継続し、既存の schedule publish が成功する。

## 実装手順

1. `src/shared/stores/quick-create-store.ts:97-112` の `RecurringSlice` に、transport 対象外であることを明示する boolean flag（例: `conditionIgnored`）を追加する。`recurring.condition` 自体は既存 state や hydration の検出用に残し、削除しない。
2. `src/shared/stores/quick-create-store.ts:450-461` の `defaultRecurring()` で ignored flag を `false` に初期化し、reset 後も同じ初期値になることを保証する。
3. `src/shared/stores/quick-create-store.ts:544-557,591` の field update 経路に、`recurring.condition` が non-null に設定された場合は ignored flag を `true`、`null` に戻された場合は `false` に同期する最小処理を追加する。これにより Zustand devtools / store inspection で reserved field の存在を確認可能にする。
4. `src/features/create-tile/ui/SourceGenerationPanel.tsx:198,295-333` から condition editor affordance（追加、削除、`ConditionEditor` による編集）を非表示にする。condition repeat mode 自体を既存 generation mode として残す場合でも、`recurring.condition` を操作するコントロールは描画しない。不要になった `ConditionEditor`、`ConditionKind`、`defaultTerm` 等の import は、この変更で未使用になったものだけ除去する。
5. `src/shared/api/v1/quick-create-schedule-wire.ts:213-216` の `buildQuickCreateSchedulePayload` 冒頭で `state.recurring.condition !== null` を検出し、正確に `console.warn("[Phase C/D reserved] recurring.condition ignored")` を一度記録する。warn 後は throw せず、既存 payload 構築へ進む。
6. `src/features/create-tile/ui/SourceGenerationPanel.test.tsx:7-77` に condition mode を描画するテストを追加し、「繰り返し条件を追加」「条件を外す」および condition editor が存在せず、`setField("recurring.condition", ...)` を起動できないことを確認する。
7. store の既存テストファイルで、`setField("recurring.condition", node)` が ignored flag を `true` にし、`setField("recurring.condition", null)` と reset が `false` に戻すテストを追加する。該当テストがなければ `src/shared/stores/quick-create-store.test.ts` の既存 suite に追記する。
8. `src/shared/api/v1/quick-create-schedule-wire.test.ts:220-229` の condition mode test に、non-null `recurring.condition`、`vi.spyOn(console, "warn")`、payload 構築成功、正確な warning 文字列、既存 `generation.kind === 2` を同時に確認するケースを追加する。テスト後は spy を restore し、他テストへ漏らさない。

## 検証手順

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web

# 1. 対象 unit tests
bun test src/features/create-tile/ui/SourceGenerationPanel.test.tsx
bun test src/shared/stores/quick-create-store.test.ts
bun test src/shared/api/v1/quick-create-schedule-wire.test.ts
# 期待: 対象 test がすべて PASS

# 2. 回帰確認
bun run lint
# 期待: unused import を含む新規 lint error なし
```

Manual probe:

1. `bun dev` で web を起動し、QuickCreate の recurring/source generation panel を開く。
2. condition mode を選択しても `recurring.condition` の追加・削除・編集コントロールが表示されず、ユーザー編集できないことを確認する。
3. Browser devtools から store の `recurring.condition` にテスト用 non-null ConditionNode を設定し、ignored flag が `true` と表示されることを確認する。
4. DevTools Console を開いた状態で submit し、`[Phase C/D reserved] recurring.condition ignored` が一度記録されることを確認する。
5. Network panel で schedule publish request が送信され、成功 response を返すことを確認する。warning は submit を block せず、payload に未対応の condition slot を追加しない。

## リスク

- **in-memory state の silent drop は継続する**: UI affordance を除去しても、hydration、devtools、旧 state などから non-null `recurring.condition` が入る可能性は残る。今回は ignored flag と `console.warn` で可視化するだけで、Phase C/D の wire slot 実装までは値を transport しない。
- **flag 同期漏れ**: `setField` を通らない直接 hydration がある場合、ignored flag が condition の実値とずれる可能性がある。既存 hydration 経路を確認し、non-null condition を代入する箇所では同じ同期規則を適用する。
- **warn の重複**: payload builder が submit 中に複数回呼ばれると呼び出しごとに warn される。グローバルな抑制 state は追加せず、1 payload build あたり一度に限定する。

## 関連

- Parent spec: `tile-create-e2e-wiring/04-sub-projects/E-condition-tree.md` §2
- UI coverage audit: `tile-create-e2e-wiring/02-ui-coverage-audit.md` §5 (`:71,149`)
- Store: `tastile-web/src/shared/stores/quick-create-store.ts:97-112,450-461`
- UI affordance: `tastile-web/src/features/create-tile/ui/SourceGenerationPanel.tsx:295-333`
- Wire builder: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:213-216`
- Wire test: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.test.ts:220-229`
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
