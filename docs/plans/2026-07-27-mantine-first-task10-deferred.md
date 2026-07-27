# Task 10 (render-state ownership) — deferred

The plan's Task 10 ("Profile and narrow render-state ownership")
requires capturing React profiler traces from a running dev server:

> Step 1: Capture profiler traces
> Run the dev server and record typing in QuickTileCreate, panel
> switching, a minute tick, calendar filter/navigation, and side-panel
> updates. Record commit duration and rendered subtree count.

Without browser access in this session, no trace can be captured and
no hotspot can be selected. Steps 2-4 are downstream of Step 1.

## What can be said from code alone (no profile needed)

- **`src/lib/hooks/minute-clock.tsx`** — already migrated in Task 4
  to Mantine `useInterval`. The provider only re-renders consumers
  that read `useMinuteClock()`, which is the intended narrow
  fan-out.
- **`src/lib/context/side-panel-context.tsx`** — uses
  `useSyncExternalStore` + a module-level mutable holder precisely
  to avoid re-rendering the page tree when content changes (see
  comment block at lines 13-26). No further narrowing is obvious
  from the code.
- **`src/components/tiles/QuickTileCreate.tsx`** — already uses
  per-field Zustand selectors (`useQuickCreateStore((s) => s.x)`) so
  a field-level edit only re-renders the subscriber. Local UI state
  (`visualOpen`, `activePanel`, `editingTaskId`) is per-component
  and stays local. Without a profile, no further ownership change
  is justified.

## Follow-up

Run `bun dev` and capture a React profiler trace for each of the five
scenarios listed in Task 10 Step 1. Pick the top contributor and
write the regression test + smallest ownership change per the plan.