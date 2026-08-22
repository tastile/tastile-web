# QuickTileCreate v4 Parity — Phase 4

> **Goal:** Fix four remaining gaps between the v1 QuickTileCreate editor and the
> reference v4 demo (`docs/tastile_tile_creation_panel_demo_v4.html`).

---

## Background

Phases 1–3 brought QuickTileCreate's outer shape, subpanel sliding, and
click-outside-to-close behaviour in line with the v4 reference. Phase 4 closes
the remaining visible gaps surfaced by a manual walkthrough against the demo:

| # | Symptom | Reference (v4) | Current (v1 editor) |
| --- | --- | --- | --- |
| 1 | Subpanel edits are not visible on the main panel | `value-chip.primary` shows `range` / `day` / `reference` immediately after a panel is applied | Time chip stays "未設定" when only one of start/end is set |
| 2 | "繰り返し" row is a stub | Choice tabs `1回 / 毎日 / 毎週 / 間隔 / 条件成立時` + weekday picker + end-date toggle | Shows just `${frameRules.length} ルール` placeholder |
| 3 | 完了するには task rows lack a task-level menu | `data-task-more` triggers floating menu over the panel stack | MoreHorizontal button deletes immediately |
| 4 | Project / Tags chip row is hard to scan | Inline `meta-chip.project` (blue) + `meta-chip.tag` (purple) chips on the title row, choice-tabs inside | Full-width project cards + free-text tag input |

The fix targets are scoped to **`src/components/tiles/QuickTileCreate.tsx`**
plus existing editor panels already mounted by it
(`editor/SchedulePanel.tsx`, `editor/AutomationPanel.tsx`). No store / domain /
API changes; Phase 4 is pure rendering fix-up against an existing reference.

---

## Task 1 — Sync fix for time chip + duration routing bug

**Files:**
- Modify: `src/components/tiles/QuickTileCreate.tsx`
- Modify: `src/components/tiles/editor/SchedulePanel.tsx`

**Behaviour delta:**

1. The main-panel `V4EssentialRow` for time renders a primary chip whenever
   **any** of `time.span.start` / `time.span.end` is set, not only when both
   are set. Single-edge cases render as `start → 未設定` or `未設定 → end`
   using the existing `formatDisplayDate(iso, allDay, locale, t)` helper.
   The `notSet` chip remains the empty state.
2. The duration row's `onClick` opens the `"duration"` panel, not the
   `"time"` panel (existing bug at line 868).
3. `ScheduleRow` writes ISO strings (`localDateTimeToIso(value)`) to the
   store, matching `WindowRow`. Currently it writes the raw
   `<input type="datetime-local">` value, which causes the chip to display
   the picker-format string when the user reopens the editor.

**Verify:**
- Open `/dashboard/timeline`, click "タスクを作成", open the time subpanel,
  set only `start`, close the panel. Main panel chip shows the formatted
  start (no "未設定").
- Open the duration subpanel from the duration row (not the time row).
- Set start time via `ScheduleRow`, reopen the time subpanel — the input
  still reflects the saved value.

---

## Task 2 — Recurring UI matches v4 choice-tab pattern

**Files:**
- Modify: `src/components/tiles/editor/AutomationPanel.tsx`
- Modify: `src/components/tiles/QuickTileCreate.tsx` (chip rendering at line 870 + panel mount at lines 1336-1358)
- Modify: `src/lib/stores/quick-create-store.ts` (default `recurring` slice — add a `repeatMode` field)

**Behaviour delta:**

1. The main-panel recurring chip (line 870) shows the human-readable repeat
   label (`1回 / 毎日 / 毎週 / 間隔 / 条件成立時`) plus weekday badges if
   any are toggled. Empty state stays `未設定`.
2. The recurring subpanel mounts `AutomationPanel` but presents a single
   choice-tab row matching v4 (`1回 / 毎日 / 毎週 / 間隔 / 条件成立時`),
   not the existing 3-tab layout. The sub-tabs `lifecycle / generator /
   window` become collapsible disclosure sections below the choice-tab.
3. Below the choice-tab, v4's weekday picker + end-date toggle + reference
   link row is wired through to the existing `RecurringLifeEditor` /
   `WindowEditor` fields. Store gains a `repeatMode: "once" | "daily" |
   "weekly" | "interval" | "condition"` field that drives the chip label
   and defaults to `"once"`.
4. The frame-rule list is preserved as the "条件成立時" path (collapse
   inside the disclosure, not the primary view).

**Verify:**
- Open the recurring subpanel. Default view is the choice-tab row, not the
  lifecycle/generator/window tabs.
- Pick "毎週", toggle Tuesday + Thursday. Close panel. Main chip shows
  `毎週 (火, 木)`.
- Pick "条件成立時" — frame-rule list becomes visible.
- Pick "1回" — frame-rule list collapses again.

---

## Task 3 — Completion task 3-dot menu opens a floating panel

**Files:**
- Modify: `src/components/tiles/QuickTileCreate.tsx` (task rows at lines 909-939 + new task-action panel)

**Behaviour delta:**

1. The `MoreHorizontal` button on each task row no longer deletes inline.
   Instead it pushes a new floating sub-panel
   (`data-subpanel="taskAction"` with `taskIndex: i`) containing:
   - 削除 (delete this task)
   - 複製 (duplicate below)
   - 上へ / 下へ (move up / down; disabled at boundaries)
2. The floating panel uses the existing panel stack machinery
   (`subPanelClass("taskAction")` + back button → `"completion"`).
3. Deletion goes through `setField("plan.completion.tasks", next)` as today,
   preserving the existing store contract.

**Verify:**
- Open completion subpanel, add two tasks.
- Click the 3-dot on task #1. Floating panel opens. Pick "下へ" — order
  swapped, panel closes.
- Pick "削除" — task disappears, panel closes.
- Click 3-dot on the only task → "上へ" and "下へ" are disabled.

---

## Task 4 — Project / Tags UI rebuilt per v4

**Files:**
- Modify: `src/components/tiles/QuickTileCreate.tsx` (organize row at title + meta subpanel at lines 1614-1713)

**Behaviour delta:**

1. A small horizontal `organizeRow` is rendered **above** the essentials
   block, directly under the title input (matching v4's `organize-row`).
   It shows compact chips:
   - `meta-chip.project` (blue background `#eef3fb`, text `#37689e`,
     `i-project` icon) when `meta.ownerSubjectId` is set, otherwise
     `meta-chip.add` ("整理 +" placeholder)
   - one `meta-chip.tag` per tag in `meta.tags` (purple background
     `#f2effc`, text `#6754a8`, `i-tag` icon) with × for remove
   - a trailing `meta-chip.add` for adding more tags
2. Clicking any chip or the "整理" affordance opens the existing meta
   subpanel (already mounts `data-subpanel="meta"`).
3. Inside the meta subpanel, project selection switches from
   full-width button cards to a `catalog-item` row list matching v4's
   `catalog` pattern (icon + title + sub + role pill), reusing
   `projects.workspaces` as the source list and falling back to a
   "Default (個人)" row when `meta.ownerSubjectId === null`.
4. Tag selection switches from a free-text input to a `choice-tab`
   multi-select row built from a small static suggestion list (matching
   v4's `['課題','数学','読み物','自動配置','回復','重要']`) **plus** the
   free-text add path so users are not blocked. Existing `meta.tags`
   membership is preserved across the change.

**Verify:**
- Open the editor. Empty state: `+ 整理` chip on the title row.
- Click it. Inside the meta subpanel, pick project "制作". Close panel.
  Title row now shows `制作` blue chip + `+ 整理` add chip.
- Add two tags via the choice-tab row, close panel. Title row shows two
  purple tag chips plus the add chip.
- Remove a tag via × — count drops by one.
- Reopen the meta subpanel — previous project and tag selections are
  restored.

---

## Out of scope

- Any store / domain / API contract change beyond the `repeatMode` field.
- Translation strings — we add new keys under `quickCreate.*` (ja + en)
  but do not migrate the legacy keys.
- New components in `src/components/tiles/editor/` — Phase 4 reuses the
  existing `SchedulePanel` / `AutomationPanel` / `FormPanel` infrastructure.
- Migration to Next.js server components. This file is a `"use client"`
  panel; no SSR impact.

---

## Done = 

- `bun run lint` clean.
- `bunx vitest run src/components/tiles/QuickTileCreate` (when tests are
  added; tests are optional for Phase 4).
- Manual walkthrough via the chrome-devtools MCP covering all four
  behaviours above.
- All four tasks committed as separate conventional commits:
  - `fix(web): render time chip with partial span + correct duration routing`
  - `feat(web): v4 recurring UI (choice-tab + weekday + end-date)`
  - `feat(web): completion task 3-dot menu floating panel`
  - `feat(web): v4 project/tag chip row + meta subpanel catalog/choice-tab`

