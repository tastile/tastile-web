# B — §3 Time + §4 Windows

## 目的

§3 Time セクションの入力（`time.span.*`、`time.durationMinMax`、`time.whenMode`、補助フィールド）が `Placement.baseline.{start,end}` として `v1_placement` 行に到達すること、§4 Windows の `windows[]` 配列が `v1_window` 行として永続化されることを e2e で証明する。現状ワイヤは両方とも ✓ 済みなので、本サブプロジェクトの主作業は **e2e 化 + 行レベルの観測**。

## 対象フィールド

| Field | Store path | Wire path | Status |
|---|---|---|---|
| `Placement.baseline.start` | `time.span.start` | `source_horizon.start` + `baseline.start` | ✓ wired |
| `Placement.baseline.end` | `time.span.end` | `source_horizon.end` + `baseline.end` | ✓ wired |
| `SourceSchedule.generation.at` | `time.span.start` (OneTime) | `source_schedule.generation.at` | ✓ wired (`schedule-definition.ts:91-115`) |
| `SourceSchedule.required_duration_ms` | `time.durationMinMax.{min,max}` | `source_schedule.required_duration_ms` | ✓ wired (throws at `:263-268` if no matching timeRequirement) |
| `Window.kind` | `windows[].kind` | `windows[].kind` (`WindowKindCode`) | ✓ wired (`quick-create-schedule-wire.ts:141-189`) |
| `Window.bounds.{start,end}` | `windows[].bounds.*` | `windows[].bounds.*` | ✓ wired |
| `Window.rules[]` | `windows[].rules[]` | `windows[].rules[]` | ✓ wired |
| `Window.referenceId` | `windows[].referenceId` | `windows[].referenceId` | ✓ wired (only when kind requires it) |
| `time.whenMode` (none/day/range/reference) | `time.whenMode` | drives `authoredInstant()` at `wire:374-410` | ✓ wired |
| `time.referenceId / referenceLabel` | `time.reference*` | partial — used to compute absolute start when `whenMode="reference"` | ⚠ partial |

## 変更手順

1. **OneTime（whenMode=none, span set）**: 既定経路。`time.span.start` → `generation.at`、`time.span.end` → baseline.end。確認: `v1_placement.baseline_start` / `baseline_end` が core 側で両方 NON-NULL。
2. **Range（whenMode=range）**: 同上の挙動。`source_horizon.start/end` も同値で書き込みされるはず（`schedule-definition.ts:91-115`）。
3. **Duration-only（span 空、durationMinMax のみ）**: `source_schedule` 全体が null になる経路 (`02-ui-coverage-audit.md:96`)。core の horizon フォールバックに依存 — 確認: 起動直後に `v1_placement` 行が作成されるか、または明示エラーが返るか。
4. **Reference モード**: `time.referenceId` が指す tile の placement に対する相対指定。現状 UI は reference label しか持たない — 実行時解決は server-side。確認: core が 422 を返さず、placement が生成されるか。
5. **Windows array**: `publishWindows()` 内の per-window validation (`:144-180`) を満たすこと。`bounds.{start,end}` が ISO 文字列、`rules[]` が time-format チェックを通過することを確認。
6. **Submit → DB 観測**: e2e で QuickCreate を送信 → `wslc container exec tastile-db psql` で `SELECT baseline_start, baseline_end, baseline_inside IS NULL FROM v1_placement ORDER BY id DESC LIMIT 1` を実行。
7. **Validation throws の確認**: `quick-create-schedule-wire.ts:263-268` の "duration range must be represented by a completion time requirement" が、duration 入力時に timeRequirements が空だと発火することを確認（これは wire-builder のセーフガードで、修正不要）。

## e2e 検証

`e2e/quick-tile-create-e2e.spec.ts` を改修:

- テスト名 `default-state QuickCreate persists a placement row`。
- 起動条件: G サブプロジェクトで `wslc up-v1.sh` 済み + `e2e/helpers/v1.ts` の TRUNCATE が `v1_tile, v1_annotation` を含む状態。
- 手順: ダッシュボードを開く → QuickCreate を起動 → タイトル入力 → 時間を設定（ケース別: OneTime / Range / Duration-only） → Submit。
- 検証: 成功トースト → `wslc container exec tastile-db psql -U tastile -d tastile_db -c "SELECT id, baseline_start, baseline_end FROM v1_placement ORDER BY id DESC LIMIT 1"` → 行が 1 件あり、`baseline_start` が UI 入力と一致。
- Windows ケース: §4 を 1 件追加 → `SELECT id, kind, bounds_start, bounds_end FROM v1_window` → 1 件追加されたことを確認。

## スコープ外

- `Placement.baseline.inside`（親 placement picker）— UI 無し。
- `Placement.life.detach / life.close` — UI 無し。
- Condition-driven placement（`FrameRule.active` Condition の動的評価）— サブプロジェクト E。
- Window discriminator を構造化（現状 generic Window）。

## リスク

- **Duration-only モード**: `source_schedule` が null になり、core 側 horizon フォールバックが placement を生成する保証がない。`v1_placement` 行が作成されない可能性 — その場合は本サブプロジェクトで「Duration-only はサポート対象外」と明示し、span 必須を要件化。
- **Windows 検証の硬さ**: `:144-180` の bounds / kind-specific references / rule time format 検証が UI の入力を弾く可能性。UI 側で同等のバリデーションを入れるか、wire-builder 検証を緩める判断が必要。
- **`time.referenceId` 解決**: UI には label のみ — core が UUID を期待する場合 422。reference モードの e2e は Phase 2 で保留推奨。