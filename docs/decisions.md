# Decisions

## 2026-06-30 timeline relative display modes

- Add 3 display modes to Day/Week/Month views: `scope` (default, current behavior), `around` (centered on today), `future` (from today onward). List view unchanged.
- Mode choice persisted in URL as `?mode=around` / `?mode=future`. Default `scope` omitted from URL.
- Prev/Next buttons disabled in `around` and `future`; only "Today" remains. Title shows "Today · ±Nh/d" (around) or "From now · Nh/d" (future).
- MiniCalendar side-panel highlight uses today alone for `around`, today → range-end for `future`.
- Full design in `docs/plans/2026-06-30-timeline-relative-display.md`.

## 2026-04-06 linear redesign baseline

- Adopt `docs/awesome-design-md/design-md/linear.app/DESIGN.md` as the visual source of truth for tastile-web
- Shift the web app to dark-native tokens with brand indigo reserved for CTA and active states
- Keep existing page/component structure and apply redesign through token rewrite plus targeted component/page restyling
- Add compatibility mapping for legacy zinc utility classes in `src/app/globals.css` to avoid partial regressions during migration

## 2026-04-06 redesign feedback alignment

- Promote `SiteHeader` to shared marketing navigation so home pricing download privacy terms all use common top-level structure
- Use brand source geometry from `tastile-brands/svg/logos/logo.svg` for the header icon mark and keep text separate in UI
- Reconcile theme initialization by making `theme-mode` the canonical source while mapping legacy `tastile-theme` storage during bootstrap
- Introduce reusable grid utilities (`layout-shell` `layout-grid-2` `layout-grid-3`) to enforce consistent page layout rhythm

## 2026-04-06 footer anchoring and login grid alignment

- Wrap short marketing pages in `min-h-screen flex flex-col` plus `main.flex-1` so footer always sits at viewport bottom
- Align login page to `layout-shell + layout-grid-2` and separate brand message panel from auth action panel
- Keep the login headline copy with icon in a horizontal block to preserve width rhythm with other marketing pages

## 2026-04-06 daemon session expiry hardening

- Normalize session `expires_at` before sending to daemon session restore API
- Accept unix seconds unix milliseconds numeric string and ISO string and fallback to `null` for invalid values
- Add regression coverage for invalid `expires_at` string so daemon initialization does not crash on `toISOString`

## 2026-04-06 malformed tile date hardening

- Guard sync payload conversion so invalid `Date` values serialize as `null` instead of throwing in `toISOString`
- Sanitize tile snapshot deserialization by converting invalid date strings to `null` and dropping segments with invalid `startAt`
- Tighten closed-at derivation to only use valid `Date` instances before `toISOString`

## 2026-04-06 dashboard workspace ux consolidation

- Move timeline windowing and tile change derivation from projection/UI into `src/lib/core/dashboard-workspace.ts` so day/week/month/custom scales share one calculation path
- Merge history experience into tiles workspace through `list` `timeline` `changes` tabs and redirect `/dashboard/history` to `/dashboard/tiles?tab=changes`
- Replace lifecycle-centric tile buckets with workspace groups (`Pinned` `Recently Updated` `Upcoming` `Backlog` `Completed`) and persist pin/collapse/viewport state in a dedicated dashboard workspace store

## 2026-04-06 tile-first category model

- Remove pin-based and manually curated grouping because it introduces non-tile truth for display priority
- Rebuild list sections as tile-first computed categories (`Focus` `Ready` `Scheduled` `Recent Activity` `Log`) derived only from tile fields plus active execution id
- Keep collapse state as UI-only preference while all section membership is recalculated every render from core state

## 2026-04-06 semantic role storage normalization and list modes

- Normalize `semanticRole` from both camelCase and snake_case tile annotations before upsert to satisfy non-null `semantic_role`
- Add tile-list grouping modes (`state` `project` `tag`) computed from tile data on each render instead of persisted grouping state
- Add list card display modes (`compact` `comfortable` `detailed`) and keep desktop-like row density in `comfortable` mode

## 2026-04-06 desktop interaction parity adjustments

- Treat status icon as prompt trigger in tile list views so direct task transitions are not exposed in list rows
- Keep delete action only in expanded card flow and remove row-level delete control
- Show both duration and start time directly on compact and expandable tile cards and add a non-functional search input shell as layout placeholder

## 2026-04-06 section limit parity with desktop

- Keep categorized state sections visible as fixed groups even when some groups are empty to preserve stable scanning layout
- Add section item visibility limits with desktop parity behavior (`8` then doubling, reset to `8` once next limit exceeds section size)
- Place edit icon as a dedicated control to the right of duration/start-time block in comfortable list rows

## 2026-04-06 header and prompt structure parity refresh

- Shift desktop header emphasis to left-side countdown panel while keeping the full execution bar in center context
- Change global prompt UI from top-center wide banner to top-right toast style to match desktop prompt-notification mental model
- Add list-level `Main` and `Sub` progress cards in Tiles while keeping `Next` in the right sidebar

## 2026-04-06 desktop api parity bridge for web

- Add desktop read-model APIs to web daemon client (`/read/tiles` `/read/execution-view` `/views/pending-prompt` `/views/timeline/today`) and keep `/read/events/state` as the SSE path
- Expand prompt action contract to include desktop actions (`start_break_parallel` `start_break_split` `start_break_split_and_extend` `complete_phase`)
- Introduce parity adapters in `core-engine.ts` that expose desktop-like read models from snapshot + tile export without changing daemon contracts
- Hydrate dashboard state from parity read models in `use-daemon-execution` so tile duration/start metadata and phase end data remain core-derived instead of snapshot-title-only

## 2026-04-06 countdown fallback parity without standby state

- Remove the web-only `待機中` status copy from active execution surfaces and always render a countdown label
- Follow desktop resolver priority for countdown text (`phaseEndsAt` -> `nextActionableStartAt` -> `00:00`)
- Replace ambiguous tile time placeholders (`--` `--:--`) with explicit missing-value labels to avoid blank/unknown-looking cards

## 2026-04-06 prompt defer and header noise trim

- Map prompt `defer_tile` action to a concrete `next_start_at` using prompt suggested minutes or a 30-minute fallback so defer always changes schedule
- Keep countdown on the left side header panel and remove duplicated central countdown plus sync text labels
- Reduce prompt toast to title + actions only and drop explanatory body text that creates visual/decision noise

## 2026-04-06 timeline height parity with desktop resolver

- Align timeline end inference to desktop order (`endedAt` -> `durationMin` -> `active now` -> `+25m fallback`) so missing end values still render duration-aware heights
- Raise web minimum block height to `44px` and add readable `px/min` amplification capped at `1.35x` base to preserve short-block legibility without over-zooming
- Preserve daemon duration hints in timeline snapshots (`durationMin`) so Execute timeline rendering can reflect real planned duration even when `endAt` is absent
- When daemon timeline omits `duration_min`, derive `durationMin` from tile objective (`targetWorkMin` / `targetRestMin`) before rendering so all blocks do not collapse to uniform fallback height

## 2026-06-30 — Recurring tile edit unification discovery

- `updateTileCommand` (`src/lib/api/v1/tile-commands.ts:98-118`) does NOT accept `recurrence`: `UpdateTileCommandOptions` (lines 33-39) only carries `title`, `description`, `color`, `icon`, `externalId`, and payload builder only sets those plus `tile_id`. Task 3 must extend this builder to include `recurrence` before the unified-edit refactor can proceed.
- `getTile` endpoint (`src/lib/api/endpoints.ts:317-324`): `GET /read/tile/{id}` returning the full v7 `Tile` from `src/lib/domain/tile.ts` (which has `recurrence: RecurrenceModel | null` at line 71).
- `updateTile` endpoint (`src/lib/api/endpoints.ts:203-210`): `POST /commands/tile/update` with v7 envelope shape.
- Data path is viable once `updateTileCommand` is extended: `getTile` provides the snapshot, QuickTileCreate's unified edit form collects changes, and the extended `updateTileCommand` carries `recurrence` through to the backend.
