# Tastile Web — App Redesign (2026-06-20)

> Status: design validated, ready for implementation planning.
> Supersedes `2026-03-13-tastile-web-shell-redesign` (kept for history).

---

## 1. Goal

Rebuild `tastile-web` to behave like a familiar Google Calendar / task management app, **not** a developer-tool command center. The vertical day-timeline is the home. Multiple label-based references overlay on it. Tile editing is low-frequency by design — drag exists with friction, panel-edit is primary.

User feedback that drove this design (verbatim themes):
- "アプリUI変わってない / そもそもの構成が変わってない / UXが良くない"
- "あなたの考えるイメージに勝手に当てはめている"
- "考えさせないこと / ユーザーの自然な思考の流れにそって"
- "タスク作成のハードルを極限まで下げる"

---

## 2. API Reality (verified against `public/openapi.yaml`)

47 endpoints across 7 tags. All Client-side state derives from these.

### Confirmed available

| Capability | Endpoint | Notes |
|---|---|---|
| Day timeline (home) | `GET /views/calendar/day?anchor=YYYY-MM-DD&tz_offset=N` | Server-precomputed `CalendarProjection`. Use this for home. |
| Week / Month / Year | `GET /views/calendar/{week\|month\|year}?anchor=...&tz_offset=...` | Same projection shape, different `view` |
| Tile list | `GET /views/tile-list` or `GET /read/tiles?view_mode=...&lifecycle=...&search=...&limit=...&exclude_future=...` | Server-side filter and search |
| Active tile + phase | `GET /read/execution-view` | Returns `main_tile`, `tiles_in_progress`, `is_working`, `is_on_break`, `is_idle`, `pending_prompt_id`, etc. |
| Today items (compact) | `GET /views/timeline/today` | Items-only, no grid. Used for side widgets. |
| Edit a tile | `GET /read/tile/{id}/editable` → `POST /commands/tile/update` | Editable view = the form payload |
| All tile commands | `POST /commands/tile/{create\|start\|complete\|defer\|delete\|update\|extend}` | Full Command API |
| Break commands | `POST /commands/break/{start\|end}` | |
| Prompts | `GET /prompts/current`, `POST /commands/prompt/{respond-startup-recovery\|request}` | |
| Quota | `GET /auth/tile-quota` | `plan`, `max_tiles`, `remaining_tiles`, `limit_reached` |
| Search | `GET /read/tiles?search=...` | Server-side text match on title/labels |
| Multi-device sync | `GET /read/events/state?access_token=...` (SSE) | Subscribe for live updates |
| Events log | `GET /debug/events` | (Non-production only) |

### Gaps between original brainstorm and reality

| Original assumption | Reality | Resolution |
|---|---|---|
| "References" are first-class entities | NOT. Derived from `TileView.labels: string[]` | References panel = unique labels set + checkboxes |
| "Projects" are first-class | NOT. Same as references | Projects panel = saved filters on `labels IN [...]`, client-side |
| "Schedule templates" are separate | NOT. Recurring tiles ARE tiles with `objective_mode: "recurring"` and inline `RecurrenceView` | Schedule panel = tiles where `objective_mode === "recurring"` + next-occurrence |
| "Teams" are first-class | NOT in API | Deferred (post-MVP) |
| "Notifications" are first-class | NOT | Built client-side from SSE event stream |
| Timeline home is a custom view | It's actually `/views/calendar/day` | Use that endpoint |
| Lifecycle is 3-state | 4-state: `ready / started / done / closed` | Add "closed" status icon, hide from main timeline by default |
| All tiles editable | `CalendarBlock.editable: boolean` | Server tells; remote-owned blocks get read-only treatment |

---

## 3. Overall Structure

```
       ┌─[Header floating, h-12, bg-blur, OVERLAYS top of all 3 cols]──────┐
       │ ● EXEC · Quarterly doc · 12:36 left │ 🔍  🔔  [Avatar▾]         │
       ├──────────────────────────────────────────────────────────────────┤
┌──────┼──────────────┬───────────────────────────────────────────────────┐
│   T  │              │                                                   │
│      │   Side Bar   │  June 18, 2026  ◀ ▶                              │
│  📅  │  (selected   │  [Day] Week  Month                                │
│      │   panel)     │                                                   │
│   ✓  │              │  09 ──  ▌ Quarterly planning doc         25m ○    │
│      │              │  10 ──                                              │
│   🏷  │              │  ─ ─ ─ NOW 14:24 ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─  │
│      │              │  14 ──  ▌ Review PR #284                15m ○    │
│   🔁  │              │  15 ──                                              │
│      │              │  16 ──  ▌ Reply to design review        10m ○    │
└──────┴──────────────┴───────────────────────────────────────────────────┘
```

**4 regions:**

1. **Header** (h-12, floating, full-width, `backdrop-blur`).
   Left: execution status (status icon + label + active tile + tz + countdown). Right: 🔍 (search), 🔔 (notifications), [Avatar▾]. No brand on left.

2. **Activity Bar** (w-12, full-height, fixed left). Top: T brand mark (click → home). Below: 📅 References / ✓ Tasks / 🏷 Projects / 🔁 Schedule. Selected panel gets accent bar.

3. **Side Bar** (w-72, full-height). Content depends on selected Activity Bar icon. Default = References. Scrolls under header.

4. **Main** (flex-1, full-height). Calendar projection: Day (home) / Week / Month / Year.

---

## 4. Visual Language

### Hard rules

- **NO borders**, **NO drop shadows**. Section separation via background-tier shifts + generous whitespace.
- **Color = accent ONLY.** Text and icon strokes are neutral (`ink-1`, `ink-2`, `ink-3`). Color appears only as:
  - 4px left bar on tile blocks (the reference color)
  - Active-state indicators (accent rail bar, filled status icon)
  - Tile background = reference color at 8-12% alpha
- **Status uses ICONS, not color.** Filled icons (running) use the tile's reference color so they harmonize; outline icons (idle/done/closed) are neutral.
- **Typography hierarchy:** weights + sizes only. No all-caps "kicker" eyebrows on every section.
- **Mono font** for time, duration, tz, IDs, counts. Sans for prose.

### Color palette (existing tokens)

Use what's already in `tailwind.config` + `app/globals.css`. No new theme work. Tile reference colors come from a 12-color palette in the UI, user-mapped to labels.

### Section separation (since no borders)

- Side Bar vs Main: `surface-1` (side bar) vs `surface-0` (main). Different tier, same family.
- Tile blocks: `surface-1` base + reference color overlay at 8% alpha.
- Active tile (focused): reference color overlay at 14% alpha.
- Section header inside a side bar panel: `ink-3` text + generous padding, no underline.

---

## 5. Components

### 5.1 Header — `<FloatingHeader>`

- Props: `execution: ExecutionSnapshot`, `user: UserProfile`, `onOpenSearch()`, `onOpenNotifications()`.
- Background: `bg-surface-0/70 backdrop-blur-md` (subtle, not solid).
- Border-bottom: none.
- Z-index: above all panels (sidebar scrolls under it).

### 5.2 Activity Bar — `<ActivityBar>`

- Props: `current: "references" | "tasks" | "projects" | "schedule"`, `onChange(panel)`.
- Top: T logo (h-6 w-6, brand color bg, no click action or click = home).
- 4 icons below: 📅 ✓ 🏷 🔁.
- Selected icon: 2px accent bar on left (matches CommandShell rail pattern from existing code).

### 5.3 Side Bar panels

Each panel is a separate component. Switched by Activity Bar.

#### `<ReferencesPanel>`
- Reads unique `labels[]` from loaded tiles.
- Groups: "MY LABELS" (user-created) / "AUTO" (semantic_role-derived).
- Each row: filled dot in label's color + name + tile count + meta.
- Click anywhere on row → toggle overlay (no separate checkbox).
- OFF tiles appear at 30% alpha on timeline.
- Footer: `+ New label` (opens small modal to define label name + color).

#### `<TasksPanel>`
- Calls `GET /read/tiles?lifecycle=...` with view_mode=`list`.
- Groups: `Overdue / Today / This Week / Later / No date / Closed`.
- Each row: status icon + title (mono) + duration + reference labels.
- Top: search input (server-side, debounced 250ms, calls `getTiles({search})`).
- Click row → opens `<TileEditPanel>` (right slide-in).

#### `<ProjectsPanel>`
- Client-side state: array of saved filters `[{name, labels: [...], color}]`.
- Default state: empty. User creates a "project" by selecting labels + naming it.
- Each row: project name + tile count + last activity.
- Click → Main switches to Day view with project filter applied (only matching tiles visible, even if reference labels differ).

#### `<SchedulePanel>`
- Calls `GET /read/tiles?lifecycle=...` with client-side filter `objective_mode === "recurring"`.
- Each row: title + duration + `RecurrenceView.human_summary` + next-occurrence time (use `projected_next_start_at` if available).
- Click row → `<TileEditPanel>` (with recurrence section pre-expanded).

### 5.4 Main — Calendar projections

#### `<CalendarMain>` — switchable by `[Day] [Week] [Month] [Year]` pills

- Day mode (default, home): calls `GET /views/calendar/day?anchor=today&tz_offset=userTzOffset`.
- Week mode: `GET /views/calendar/week?anchor=...&tz_offset=...`.
- Month mode: `GET /views/calendar/month?anchor=...&tz_offset=...`.
- Year mode: `GET /views/calendar/year?anchor=...&tz_offset=...`.
- All return `CalendarProjection` = `{ view, range_start, range_end, blocks, all_day_spans, overflow_counters, month_summaries }`.

#### Tile block rendering

- 4px left bar in `source_label`-derived color.
- Background: same color at 8% alpha (overrides `surface-1`).
- Text: `ink-1` (always, regardless of color).
- Status icon at bottom-right (○ idle / ◉ running / ✓ done / ✕ closed).
- `editable: false` from server → render with neutral bg, no 4px bar, ⚠ hint on hover.
- `ownership: remote_owned` → faded, ⚠ "from <source_label>" hint.

#### Empty / edge states

- 0 tiles today: centered hint "Click anywhere to create, or ⌘N". Timeline structure still shown (hours).
- 0 references enabled: side panel hint + main timeline dimmed.
- All Day items in past: timeline shows past content + empty future.
- `overflow_counters` non-empty: "+ N more" pill at the bottom of each day cell in week/month mode.

### 5.5 Tile edit / create panel — `<TileEditPanel>`

Modal-less, slides in from right, w-96. Used for both create and edit.

- Trigger:
  - Create: click empty time / drag empty area (drop) / `⌘N` / click `+` button.
  - Edit: click existing tile block.
- Top section (always visible):
  - Title (required, autofocus).
  - Time: start → end (auto-snapped to 15min).
  - Reference labels: chip picker (multi-select, from existing labels).
- Progressive disclosure (Google Analytics style — only expand on demand):
  - ▸ **Repeat** (only if `objective_mode` is recurring or user opens this section)
    - Step (every N min), Anchor time, Window start/end, Selector expression (cron-like).
  - ▸ **Conditions** — the 7 layers (work / temporal / objective / interruption / automation / annotation).
    - Each layer expands into its specific fields. Stays collapsed by default for create, expanded for edit.
  - ▸ **Notes** (memo).
- Footer: `[Delete]` (edit only) | `[Cancel]` `[Save ⏎]`.
- Conflict resolution dropdown (visible only if `conflict_resolution` would be needed — i.e., time overlaps another tile):
  - `keep_overlap` / `auto_nearest` / `auto_next_day` / `manual_adjust`.

### 5.6 Search overlay — `<SearchOverlay>`

Triggered by 🔍 click or `⌘K`.

- Floating, top-center, w-[600px].
- Input: text.
- Results: tile rows + page rows (from a static list).
- Server-side search via `getTiles({search})` (debounced 200ms).
- Arrow keys navigate, Enter focuses, ESC closes.
- NO fuzzy command palette (per user feedback — too text-heavy for new users).

### 5.7 Notifications dropdown — `<NotificationsDropdown>`

- Trigger: 🔔 click.
- Built client-side from SSE event stream + cached notifications.
- Items: timestamp + message. Click → focus related tile.

---

## 6. Timeline Interactions (interaction details)

### Click on empty time
- Click → momentary thin highlight band at the clicked time range.
- Side panel `<TileEditPanel>` slides in (create mode), time pre-filled.
- ESC or click outside → panel closes, no creation. Even if the user types something then ESCs, no orphan save.

### Click on existing tile
- Click → `<TileEditPanel>` slides in (edit mode), all fields pre-filled.
- ESC or click outside → closes (auto-save is fine since events are append-only and recoverable).

### Drag empty time → create
- Mouse-down on empty area + drag → ghost rectangle (semi-transparent, no dashed border).
- Drop → `<TileEditPanel>` slides in with time range pre-filled.
- ESC mid-drag → cancels. Release with < 5min drag → cancels (no ghost, no panel).

### Drag existing tile → move (2-cushion, low-frequency)
- First click on tile → focus state (subtle neutral bg shift, no other visual change).
- Release. (Focus stays for 1.5s, then auto-clears.)
- Second click on same tile (within focus window) + drag ≥ 5px → drag mode starts.
- Ghost = semi-transparent tile at new vertical position.
- Snap to 15min.
- ESC → cancels. Release → POST `/commands/tile/update` with new `temporal.fixedStart/fixedEnd`.
- If user just clicks once and never clicks again, nothing happens. (Anti-accident.)

### Drag tile edge → resize
- Same 2-cushion pattern.
- Cursor changes to `ns-resize` when within 6px of top/bottom edge AND tile is focused.

### Color (per-tile override)
- Auto = first reference label's color.
- Override: in edit panel's "Appearance" section (or merged into labels section), click a swatch from the 12-color palette.
- "Auto" button to revert.

---

## 7. Empty / Error States

| State | Where shown | Treatment |
|---|---|---|
| 0 tiles at all | Side panel + main timeline | Hint centered: "Click anywhere to create, or ⌘N." |
| All references OFF | Side panel + main timeline | Hint: "Pick at least one label to see tiles." |
| IDLE (no active tile) | Header | Status icon: ○. Label: "IDLE". Right: `[+ Start next]` (selects `next_actionable_tile_id` from `/read/tiles` response). |
| `limit_reached: true` | Header + create button | Header: ⚠ "Tile quota reached". `[+ Create]` disabled with tooltip. |
| API offline (network error) | Header + main | Header: ⚠ "Offline — changes will sync later". Main: existing tiles still shown (cached), all edit affordances disabled. Retry button. |
| Tile creation conflict | Edit panel | Dropdown: "If conflicts:" with 4 options from `conflict_resolution` enum. Default = `manual_adjust`. |
| Concurrent edit | Edit panel | If `GET /read/tile/{id}/editable` returns `version !== localVersion`, show inline warning: "Edited on another device." 3 actions: `[Use my changes]` / `[Use theirs]` / `[Compare]`. |
| Session expired | Full overlay | Centered card: "Please sign in again." `[Sign in with Google]` → Cognito Hosted UI. |

---

## 8. Out of Scope (post-MVP)

- **Team schedules.** API doesn't expose teams yet. TEAMS section is hidden until it does.
- **First-class notifications.** Built from SSE event stream in MVP. A proper notification entity is future.
- **Mobile-optimized routes.** `/app/*` PWA is a separate workstream.
- **Drag-to-create with multi-day range.** Drag creates single-day tiles only.
- **Multi-select bulk operations.** Not in design; use search + individual edits.
- **Calendar subscriptions (read external ICS).** Future.

---

## 9. Files to Change / Add / Remove

### Add

- `src/components/shell/FloatingHeader.tsx`
- `src/components/shell/ActivityBar.tsx`
- `src/components/shell/SideBar.tsx` (router for panel content)
- `src/components/sidebar/ReferencesPanel.tsx`
- `src/components/sidebar/TasksPanel.tsx`
- `src/components/sidebar/ProjectsPanel.tsx`
- `src/components/sidebar/SchedulePanel.tsx`
- `src/components/calendar/CalendarMain.tsx` (Day/Week/Month/Year switcher)
- `src/components/calendar/DayView.tsx`
- `src/components/calendar/WeekView.tsx`
- `src/components/calendar/MonthView.tsx`
- `src/components/calendar/YearView.tsx`
- `src/components/calendar/TileBlock.tsx`
- `src/components/calendar/AllDayLane.tsx`
- `src/components/tile/TileEditPanel.tsx`
- `src/components/search/SearchOverlay.tsx`
- `src/components/notifications/NotificationsDropdown.tsx`
- `src/lib/hooks/use-calendar-projection.ts` (calls `/views/calendar/*`)
- `src/lib/hooks/use-tile-list.ts` (calls `/read/tiles`)
- `src/lib/hooks/use-active-tile.ts` (calls `/read/active-tile` or `/read/execution-view`)
- `src/lib/hooks/use-sse-sync.ts` (subscribes to `/read/events/state`)
- `src/lib/stores/projects-store.ts` (saved filters)
- `src/lib/stores/labels-store.ts` (label → color map)
- `src/lib/projection/calendar-projection.ts` (wrap API response, add derived fields)
- `src/lib/projection/label-grouping.ts` (derive references from tile.labels)

### Rewrite

- `src/app/dashboard/layout.tsx` → wraps new shell
- `src/app/dashboard/layout-client.tsx` → uses new FloatingHeader + ActivityBar + SideBar + CalendarMain
- `src/app/dashboard/page.tsx` → renders `<CalendarMain view="day" />` (home = Day mode)
- `src/app/dashboard/page-client.tsx` (extract state into a client component)
- `src/lib/hooks/execution-engine-context.tsx` → wire to real API via `use-sse-sync` + initial fetch

### Edit

- `src/app/dashboard/execute/page.tsx` — render `<CalendarMain view="day" />` filtered to active tile
- `src/app/dashboard/timeline/page.tsx` — render `<CalendarMain view="day" />` for arbitrary date
- `src/app/dashboard/calendar/{day,week,month,year}/page.tsx` — render `<CalendarMain>` with the right `view`
- `src/app/dashboard/tiles/page.tsx` — render `<TasksPanel>` as full-page view
- `src/app/dashboard/{prompts,breaks,history,events,quota,runtime,integrations,projects}/page.tsx` — leave as-is for now (still accessible from overflow menu)

### Remove

- `src/components/shell/CommandShell.tsx`
- `src/components/shell/RailOverflow.tsx`
- `src/components/shell/AvatarMenu.tsx`
- `src/components/dashboard/ActivePhaseCanvas.tsx`
- `src/components/dashboard/QueueSection.tsx`
- `src/components/dashboard/TimelineRibbon.tsx`
- `src/components/dashboard/ConditionVector.tsx` (was at `src/components/execution/ConditionVector.tsx`)
- `src/lib/projection/dashboard-projection.ts` (replaced by `calendar-projection.ts`)
- `src/lib/stores/dashboard-workspace-store.ts` (no longer needed)

---

## 10. Verification Plan

1. `bun run typecheck` — clean.
2. `bun run lint` — 0 errors in changed files (existing pre-existing errors in unrelated files left alone).
3. `bun run test:unit` — 159+ existing tests still pass; new tests for projection + 2-cushion drag.
4. `bun run build` — all 17+ dashboard routes generate as static or properly server-rendered.
5. Browser smoke (Chrome DevTools):
   - Home `/dashboard` renders the Day calendar projection with vertical timeline + now-line.
   - Click empty time → edit panel slides in, time pre-filled, no tile created until Save.
   - Click existing tile → edit panel slides in with existing data.
   - Drag empty area → ghost rectangle → drop → edit panel with time pre-filled.
   - 2-cushion drag: click tile → focus state → click again + drag → move.
   - Switch Day/Week/Month/Year — each fetches its projection and renders.
   - Toggle references off → corresponding tiles dim to 30% alpha.
   - `⌘K` opens search overlay with server-side results.
   - `🔔` opens notifications dropdown.
   - Avatar dropdown → Theme picker cycles 4 themes.
   - Offline simulation: header shows ⚠ + retry; tiles still render from cache.
   - Concurrent-edit simulation: edit panel shows inline conflict warning.

---

## 11. Open Questions (resolved before implementation)

None remaining. All decisions captured above.
