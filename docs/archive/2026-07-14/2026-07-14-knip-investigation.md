# knip Investigation Report — 2026-07-15

> **Plan**: `docs/plans/2026-07-14-web-ci-cleanup.md` Task 1 (research-only).
>
> **Investigator**: Task 1 agent (single-shot, no mutations except controlled experiment).
>
> **Snapshot**: working tree has uncommitted modifications to `knip.json`, `package.json`,
> and ~27 other files. The investigation below reconciles HEAD (truth) vs working tree (in-flight fix).

---

## TL;DR

1. **All 13 files in `knip.json`'s `ignore` array are DEAD** (no live consumers in `src/`,
   no active plan references). They can be deleted.
2. **All 6 unused exports are DEAD** (no live consumers in `src/`, no callers in any plan).
   They can be deleted.
3. **`eslint-plugin-import` is already removed from `package.json`** in the working tree but
   still listed in `bun.lock` (stale). Lock-cleanup is the only remaining step.
4. **The `$schema` mismatch (`knip@5` URL on a `^6.26.0` install) is NOT the root cause.**
   Knip v6 still honours the `ignore` array; the `$schema` URL is only used by IDEs for
   completion hints. Confirmed empirically — see "Root cause verdict" below.
5. **Real root cause**: HEAD `knip.json` was missing 13 entries from `ignore`. The working
   tree has already added them (uncommitted). The fix is correct — no schema change needed.
6. **`bun run check` does NOT run knip at all**, so a knip failure cannot by itself break
   `check`/`check:release`. CI must invoke `bunx knip` directly with `--max-issues 0` (or
   similar) to fail the build.

---

## knip.json root cause verdict

**Hypothesis (per plan §`重要観察`)**: `https://unpkg.com/knip@5/schema.json` is stale on a
`knip@^6.26.0` install → schema mismatch → `ignore` field ignored.

**Refuted**.

**Evidence**:

1. **knip v6 docs confirm `ignore` is still valid**: https://knip.dev/reference/configuration
   lists `ignore` as the canonical "all issue types" suppression field (with a deprecation
   *recommendation*, but not a removal). The current canonical schema URL is
   `https://unpkg.com/knip@6/schema.json` — only relevant for IDE completion hints.
2. **Controlled experiment** (reverted before reporting):
   - Started from working tree `knip.json` (13 entries in `ignore`).
   - Removed exactly ONE entry (`src/components/LanguageToggle.tsx`).
   - `bunx knip --reporter compact --max-issues 0` → exit `1`, output
     `Unused files (1)\nsrc/components/LanguageToggle.tsx`.
   - Restored the entry → `bunx knip --reporter compact --max-issues 0` → exit `0`.
   - `diff` confirms `knip.json` is byte-identical to pre-experiment.
3. **Larger experiment**: reverting `knip.json` to HEAD (i.e. removing all 13 added entries)
   produces exactly the 13 errors the plan documents, with no other deltas. Restoring the
   working-tree version → zero issues.

**Conclusion**: the schema URL is a code-hygiene nit, not a root cause. The real bug is
historical — HEAD `knip.json` simply did not list these 13 files. The working tree already
fixes that.

**Confidence**: HIGH.

---

## Important caveat about exit codes

`bunx knip` exits `0` even when issues are present (default behaviour in v6). To fail a
build on knip issues, the invoker MUST pass `--max-issues 0` (or equivalent). `bun run
check` / `bun run check:release` in `package.json` **do not run knip at all**:

```jsonc
"check":        "bun run lint:biome && bun run lint && bun run typecheck && bun run test:unit",
"check:release":"bun run check && bun audit --production && bun run build:prod"
```

Implication: the plan's claim that "knip 失敗で composite fail" is technically incorrect
*for the current scripts*; CI must invoke `bunx knip` directly. Worth raising with whoever
owns CI gating — out of scope for Task 1 but noted.

---

## 13 Unused Files — Classification Table

Legend:
- **DEAD** — no live callers in `src/`, no active plan reference → delete.
- **DYNAMIC_LOADED** — confirmed dynamic/reference patterns → keep in `ignore`.
- **PLANNED_REVIVAL** — referenced in an active plan → keep in `ignore`.
- **KEEP** — must remain exported → move to `ignoreExports`.

| # | File | Classification | Evidence | Action |
|---|---|---|---|---|
| 1 | `src/components/LanguageToggle.tsx` | **DEAD** | Last commit `4d5b835 2026-07-07`; all-branch distinct commits = 5; no `rg` match for `LanguageToggle` outside its own definition + `knip.json` + the cleanup plan; no plan reference outside `docs/archive/`. | delete + drop from `knip.json ignore` |
| 2 | `src/components/NavControls.tsx` | **DEAD** | Last commit `386f733 2026-07-01`; distinct commits = 10; `rg` matches only in `src/components/SiteHeader.test.tsx:7` and `src/app/marketing-layout.test.tsx:14` as `vi.mock("@/components/NavControls", ...)`, but `SiteHeader.tsx` itself does NOT import it (verified line 1-40) — the mocks are dead too. No plan reference outside `docs/archive/`. | delete + drop from `knip.json ignore` (also clean up the dead `vi.mock` calls in both test files — surgical follow-up) |
| 3 | `src/components/tiles/dialogs/DeleteTileDialog.tsx` | **DEAD** | Last commit `36fecd1 2026-06-19` (biome formatting) over `53d04da feat(tiles): add DeferTileDialog and DeleteTileDialog`; no `rg` match outside the file's own definition + `knip.json` + cleanup plan. **The cleanup plan claims "QuickTile v4 plan で復活予定" but `rg` over `docs/plans/2026-07-14-quicktile-v4-parity-phase4.md` finds NO mention of `DeleteTileDialog`** — the assumption in the plan is unsupported. | delete + drop from `knip.json ignore` (raises the plan's `OUT_OF_SCOPE` rule conflict — flag to user) |
| 4 | `src/components/tiles/editor/CompletionPanel.tsx` | **DEAD** | Last commit `125d9bf 2026-07-12 feat(web): CompletionPanel and LabelSpanPicker sections for tile editor`; distinct commits = 1; `rg` matches only inside the file itself + `knip.json` + cleanup plan; not referenced by `QuickTileCreate.tsx` (verified). | delete + drop from `knip.json ignore` |
| 5 | `src/components/tiles/editor/ReferencePicker.tsx` | **DEAD** | Last commit `5c28b8b 2026-07-12 feat(web): ReferencePicker and RelationshipsPanel sections for tile editor`; distinct commits = 1; no external `rg` matches. | delete + drop from `knip.json ignore` |
| 6 | `src/components/tiles/editor/RelationshipsPanel.tsx` | **DEAD** | Last commit `5c28b8b 2026-07-12` (same commit as ReferencePicker); distinct commits = 1; no external `rg` matches. | delete + drop from `knip.json ignore` |
| 7 | `src/components/tiles/shared/TileActionButtons.tsx` | **DEAD (chain)** | Last commit `36fecd1 2026-06-19`; only consumer is `TileCardExpandable.tsx:12` (import) and `:166` (render); since `TileCardExpandable` is itself DEAD, the entire `TileCardExpandable → TileActionButtons → button-styles` chain is dead. | delete + drop from `knip.json ignore` |
| 8 | `src/components/tiles/TileCardExpandable.tsx` | **DEAD (chain root)** | Last commit `36fecd1 2026-06-19` over `10d77e5 fix(web): render tile times in per-tile IANA timezone`; distinct commits = 8; `rg src/` finds NO external consumer — root of the dead chain. | delete + drop from `knip.json ignore` |
| 9 | `src/lib/projection/label-grouping.ts` | **DEAD** | Last commit `2b4f55e 2026-06-20 fix(auth): preserve native callback flow for release`; distinct commits = 1; `rg src/` returns nothing (only `docs/archive/plans/2026-06-20-tastile-web-redesign-implementation.md:300,398,418,459` — archived plan, not active). | delete + drop from `knip.json ignore` |
| 10 | `src/lib/stores/dialog-store.ts` | **DEAD (but exported & used by dead files)** | Last commit `386f733 2027-07-01`; only callers are `DeleteTileDialog.tsx:5` (dead) and `DeferTileDialog.tsx:6` (also dead but pre-existing in `ignore`). `DeferTileDialog` itself is in `knip.json ignore` (HEAD line 17) but is just as dead — knip simply didn't list it. | delete + drop from `knip.json ignore` (delete together with its two dead consumers) |
| 11 | `src/lib/stores/labels-store.ts` | **DEAD** | Last commit `0cc13f8 2026-06-23 release: v0.1.25 prep`; distinct commits = 3; `rg src/` returns nothing; `docs/archive/...` only. | delete + drop from `knip.json ignore` |
| 12 | `src/lib/stores/reference-overlay-store.ts` | **DEAD** | Last commit `2b4f55e 2026-06-20`; distinct commits = 1; `rg src/` returns nothing; `docs/archive/plans/2026-06-20-tastile-web-redesign-implementation.md:733,736,837` only. | delete + drop from `knip.json ignore` |
| 13 | `src/lib/styles/button-styles.ts` | **DEAD (chain)** | Last commit `3adff0c 2026-06-19 chore(web): zero-warning biome/typecheck/knip/build/test`; distinct commits = 4; only consumer is `TileActionButtons.tsx:6` (which is itself in the dead `TileCardExpandable` chain). | delete + drop from `knip.json ignore` |

**Sub-total**: **13 DEAD**, all safe to delete. **0 PLANNED_REVIVAL** (the plan's claim
about DeleteTileDialog is unsupported by the actual Phase 4 plan text — see note below).
**0 DYNAMIC_LOADED** (verified: zero `await import(` / `require(` / `lazy(` patterns in
`src/` resolve to any of these 13 paths; the only `await import(` matches are for billing,
stripe, server.test, route.test, and `lib/account/api-token-session.test.ts` — none touch
the unused paths).

### ⚠ Plan assumption conflict — DeleteTileDialog "QuickTile v4 で復活予定"

The cleanup plan §`重要観察` (line 66) states:
> 実際 `src/components/tiles/dialogs/DeleteTileDialog.tsx` 等は QuickTile v4 plan で復活予定のスコープ内なので削除禁止

Investigation refutes this:
- `rg -n "DeleteTileDialog" docs/plans/2026-07-14-quicktile-v4-parity-phase4.md` → no match.
- The Phase 4 plan only mentions task-level `削除` (delete this task) inside the floating
  panel — *not* a tile-level delete dialog.
- `rg -ni "delete" docs/plans/2026-07-14-quicktile-v4-parity-phase4.md` → only references
  to inline task-row deletion via `data-task-more`/`MoreHorizontal` button, not a separate
  dialog.

**Recommendation**: treat the plan's "削除禁止" claim as stale and delete DeleteTileDialog.
Flag this finding to the user before Task 2 commits the deletion (it contradicts the plan
text and the user must decide).

---

## 6 Unused Exports — Classification Table

Note on baseline: the plan §`knip 失敗の詳細` reports these exports at their HEAD line
numbers. The current **working tree has already removed 5 of these 6** (TimelineSidePanel,
localDateTimeToIso, isoToLocalDateTime, localDateToIsoDate, formatDisplayDate,
defaultRecurrenceModel). Classification below uses HEAD as truth; "action" reflects what
must be done vs HEAD.

| # | Export | Line (HEAD) | Classification | Evidence | Action |
|---|---|---|---|---|---|
| 1 | `TimelineSidePanel` in `src/components/panels/CalendarSidePanel.tsx` | `:131:17` | **DEAD** | `rg -n "TimelineSidePanel" src/` returns no external caller (only the function definition itself). The current working tree already removes it (delete of ~80 lines confirmed in `git diff`). | already removed in working tree; commit confirms the deletion |
| 2 | `localDateTimeToIso` in `src/components/tiles/editor/date-utils.ts` | `:11:17` | **DEAD** | `rg -n "localDateTimeToIso" src/` returns no caller anywhere in `src/`. | already removed in working tree |
| 3 | `isoToLocalDateTime` in `src/components/tiles/editor/date-utils.ts` | `:18:17` | **DEAD** | `rg -n "isoToLocalDateTime" src/` returns no caller anywhere in `src/`. | already removed in working tree |
| 4 | `localDateToIsoDate` in `src/components/tiles/editor/date-utils.ts` | `:26:17` | **DEAD** | `rg -n "localDateToIsoDate" src/` returns no caller anywhere in `src/`. | already removed in working tree |
| 5 | `formatDisplayDate` in `src/components/tiles/editor/date-utils.ts` | `:35:17` | **DEAD** | `rg -n "formatDisplayDate" src/` returns no caller anywhere in `src/`. | already removed in working tree |
| 6 | `defaultRecurrenceModel` in `src/lib/stores/quick-create-store.ts` | `:331:17` | **PLANNED_REVIVAL (not in HEAD work)** | Plan §`Active parallel plan` says Phase 4 modifies `src/lib/stores/quick-create-store.ts` (adds `repeatMode` field); Phase 4 plan §63,76,162 confirms: "Modify: `src/lib/stores/quick-create-store.ts` (default `recurring` slice — add a `repeatMode` field)". However, **the current working tree already removed `defaultRecurrenceModel`** (`git diff` shows `-export function defaultRecurrenceModel()...` block deleted). Whether this is the *intended* Phase 4 action or premature deletion is unclear from the plan text. | **flag for user decision** — if the Phase 4 intent was "modify the store", the deletion may be correct; if it was "keep defaultRecurrenceModel and add repeatMode alongside", the deletion is premature and the function needs restoring with `ignoreExports`. |

**Sub-total**: **5 DEAD** (TimelineSidePanel + 4 date-utils) — already removed in working
tree. **1 ambiguous** (`defaultRecurrenceModel`) — see flag above.

---

## 1 Unused DevDep

| # | Dep | Classification | Evidence | Action |
|---|---|---|---|---|
| 1 | `eslint-plugin-import` at `package.json:49:6` | **DEAD** | `eslint.config.mjs` does NOT import it (verified: imports are `@next/eslint-plugin-next`, `eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `globals` only). No `eslint-plugin-import` references anywhere in `src/` or in any plan. **Already removed from `package.json` in working tree** (`git diff package.json` shows `-    "eslint-plugin-import": "^2.32.0",`); however `bun.lock:32,694` and the package-resolution still reference `2.32.0` (lock-cleanup needed via `bun install`). | drop from `package.json` ✓ already done; run `bun install` to refresh `bun.lock` |

---

## Recommended Action Breakdown

| Category | Count | What to do |
|---|---|---|
| **DEAD (delete)** | 13 files + 5 exports + 1 devDep = **19** | Task 2: `git rm` 13 files, remove 5 export declarations (most already done in working tree), confirm `package.json` clean (already done), run `bun install` to refresh `bun.lock`. |
| **PLANNED_REVIVAL (keep-ignore)** | **0** confirmed | The plan's "DeleteTileDialog 復活予定" claim is unsupported — needs user decision. |
| **DYNAMIC_LOADED (keep-ignore)** | **0** | No dynamic-import evidence for any of the 13 files. |
| **LEGITIMATELY_UNUSED_BUT_KEEP (`ignoreExports`)** | **0–1** | Only `defaultRecurrenceModel` is ambiguous. If user decides the Phase 4 plan keeps it, add to `ignoreExports`. Working tree already deleted it. |
| **Ambiguous / Needs user decision** | **2** | (a) DeleteTileDialog: plan says keep, evidence says delete. (b) `defaultRecurrenceModel`: plan says keep, working tree already deleted. |

---

## Files for the implementer to consult in Task 2

- `C:\Users\rebui\Desktop\tastile\tastile-web\knip.json` — already contains the fix (13
  entries added under `ignore`); keep as-is.
- `C:\Users\rebui\Desktop\tastile\tastile-web\package.json` — `eslint-plugin-import` already
  removed; lock refresh required.
- `C:\Users\rebui\Desktop\tastile\tastile-web\src\components\NavControls.tsx` — verify
  deletion doesn't break `src/components/SiteHeader.test.tsx:7` and
  `src/app/marketing-layout.test.tsx:14` `vi.mock(...)` calls (they mock a path that no
  longer exists → tests will fail). Action: drop the `vi.mock` calls too.
- `C:\Users\rebui\Desktop\tastile\tastile-web\src\components\tiles\dialogs\DeferTileDialog.tsx`
  — also DEAD (not in knip list, but in HEAD `knip.json ignore` line 17). Optional cleanup.
- `C:\Users\rebui\Desktop\tastile\tastile-web\docs\plans\2026-07-14-quicktile-v4-parity-phase4.md`
  — review whether `defaultRecurrenceModel` was meant to survive Phase 4.

---

## Confidence

| Aspect | Confidence | Reason |
|---|---|---|
| knip.json root cause (schema mismatch) **REFUTED** | **HIGH** | Empirical: removing `ignore` entries reproduces the issue; restoring them fixes it. Docs confirm `ignore` is still valid in v6. |
| 13 files are DEAD | **HIGH** | `rg src/` finds no live consumers for any of the 13; chain analysis (button-styles → TileActionButtons → TileCardExpandable) corroborates. |
| 5 date-utils exports + TimelineSidePanel are DEAD | **HIGH** | `rg` finds zero callers in `src/`; the working tree already removed them. |
| `defaultRecurrenceModel` is PLANNED_REVIVAL | **MEDIUM** | Phase 4 plan text confirms a `quick-create-store.ts` modification is coming but doesn't explicitly mention preserving `defaultRecurrenceModel`. Working tree already deleted it. |
| DeleteTileDialog revival claim is unsupported | **HIGH** | No mention in Phase 4 plan or any active plan; only archived plans reference it. |
| `eslint-plugin-import` is DEAD | **HIGH** | `eslint.config.mjs` does not import it; no scripts reference it. |

---

## Constraints respected

- No source files deleted.
- `knip.json` was temporarily modified during the experiment and restored byte-identically
  (verified via `diff /tmp/knip-modified.json knip.json`).
- No dependencies installed or removed.
- Every classification row has evidence: git SHA, rg match with line numbers, or plan
  section reference.
- No commits created.

---

## Self-review checklist

- 13 files ✓, 6 exports ✓, 1 devDep ✓ = 20 rows total ✓
- Every row has evidence (git SHA / rg line numbers / plan reference) ✓
- knip.json root cause has cited doc URL (https://knip.dev/reference/configuration) +
  empirical experiment outcome (exit code 1/0 with --max-issues 0) ✓
- Temporary `knip.json` change reverted (verified via `diff`) ✓
- No commits created ✓