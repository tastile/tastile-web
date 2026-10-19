# B2b — reference モード (whenMode="reference") 延期

## メタデータ

- **ID**: B2b
- **Phase**: 1
- **Target repo**: `tastile-web`
- **Sub-project parent**: B (§3 Time + §4 Windows)
- **Depends on**: B2a (time section の OneTime / Range / Duration-only 経路が GREEN であること)
- **Source spec**: parent `04-sub-projects/B-time-windows.md` §"リスク" 第 3 項 + §"スコープ外"

## 前提

- B2a 完了済 (`whenMode ∈ {none, day, range}` の経路で `v1_placement.baseline.{start,end}` が確定する)
- core は `v1_placement` の relative-baseline を server-side で解決する想定 (parent §"リスク" 第 3 項)
- form 側の reference picker は `time.referenceId` / `time.referenceLabel` を保持しているが wire 経由で送出されていない (後述「ギャップ」)
- 既存 UI コンポーネント: `tastile-web/src/features/create-tile/ui/SchedulePanel.tsx` の ReferencePicker (`:505-551`), store shape は `quick-create-store.ts:347-348`

## 目的

`time.whenMode === "reference"` 経路を本フェーズでは e2e 化対象から外し、Phase 2 (reference picker 実装後) に送る。代わりに: (1) ギャップを文書化、(2) 未完成状態の UI ガードを 1 本追加する。これにより「reference モードを選ぶ → 何も起きない / 黙って 422」を「reference モードを選ぶ → submit ボタンが無効化 / エラー表示」で封じる。

## 受入条件

1. **本計画ファイルが存在し、B サブプロジェクトの §"リスク" 第 3 項 + §"スコープ外" を根拠に「reference モード e2e は Phase 2 送り」と明記している**。
2. **UI ガード (placeholder) が追加されている**: `whenMode="reference"` かつ `referenceId === null` のとき、QuickCreate の Submit ボタンが `disabled`、もしくはインライン alert が出る。Vitest ケース 1 本が green。
3. **B2a 経路は不変**: B2a で追加したテスト・実装に手を入れない。

## 実装手順

1. **ギャップの文書化 (本ファイル)**: §"目的" + §"リスク" + §"関連" に、現状ワイヤが `referenceId` を送出しない事実を `quick-create-schedule-wire.ts:213-450` の該当ブロックへの file:line 付きで書き残す。`buildQuickCreateSchedulePayload` は `authoredInstant()` (`:47-64`) で `time.span[boundary]` しか読まない。`state.time.referenceId` を参照する経路は wire 内に存在しない。
2. **Placeholder ガードの追加先選定**:
   - 候補 A: `quick-create-store.ts` の `canSubmit()` selector (store 終端で一元ガード)。推奨。
   - 候補 B: `SchedulePanel.tsx:505-551` の ReferencePicker 内に inset する local guard。スコープが狭いが QuickCreate 側 Submit を制御するには props バケツリレーが必要。
   - 候補 C: `QuickCreate.tsx` の submit handler 内で同期チェック。重複になりがち。
   → **A を採用**: store 中心に 1 行追加し、UI からは `state.canSubmit` を読むだけにする。
3. **store 側の追加 (placeholder)**:
   ```ts
   // tastile-web/src/shared/stores/quick-create-store.ts:347 付近
   // QuickCreateState.time 型は既存 (referenceId: string | null, referenceLabel: string)
   // canSubmit() の末尾に以下を足す:
   if (state.time.whenMode === "reference" && state.time.referenceId === null) {
     return { ok: false, reason: "reference-mode-needs-target" };
   }
   ```
   正確な selector 名と return shape は `quick-create-store.ts` の既存実装を尊重して合わせる (`e.g. tasksForSubmission` パターン)。新規ファイルは作らない。
4. **Vitest ケース追加**:
   - 配置: `tastile-web/src/shared/stores/quick-create-store.test.ts` (無ければ新規。ただし CLAUDE.md「NEVER create files unless absolutely necessary」に従い、隣接テストファイルがあればそこに追加)。
   - ケース名: `"whenMode=reference without referenceId blocks canSubmit"`。
   - アサート: `canSubmit().ok === false`、かつ reason が `"reference-mode-needs-target"` を含む。
   - 対称ケースとして `"whenMode=reference with referenceId passes canSubmit"` を 1 本追加 (referenceId 文字列は固定の UUID v7 文字列で十分)。
5. **UI 側 surface**:
   - `QuickCreate.tsx` の Submit ボタンの `disabled={!canSubmit().ok}` を既存実装に合わせる。
   - `cannot submit` の上に `t("quickCreate.referenceModeNeedsTarget")` のアラートを 1 行出す。キー追加は `translations-quick-create.ts` へ (`referenceModeNeedsTarget: "基準タイルを選択してください"` の意で 1 行)。
6. **本計画書 §"リスク" に silent 422 を書き残す** (下記)。

## 検証手順

```bash
# 1. 既存 B2a 経路が回帰していないこと
cd tastile-web && bun test src/shared/stores/quick-create-store.test.ts
# 期待: 既存ケース全 GREEN + 今回追加 2 ケースも GREEN

# 2. リポジトリ全体を走らせて他テストへの影響確認
cd tastile-web && bun test
# 期待: 既存 GREEN を維持

# 3. manual probe (実機 / ダッシュボード)
# - QuickCreate を起動 → Time セクションで "基準 (reference)" を選ぶ
# - reference picker を開かずに Submit を試す
# - 期待: Submit ボタン disabled、または "基準タイルを選択してください" の alert
# - reference picker で何か 1 件選んで再度 Submit
# - 期待: ボタン活性 (Phase 2 で core に接続されるまで submit 自体は e2e 対象外)
```

## リスク

- **Silent 422 (延期理由そのもの)**: 現状 `whenMode="reference"` 経路は wire (`quick-create-schedule-wire.ts:213-450`) が `time.referenceId` を body に含めず、`authoredInstant()` (`:47-64`) も `time.span[boundary]` からのみ読む。core が UUID 必須で 422 を返す前提 (parent §"リスク" 第 3 項) に立つと、未完成状態で submit を押してもローカル UI では成功扱いに見える可能性がある。本計画はそれを「submit を押せなくする」ことで一次封じる。
- **Placeholder の保守忘れ**: Phase 2 で reference picker が実装され、core 側 resolve が整ったあと、本ガードを削除しないと「reference モードなのに referenceId 必須」という古い不変条件を UI が握り続ける。Phase 2 開始時の TODO に「B2b guard の撤去 (`quick-create-store.ts` の reference-mode-needs-target 分岐 + `translations-quick-create.ts` の `referenceModeNeedsTarget` キー)」を入れる。
- **CanSubmit 拡張の副作用**: store 中心に 1 行足すだけだが、Phase 3+ で別フィールドの依存が増えると selector が肥大化する。`canSubmit` を pure function に保つことを次フェーズでも維持する。
- **i18n キー追加**: 1 言語ぶん追加するが、多言語 (en / ja 以外) への展開は Phase 1 では行わない。未翻訳キーは fallback で英語が出る。`translations-quick-create.ts` を編集する以上、隣接言語資源を壊さないこと。
- **Vitest セットアップの前提差**: `quick-create-store.test.ts` の既存 import パターン (vitest vs jest) を確認し、`it` / `describe` の命名と matcher を既存踏襲。差異があればファイル冒頭の vitest 設定コメントを参照。

## 関連

- Source spec: `tile-create-e2e-wiring/04-sub-projects/B-time-windows.md` (本計画の親)
- Sibling plan: `tile-create-e2e-wiring/04-plans/B2a-time-windows-wired.md` (依存先)
- Implementation order: `tile-create-e2e-wiring/05-impl-order.md`
- Wire 実装: `tastile-web/src/shared/api/v1/quick-create-schedule-wire.ts:213-450` (`buildQuickCreateSchedulePayload`, `referenceId` 送出なし)
- Store shape: `tastile-web/src/shared/stores/quick-create-store.ts:347-348` (`referenceId: string | null`, `referenceLabel: string`)
- UI picker: `tastile-web/src/features/create-tile/ui/SchedulePanel.tsx:505-551` (ReferencePicker、参考)
- Phase 2 pickup TODO: `tile-create-e2e-wiring/04-plans/B2b-reference-mode-deferred.md` の "Placeholder の保守忘れ" を Phase 2 開始時に解消
