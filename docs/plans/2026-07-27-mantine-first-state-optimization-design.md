# Mantine-first State Optimization Design

- Date: 2026-07-27
- Status: Approved design
- Scope: `tastile-web` UI state, local form state, server-state ownership, and render fanout
- Priority: Maintainability and readability

## Goal

Use Mantine 9.4 primitives wherever they are semantically equivalent to existing hand-written UI state, browser-event, timer, and form code. Keep v1 domain/event state and remote read-model cache in their canonical owners.

## Boundaries

Mantine owns presentation state and generic browser interaction primitives:

- `useDisclosure` for payload-free open/close booleans
- `useHover`, `useMediaQuery`, `useClickOutside`, `useWindowEvent`, and `useHotkeys` for generic UI interactions
- `useInterval` and `useTimeout` for simple display timers
- `useClipboard` for copy feedback
- `useLocalStorage` / `readLocalStorageValue` for React-local persisted UI values
- `@mantine/form` for the `ProjectsSidePanel` form pilot
- `useUncontrolled` for controlled/uncontrolled component state

TanStack Query remains the owner of API cache/loading/error/invalidation. Zustand remains the owner of the QuickTileCreate domain draft and app-wide UI stores where persistence or cross-component coordination is required. v1 Event/Reducer state, server validation, security-lock storage checks, exponential-backoff polling, and gesture/RAF code remain outside Mantine.

## Phases

### Phase 0 — Baseline and contracts

Run targeted tests, typecheck, lint, and record React Profiler baselines without overwriting current uncommitted work. Add or preserve tests for open/close, Escape, portal behavior, focus return, form reset, failed submit draft retention, and cleanup.

### Phase 1 — Low-risk Mantine primitives

Replace the custom `useMediaQuery` implementation; convert pure disclosure flags in dashboard/layout/panel components; use `useHover` for ActivityBar hover; use `useClickOutside` where the target is a stable ref; replace generic window event effects with `useWindowEvent`/`useHotkeys`; replace simple display intervals/timeouts with Mantine hooks; use `useClipboard` in AccessTokenSection; migrate `useTrackVisit` React persistence to Mantine storage helpers. Remove obsolete custom code only after tests pass.

### Phase 2 — Mantine form pilot

Add `@mantine/form` with the existing Mantine version. Migrate only `ProjectsSidePanel` values, client validation, reset, and dirty/submit semantics. Keep `creating`, async `busy`, and API errors outside the form. Preserve input on failure and reset only after success.

### Phase 3 — Server-state and render ownership

Migrate auth session/profile, tile list, placements, and duplicate active-tile reads to shared TanStack Query keys one family at a time. Then profile and narrow QuickTileCreate panel state, minute-clock Context fanout, and calendar clock/filter ownership. Avoid speculative memoization.

### Phase 4 — Evaluate custom components

After behavior and accessibility tests are fixed, compare `FloatingMenu`/`Dropdown` with Mantine `Menu`, `Popover`, `Select`, or `Combobox`. Migrate only if external triggers, portals, positioning, keyboard behavior, and styling contracts remain equivalent.

## Verification and acceptance

- `bun run typecheck`, `bun run lint`, and targeted/full Vitest suites pass.
- UI changes are exercised in a running dev server through Chrome at mobile and desktop widths.
- Profiler records no regression in typing, panel switching, clock ticks, or calendar navigation.
- Query tests cover cache sharing, invalidation, no duplicate requests, and stale response handling.
- No derived v1 status or Placement validity is stored or recomputed in the client.
- Existing uncommitted changes remain intact and unrelated files are not reformatted.
