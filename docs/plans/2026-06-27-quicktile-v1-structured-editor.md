# QuickTileCreate v1 構造エディタ化

> **2026-06-27**。v1 era (2026-06-24〜) の UI 正本。
> 旧 v7 QuickTileCreate を、v1 仕様書群 (v1/02, v1/03, v1/04, v1/05, v1/08, v1/13, v1/14) に直接対応する **4 Aggregate 構造エディタ** へ再構成する。
> 旧プラン `2026-06-24-quicktile-redesign-impl.md` の Form 系コンポーネントは **そのまま流用** する。設計判断を変えたくない。

---

## 背景 (なぜ今やるか)

ユーザー指摘: 「**コントロール不足・不対応で使えない**」。現状の QuickTileCreate.tsx は v7 仕様由来の状態を 30+ 個保持し、`useQuickCreateStore` を **完全に無視** している。v1 仕様書には存在しない `objectiveMode: "finish_once" | "recurring" | "maximize_within_interval"` / `doneRule: "manual" | "time_reached" | "interval_end"` / `interruptPenalty` / `resumePenalty` / `externalInterruptOnly` / `promptOnStart` / `promptOnEnd` / `autoStartAllowed` / `autoEndAllowed` などの **v7 語彙が残存**。

v1 の正本は「v7 フィールドを v1 フィールドに swap する」ことではなく、**4 Aggregate + Window + Completion ツリー** を構造的に編集する **構造エディタ** である。本プランはそれを具体化する。

---

## ゴール

QuickTileCreate を 7 セクションの構造エディタへ再構成する。各セクションは v1 仕様章と 1:1 対応する。`useQuickCreateStore` を単一の正本とする。submit は store 直読みで v1 envelope を生成する。

---

## 7 セクション構成 (v1 章との対応)

```
┌──────────────────────────────────────────────────┐
│ QuickTileCreate (構造エディタ)                    │
│                                                  │
│ §1 Identity (v1/02 §Tile.Base)                   │
│   ├─ Title                                       │
│   ├─ Kind [ RECURRING | PLACEMENT | EXECUTION ]  │
│   ├─ Visual (color + icon picker)                │
│   └─ External ID (任意)                          │
│                                                  │
│ §2 Plan (v1/02 §Plan + v1/13 §Completion)        │
│   ├─ Role [ EXECUTABLE | LABEL ]                 │
│   ├─ Completion.root (Condition tree stub)       │
│   ├─ Completion.timeRequirements[] (stub)        │
│   ├─ Completion.tasks[] (stub)                   │
│   ├─ References[] (stub)                         │
│   ├─ Planning.placementRules[] (stub)            │
│   ├─ Planning.nestingRules[] (stub)              │
│   ├─ Planning.flows[] (stub)                     │
│   ├─ Metrics[] (stub)                            │
│   └─ Decisions[] (stub)                          │
│                                                  │
│ §3 Time (v1/03 §Span §Range)                     │
│   ├─ Span (start Instant + end Instant | null)   │
│   └─ Duration Range (min DurationMs + max | null)│
│                                                  │
│ §4 Windows (v1/03 §Window)                       │
│   └─ Window[] (stub — count + add/remove only)   │
│                                                  │
│ §5 Recurring (v1/08) — kind=RECURRING 時のみ表示  │
│   ├─ Life.active (DateRange)                     │
│   ├─ Life.state [ ACTIVE | PAUSED | ENDED | ... ]│
│   ├─ frames[] (FrameRule stub)                   │
│   └─ rules[] (RecurringRule stub)                │
│                                                  │
│ §6 Advanced (v1/04 ChangeSet layer)              │
│   ├─ changeSets[] (stub)                         │
│   └─ rules[] (stub)                              │
│                                                  │
│ §7 Meta                                          │
│   ├─ project                                     │
│   ├─ tags[]                                      │
│   └─ memo                                        │
│                                                  │
│ [Submit] ─→ POST /v1/tiles (CREATE_TILE)         │
│           ─→ POST /v1/tiles/{id}/plan (SET_PLAN) │
│           ─→ POST /v1/recurrings/{id}/frames     │
│           ─→ POST /v1/recurrings/{id}/rules      │
└──────────────────────────────────────────────────┘
```

各セクションは **常時展開** (sub-panel navigation 廃止)。1 パネルに縦スクロール。

---

## stub の方針

Phase B (Condition AST) / Phase C (Metric/Flow) が未着手の tastile-core のため、以下は **stub 表示**: 「0 件」「条件 0 件」「タスク 0 件」「Flow 0 件」など件数バッジのみ。Phase B/C 実装時に正式エディタへ置換する前提。

stubs (Phase B/C で本実装に置換される):

- Plan.completion.root (Condition tree editor)
- Plan.completion.timeRequirements[] (TimeObservation + Range editor)
- Plan.completion.tasks[] (TaskDefinition editor)
- Windows[] (kind + bounds + rules editor)
- Recurring.frames[] (StepGenerator / ReferenceGenerator / CalendarGenerator / TransformGenerator editor)
- Recurring.rules[] (RecurringRule editor)
- Planning.placementRules[] (PlacementRule editor)
- Planning.nestingRules[] (NestingRule editor)
- Planning.flows[] (Flow editor)
- Plan.metrics[] (Metric editor)
- Plan.decisions[] (Decision editor)
- Plan.references[] (Reference editor)
- Advanced.changeSets[] (ChangeRule editor)

実装 (Phase A 範囲): Identity / Plan.role / Time / Recurring.life / Meta。

---

## 触るファイル

| Path | 変更 |
| --- | --- |
| `src/components/tiles/QuickTileCreate.tsx` | **全面書き換え** (~1180 行 → ~600 行想定) |
| `src/components/tiles/submit-v1.ts` | `formStateToSnapshot` を廃止し `storeStateToSnapshot` に置換 |
| `src/components/tiles/sub-panels/QuickTileRecurrenceSubPanel.tsx` | **削除** |
| `src/components/tiles/sub-panels/QuickTileInterruptSubPanel.tsx` | **削除** (v1 に interruptPenalty なし) |
| `src/components/tiles/sub-panels/QuickTileAutomationSubPanel.tsx` | **削除** (v1 に automation switches なし) |
| `src/components/tiles/sub-panels/QuickTileMetaSubPanel.tsx` | **削除** (Meta はインライン化) |
| `src/components/tiles/sub-panels/SubPanelHeader.tsx` | **削除** (sub-panel navigation 廃止) |
| `src/lib/stores/quick-create-store.ts` | Plan.decisions[], Advanced.changeSets[], Advanced.rules[] を `unknown[]` のまま保持 (型は v1 形を維持、stub では件数表示のみ) |
| `src/components/tiles/build-command.ts` | 旧ヘルパー (parseDurationToMinutes 等) はそのまま残す。QuickCreateFormState 型は submit-v1.ts 側で削除 |

---

## 触らないファイル

- `src/lib/domain/v1/*` — 既に v1 形 (interfaces only)
- `src/lib/api/v1-endpoints.ts` — submit-v1.ts の I/O 先
- `src/lib/daemon/id-token-client.ts` — 認証
- `src/components/ui/form/*` — 2026-06-24 プランで作成済み (FormPanel/FormRow/RowInput/RowSegmented/RowToggle/RowSubPanel)
- `src/app/globals.css` — スペーシングトークン既存

---

## 不変条件への影響

- v1/10 §2 (数値定数のみ): **強化**。TileKind / PlanRole / RecurringState / WindowKind を `lib/domain/v1/constants.ts` の数値定数経由で参照
- v1/10 §4 (JSONB 禁止): 影響なし
- v1/10 §5 (ChangeSet 競合): 影響なし
- v1/10 §6 (Execution は Placement から): 影響なし (本タスクは CREATE_TILE のみ)
- v1/10 §7 (完了状態は派生値): **強化**。doneRule 列挙 (manual/time_reached/interval_end) を削除。`Plan.completion.root` は Condition ツリーが正本で、本プランでは ALL(children=[]) を placeholder として送る

---

## 受け入れ条件

1. **build が通る**: `bun run typecheck` / `bun run lint` クリーン
2. **テスト通過**: 既存テスト全件 PASS (本タスクでテスト追加はしない、リファクタのため)
3. **POST /v1/tiles 発火**: chrome-devtools で QuickTileCreate を開き、submit すると POST /v1/tiles → 200 で `tileId` を含むレスポンスが返る
4. **envelope 検証**: Network パネルで送られた payload が v1 形 (kind: 数値, role: 数値, span: ISO, completion.root.kind: 0)
5. **v7 語彙の混入ゼロ**: `objectiveMode` / `doneRule` / `interruptPenalty` / `resumePenalty` / `externalInterruptOnly` / `promptOnStart` / `promptOnEnd` / `autoStartAllowed` / `autoEndAllowed` の文字列/識別子がコードベースに存在しない (`grep` で確認)
6. **store 直読み**: `useQuickCreateStore` の各 slice がコンポーネントで読み書きされ、`formState` という v7 中間型が消えている

---

## フェーズ分割

1. Phase 1: 構造スケルトン — 7 セクションの空 shell + §7 Meta (project/tags/memo) のみ実装。submit は現状維持
2. Phase 2: §1 Identity — kind / title / visual / externalId
3. Phase 3: §2 Plan — role のみ (completion 各種は stub)
4. Phase 4: §3 Time — span + durationMinMax
5. Phase 5: §5 Recurring.life — kind=RECURRING のときだけ表示
6. Phase 6: stub UI (§2 の references/metrics/decisions、§4 windows、§5 frames/rules、§6 advanced)
7. Phase 7: submit-v1.ts 書き換え (formState → store 直読み)
8. Phase 8: 旧 v7 SubPanel 4 ファイル + SubPanelHeader.tsx 削除
9. Phase 9: verify (typecheck / lint / browser / POST 確認)

各 Phase は 1 commit (`feat(v1): <phase>` または `chore(v1): <phase>` または `refactor(v1): <phase>`)。

---

## スコープ外

- Condition ツリーの本実装エディタ → tastile-core Phase B 待ち
- TimeObservation / TaskDefinition / FrameRule / WindowRule / PlacementRule / Metric / Decision / Reference / ChangeRule / ChangeSet の本実装エディタ → 同上
- 旧 v7 ファイル (`src/lib/domain/tile.ts`, `src/lib/core/*` の v7 形、`src/lib/storage/event-store.ts` 等) の完全撤去 → 別プラン
- tauri / desktop integration → 別プラン
- chrome-devtools 自動 E2E → Phase H (別プラン)

---

## ロールバック

1 commit 単位で revert 可能。Phase 8 (旧ファイル削除) のみ `git revert` で復活。

---

## Gap-fill (2026-06-27 v2) — Phase A なのに stub だった項目を本実装

ユーザー指摘「アクセス不能項目が多過ぎる / v1を確認してないだろ」への対応。

`tastile-core/v1/HARNESS.md` の Phase A 範囲を読み直したところ、当初 stub として Phase B/C に回していた **4 項目** は本来 **Phase A スコープ** だった。v1 章ごとに具体形まで落として本実装に置換した。

### 1. Tile.Base.visual (v1/02 §Tile.Base)

当初: `Visual (color + icon picker)` を Phase 2 で実装するとしていたが、UI 上は色のみ・アイコンは固定の不完全状態。

修正: §1 Identity に **色 (hex) + アイコン (lucide-react name) のインラインエディタ** を実装。`normalizeHexColor` ヘルパで `#xxx` / `#xxxxxx` を受け入れ、アイコンは `lucide-react` の代表的セット (Timer / Play / Pause / Check / Coffee / Book / Code / Dumbbell / Music / Briefcase / Heart / Sun / Moon / Star) から select。

該当テスト: §1 (description / visual color / visual icon) 3 件追加。

### 2. Tile.Base.content.description (v1/02 §Tile.Base)

当初: `Title` のみで `description` フィールドが UI に存在しなかった。

修正: §1 Identity に **Description テキストエリア** を Title の直下に追加。任意項目、空文字許容。

該当テスト: §1 (description) 1 件追加。

### 3. Tile.windows[] (v1/03 §Window) — Window は Phase A 範囲

当初: 「Windows[] (stub — count + add/remove only)」と書いて Phase B に回していたが、`v1/HARNESS.md` を読むと **Window は Phase A** に含まれている。

修正: §4 に **WindowRow** サブコンポーネントを実装。
- kind (CALENDAR / LABEL_SPAN / PARENT_SPAN / GAP) の segmented picker
- kind=CALENDAR / GAP のとき `bounds: Span { start, end }` (UTC Instant) を datetime-local で
- kind=LABEL_SPAN / PARENT_SPAN のとき `referenceId: string` を uuidv7 で (新規発行ボタン付き)
- `rules: WindowRule[]` は件数バッジのみ (Phase B/C 待ち)
- Add / Remove ボタン

該当テスト: §4 (Add 表示 / Add で CALENDAR Window 追加 / kind picker で kind 切替 + referenceId 表示 / Remove で削除) 4 件追加。

### 4. Recurring.frames[] (v1/08) — FrameRule 構造は Phase A 範囲

当初: `frames[] (FrameRule stub)` と書いて Phase D に回していたが、`v1/HARNESS.md` の「同一 Frame からの重複生成抑止」は Phase A 範囲。FrameRule の **構造 (id + generator + active)** は Phase A で触れるべき。

修正: §5 に **FrameRulesList + FrameRuleRow + renderGeneratorFields** を実装。
- FrameRule の generator.kind (Step / Reference / Calendar / Transform) を segmented picker
- kind=Step → step (ms) + origin (Moment|null) + bounds (Span|null)
- kind=Reference → referenceId (uuidv7) + align (START/END/CENTER)
- kind=Calendar → unit (DAY/WEEK/MONTH) + weekdayMask (0..127|null) + holidayKind (NOT_HOLIDAY/HOLIDAY/ANY)
- kind=Transform → sourceFrameId (uuidv7) + shift (ms|null) + scale (number|null)
- generator 切替時は `defaultFrameGenerator(kind)` ファクトリで fresh defaults を発行
- `active: ConditionNode|null` は件数バッジのみ (Phase B 待ち)

該当テスト: §5 (Add 表示 / Add で Step FrameRule 追加 / kind picker で generator.kind 切替 / Remove で削除) 4 件追加。

### 影響しない項目 (Phase A 範囲だが既に実装済み)

- Tile.Base.kind (RECURRING/PLACEMENT/EXECUTION) — Phase 2 で実装済み
- Plan.role (EXECUTABLE/LABEL) — Phase 3 で実装済み
- Tile.span / durationMinMax — Phase 4 で実装済み
- Recurring.life (active DateRange + state) — Phase 5 で実装済み

### 影響範囲 (この v2 ギャップフィルのみ)

| Path | 変更 |
| --- | --- |
| `src/components/tiles/QuickTileCreate.tsx` | §1 に description textarea + Visual editor、§4 に WindowRow、§5 に FrameRulesList + FrameRuleRow + renderGeneratorFields を追加 |
| `src/components/tiles/QuickTileCreate.test.tsx` | §1 / §4 / §5 用の 11 テスト追加 (22 → 33) |
| `src/lib/i18n/translations.ts` | visual / description / windows / frame-rule 系の新規キーを ja + en に追加 |
| `docs/plans/2026-06-27-quicktile-v1-structured-editor.md` | 本セクション追加 |

### 検証 (2026-06-27)

- `bunx tsc --noEmit` クリーン
- `bunx eslint` クリーン (QuickTileCreate.tsx / .test.tsx / translations.ts)
- `bunx vitest run src/components/tiles/QuickTileCreate.test.tsx` → **33 passed (33)**

### スコープ外 (引き続き stub のまま)

- `Window.rules: WindowRule[]` の中身エディタ → Phase B/C 待ち
- `FrameRule.active: ConditionNode|null` の中身エディタ → Phase B 待ち
- `Plan.completion.*` / `Plan.references[]` / `Plan.metrics[]` / `Plan.decisions[]` / `Planning.*` / `Advanced.*` → 同上
