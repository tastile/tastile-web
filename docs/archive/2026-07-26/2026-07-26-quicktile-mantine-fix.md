# QuickTileCreate Mantine 修正計画

## 概要
QuickTileCreate およびサブパネルに残る Mantine 未適用箇所・UX 問題・動作しない UI を体系的に修正する。

## 問題一覧（優先度順）

### P0: 動作しない / 到達不能な UI（6件）

| # | 問題 | 箇所 | 修正方針 |
|---|------|------|----------|
| 1 | 「下書き保存」ボタンに onClick がない | QuickTileCreate L1158 | onClick を追加 or 削除 |
| 2 | Duration「完了時間を反映」Switch に checked/onChange がない | QuickTileCreate L1354 | store と連携 |
| 3 | Duration 分/時 SegmentedControl の value が "min" に固定 | QuickTileCreate L1333 | store と連携 |
| 4 | 行為ボタンが "meta" に遷移、"behavior" パネル到達不能 | QuickTileCreate L980 | "behavior" に修正 |
| 5 | `_handleDelete` が定義されているが未呼び出し | QuickTileCreate L517 | 削除 or 使用 |
| 6 | visual editor の状態があるが UI がない | QuickTileCreate L298 | 未実装なら状態を削除 |

### P1: 生 HTML → Mantine（9箇所）

| # | 現在 | 修正先 | 箇所 |
|---|------|--------|------|
| 7 | `<input type="datetime-local">` ×2 | `DateTimePicker` (@mantine/dates) | SchedulePanel L324-347 |
| 8 | `<input type="date">` ×1 | `DatePickerInput` (@mantine/dates) | AutomationPanel L152 |
| 9 | `<input type="text">` ×6 | `TextInput` (@mantine/core) | ConditionEditor L275,306,343,368,398,417,443 |
| 10 | 時間選択が Select ×4（HH:MM） | `TimeInput` (@mantine/dates) | SchedulePanel L204-258 |

### P2: 不正な Mantine プロパティ（4件）

| # | 問題 | 修正 |
|---|------|------|
| 11 | `variant="primary"`（非標準） | `variant="filled"` に変更 |
| 12 | `size="small"`（非標準） | `size="sm"` に変更 |
| 13 | `size="icon-xs"`（非標準） | `size="compact-xs"` に変更 |
| 14 | `size="compact-xs"`（非標準） | `size="xs"` に変更 |

### P3: スタイル統一（15件）

| # | 問題 | 修正方針 |
|---|------|----------|
| 15 | rounded が 5 種類以上混在 | Mantine radius トークン統一 (`"sm"`, `"md"`, `"lg"`) |
| 16 | ボタン variant/size がサブパネルごとに異なる | 全サブパネルの cancel/apply を `size="sm" variant="default"` / `size="sm" variant="filled"` に統一 |
| 17 | gap/padding が不統一 | 基本 `gap="xs"` / `p="sm"` に統一 |
| 18 | `<hr>` の mb が不統一 | 全て `mb-3` に統一 or Mantine `Divider` 使用 |
| 19 | Intent cards の radius が `radius="md"` vs behavior の `radius="xl"` | 全て `radius="md"` に統一 |
| 20 | 条件カード内の ALL バッジ | Mantine `Badge` に置き換え |

### P4: 日付/時刻 UX 改善（6件）

| # | 問題 | 修正方針 |
|---|------|----------|
| 21 | カレンダーが今月中しか選択できない | `DatePickerInput` はデフォルトで月跨ぎ可能。`MiniCalendar` を確認し修正 |
| 22 | 「今日」「明日」ボタンのスタイルが無地 | Mantine `Button variant="light" size="xs"` に変更 |
| 23 | 時間が HH:MM ドロップダウン | `TimeInput` に置き換え（キーボード入力可能） |
| 24 | 終了時間がネイティブ日付選択 | `DatePickerInput` に置き換え |
| 25 | 時間条件を重ねられない | Window の追加/削除 UI を改善、複数 Window の重ね合わせを明示 |
| 26 | 参照範囲を選択できない | whenMode="reference" のとき Tile ピッカーを表示（Phase B: stub のまま注記） |

### P5: 選択パターン改善（4件）

| # | 問題 | 修正方針 |
|---|------|----------|
| 27 | 曜日ボタンの選択状態が確認しにくい | Mantine `Chip` に変更、selected スタイル明確化 |
| 28 | 「間隔」「条件成立時」の UI がない | AutomationPanel の repeatMode=interval/condition 時にフィールドを表示 |
| 29 | 謎のラジオボタン 1 つ | 確認・削除 |
| 30 | ラウンド過剰で統一感がない | P3 と併せて修正 |

### P6: クリーンアップ（8件）

| # | 問題 | 修正 |
|---|------|------|
| 31 | 未使用 `_allDay` 状態 | 削除 |
| 32 | 未使用 `_intentPickerOpen` 状態 | 削除 |
| 33 | 未使用 `_editingTileId` | 削除 |
| 34 | 未使用 `_recurrence` | 削除 |
| 35 | 未使用 `_advanced` | 削除 |
| 36 | 未使用 `_actorSubjectId` | 削除 |
| 37 | 未使用 `_PRESET_COLORS` | 削除 |
| 38 | 未使用 `_AVAILABLE_ICONS` | 削除 |

### P7: 硬编码文字列（5件）

| # | 問題 | 修正 |
|---|------|------|
| 39 | `"条件の組み合わせ"` | `t("quickCreate.conditionHeading")` |
| 40 | `"編集"` ×2 | `t("quickCreate.edit")` |
| 41 | `"作成できます"` | `t("quickCreate.footerHint")` |
| 42 | `"下書き保存"` | `t("quickCreate.draftSave")` |

---

## 実装順序

### Step 1: P0 動作修正
- 未使用 state 削除
- 死ボタン修正
- behavior パネル到達不能修正

### Step 2: P1 生 HTML → Mantine
- SchedulePanel: DateTimePicker
- AutomationPanel: DatePickerInput
- ConditionEditor: TextInput
- SchedulePanel: TimeInput（Select ×4 → TimeInput ×2）

### Step 3: P2 プロパティ修正
- variant="primary" → "filled"
- size="small" → "sm"
- size="icon-xs" → "compact-xs"
- size="compact-xs" → "xs"

### Step 4: P3 スタイル統一
- rounded 統一
- ボタン variant/size 統一
- gap/padding 統一
- Divider 統一

### Step 5: P4 日付/時刻 UX
- MiniCalendar の月跨ぎ修正
- 今日/明日ボタン スタイル修正
- TimeInput 適用
- 終了日 DatePickerInput

### Step 6: P5 選択パターン
- 曜日 → Mantine Chip
- 間隔/条件成立時 UI
- 謎ラジオ削除

### Step 7: P6+P7 クリーンアップ
- 未使用 state 削除
- 硬コード文字列 → i18n

---

## 影響範囲

| ファイル | 変更内容 |
|----------|----------|
| `src/components/tiles/QuickTileCreate.tsx` | P0, P2, P3, P6, P7 |
| `src/components/tiles/editor/SchedulePanel.tsx` | P1(7,10), P3, P4 |
| `src/components/tiles/editor/AutomationPanel.tsx` | P1(8), P5(27,28), P4(24) |
| `src/components/tiles/editor/ConditionEditor.tsx` | P1(9) |

## 検証

- `bun run typecheck` エラーなし
- `bun run lint` エラーなし
- ブラウザで動作確認（Chrome DevTools 未接続のため手動確認）
