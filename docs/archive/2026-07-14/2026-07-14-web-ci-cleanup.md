# tastile-web CI Cleanup — `bun run check` / `bun run build` を 0 warnings / 0 errors に

> **Goal**: `tastile-web` の biome / tsc / eslint / knip / next build / vitest を全てエラー・警告ゼロで成功させる。
>
> **Scope**: `tastile-web` のみ (ユーザー指示 2026-07-14)。
>
> **Out of scope**: `tastile-core` (Rust), `tastile-android` (Kotlin), `tastile-desktop` (.NET), `tastile-brands` (assets) — biome / tsc / knip ツールチェーンを持たない。QuickTile v4 parity Phase 4 プラン (進行中) はこのプランと並行 — `quick-create-store.ts` への変更は Phase 4 側で担当する。

---

## Baseline (2026-07-14 実行)

| Tool | State | Detail |
|---|---|---|
| `bun run lint:biome` | ✅ | 284 files / 0 errors |
| `bun run typecheck` (tsc --noEmit) | ✅ | 0 errors |
| `bun run lint` (eslint) | ✅ | 0 errors / 0 warnings |
| `bun run build` (next build) | ✅ | 64 routes, 5.2s compile |
| `bun run test:unit` (vitest) | ✅ | 360 / 360 passed (7.5s) |
| `bunx knip` | ❌ | 13 unused files + 6 unused exports + 1 unused devDep |
| `bun run check:release` | ❌ | knip 失敗で composite fail |

### knip 失敗の詳細

```
Unused files (13)
  src/components/LanguageToggle.tsx
  src/components/NavControls.tsx
  src/components/tiles/dialogs/DeleteTileDialog.tsx
  src/components/tiles/editor/CompletionPanel.tsx
  src/components/tiles/editor/ReferencePicker.tsx
  src/components/tiles/editor/RelationshipsPanel.tsx
  src/components/tiles/shared/TileActionButtons.tsx
  src/components/tiles/TileCardExpandable.tsx
  src/lib/projection/label-grouping.ts
  src/lib/stores/dialog-store.ts
  src/lib/stores/labels-store.ts
  src/lib/stores/reference-overlay-store.ts
  src/lib/styles/button-styles.ts

Unused exports (6)
  TimelineSidePanel       src/components/panels/CalendarSidePanel.tsx:131:17
  localDateTimeToIso      src/components/tiles/editor/date-utils.ts:11:17
  isoToLocalDateTime      src/components/tiles/editor/date-utils.ts:18:17
  localDateToIsoDate      src/components/tiles/editor/date-utils.ts:26:17
  formatDisplayDate       src/components/tiles/editor/date-utils.ts:35:17
  defaultRecurrenceModel  src/lib/stores/quick-create-store.ts:331:17

Unused devDependencies (1)
  eslint-plugin-import  package.json:49:6
```

### 🚨 重要観察

**13 unused files は 全て既に `knip.json` の `ignore` 配列に列挙されている。**
なのに knip v6.26.0 が warn し続けている。`knip.json` の先頭は:

```json
{
  "$schema": "https://unpkg.com/knip@5/schema.json",
  ...
```

これは **knip@5 schema を指しているが、installed は `^6.26.0`**。schema バージョン不一致または v6 で `ignore` フィールドのセマンティクスが変化したことが原因の可能性が高い。

→ **この cleanup の本質は「knip.json を v6 正しい形に直す」こと**。13 ファイルを盲目削除する必要はない (実際 `src/components/tiles/dialogs/DeleteTileDialog.tsx` 等は QuickTile v4 plan で復活予定のスコープ内なので削除禁止)。

---

## Tasks

### Task 1 — Investigation (research-only)

**Goal**: 13 files + 6 exports + 1 devDep の各々について分類を確定し、`knip.json` v6 設定ミスの根本原因を特定する。

**For each file / export**:
- `git log --oneline -- <path>` で最終 commit を確認
- "本当に dead か?" を `git log --all --oneline -- <path>` (全ブランチ) でも確認
- 該当ファイル内の dynamic-import / module-eval / string-resolve パターンを grep
- active plans (`tastile-web/docs/plans/*.md`, `docs/plans/*.md`) で言及が無いか確認
- 分類結果:
  - **DEAD**: 全ブランチ履歴 + plans で言及なし → 削除候補
  - **PLANNED_REVIVAL**: Phase 4 plan 等で明示的に再導入予定 → knip ignore に維持
  - **DYNAMIC_LOADED**: 動的参照の証拠あり → knip ignore に維持
  - **LEGITIMATELY_UNUSED_BUT_KEEP**: 設計上 export しておく必要がある (例: 公開 API) → knip ignoreExports に追加

**For `knip.json`**:
- v6 で正しい field 名 / 構造を [`knip` 公式 docs](https://knip.dev/reference/configuration) で確認
- 現行の `"ignore"` 配列が v6 でも効くか検証
  - 仮説: v6 では `ignore` は依然有効だが schema mismatch で validation skip されている可能性
- 検証コマンド: 1 ファイルだけ `ignore` から外して run → knip の挙動確認 (loop で復元)

**For `eslint-plugin-import`**:
- `eslint.config.mjs` で実際に参照しているか確認
- package.json `# eslint-plugin-import not used` 的なコメントが無いか確認

**Deliverable**: Markdown report (`tastile-web/docs/plans/2026-07-14-knip-investigation.md`) に以下を列挙:
```
| File / Export / Dep | Classification | Evidence | Action |
| ... | DEAD / PLANNED_REVIVAL / DYNAMIC_LOADED / KEEP | git log +X / plan ref / grep result | delete | keep-ignore | etc |
```

**Verify**: レポートに 13 + 6 + 1 = 20 行すべて記入済み + 各行に evidence あり。knip.json の root cause が判明している。

---

### Task 2 — Apply changes

**Goal**: Task 1 の classification に基づいて `knip.json` を直し、dead code を削除する。

**Sub-tasks** (1 PR / 1 commit で OK):

1. **`knip.json` を knip v6 正しい形に修正**:
   - `$schema` を正しい v6 URL に更新
   - field 名が v6 で非推奨なら正しい名前に変更 (`ignore` → 例えば `ignoreFiles` かどうか確認)
   - `ignore` 配列の path が v6 の glob パターンに合っているか再確認
2. **dead files 削除** (Task 1 で DEAD と判定されたものだけ):
   - `git rm` で削除
   - 関連する index.ts / barrel export があれば更新
3. **dead exports 削除** (`date-utils.ts` の 5 export と `CalendarSidePanel.tsx` の `TimelineSidePanel`):
   - export 行を削除 (関数本体は呼び出しが無ければ削除)
   - 内部利用が無いことを確認の上で削除
4. **`defaultRecurrenceModel`**: QuickTile v4 plan で `quick-create-store.ts` を modify する → Phase 4 完了までは export を残す。**knip の `ignoreExports` リストに追加** するか未確定 — Task 1 結果に従う
5. **`eslint-plugin-import` devDep 削除**:
   - `bun remove -d eslint-plugin-import`
   - eslint config で参照していないことを確認 (Task 1 で確認済みのはず)

**Verify**:
- `bunx knip` 出力に **Unused files / exports / dependencies が 0 件**
- `git diff` が surgical — 触ったのは `knip.json` + `package.json` + 分類が DEAD だったファイルだけ

---

### Task 3 — All-tools clean state

**Goal**: 6 ツール全部を 0 errors / 0 warnings / 全テスト green で通す。

**Run order** (memory `feedback_no_unverified_pass` 準拠 — 実行 evidence を必ず残す):

1. `bun run lint:biome` → 0
2. `bun run typecheck` → 0
3. `bun run lint` (eslint) → 0 errors / 0 warnings
4. `bunx knip` → 0 unused files / exports / deps
5. `bun run build` (next build) → 64 routes, 警告なし
6. `bun run test:unit` (vitest) → 全 pass
7. `bun run check` (composite: biome + eslint + typecheck + test) → pass

**Critical rule**: `--no-warn` 等のサイレンサーは禁止。warnings が出たら必ず code / config で消す。memory `feedback_no_unverified_pass` に従い、各ステップの実行 evidence (stdout 末尾 + exit code) を記録。

**Verify**:
- 7 コマンド全部 exit code 0
- 大量出力の必要なし — 各コマンドの最終行 + exit code のみ記録
- 追加で `bun run check:release` (`check` + audit + prod build) も pass すれば完璧 (audit エラーが既存なら別途記録)

---

### Task 4 — Final review + merge

**Goal**: 変更を PR-ready にして merge。

**Review steps**:
1. Implementer self-review (差分要約)
2. Spec compliance reviewer (Task 1-3 が plan と一致して完了したか)
3. Code quality reviewer (knip.json 修正が surgical か、削除が安全か)
4. 修正あれば fix → 再 review
5. `superpowers:finishing-a-development-branch` で PR 化

---

## Risks / Rollback

| Risk | Mitigation |
|---|---|
| knip v6 で `ignore` のセマンティクスが変わっていて大量 false-positive | Task 1 で root cause 確定 → Task 2 で surgical fix |
| `quick-create-store.ts` の `defaultRecurrenceModel` を消すと Phase 4 で衝突 | 残し、knip ignoreExports / knip 全件 ignore 系のフィールドに追加 |
| `eslint-plugin-import` 削除で eslint config が壊れる | Task 1 で参照ゼロ確認済みなので安全。delete 後に `bun run lint` で確認 |
| 削除ファイルが実は動的 import されている | Task 1 の grep で dynamic import / module resolver パターンを必ず調査 |

**Rollback**: 1 PR / 1 commit で完結。`git revert <sha>` で完全復元可能。

---

## Definition of done

- [ ] Task 1 レポート完成 (`tastile-web/docs/plans/2026-07-14-knip-investigation.md`)
- [ ] `bun run check` (= biome + eslint + tsc + vitest) exit 0
- [ ] `bunx knip` exit 0、warnings 0
- [ ] `bun run build` exit 0、警告 0
- [ ] 削除したファイルは DEAD 分類のみ、quick-create-store.ts は無傷
- [ ] 1 PR / 1 commit (chore レベル) で main にマージ可能
- [ ] memory `feedback_no_unverified_pass` 準拠 — 全 commands の実行 evidence 記録済み
