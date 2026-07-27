# Mantine-first State Optimization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace equivalent hand-written UI state, browser-event, timer, and small-form implementations with Mantine 9.4 primitives while keeping v1 domain state and TanStack Query server state in their canonical owners.

**Architecture:** Execute in isolated, verifiable phases: Mantine hooks first, a single `@mantine/form` pilot second, TanStack Query ownership third, and render/component evaluation last. Each change must preserve current behavior and the existing uncommitted working-tree changes. Mantine never owns API cache, event/reducer state, security policy, or the QuickTileCreate domain draft.

**Tech Stack:** Next.js 16, React 19, TypeScript, Mantine `^9.4.2`, `@mantine/hooks`, `@mantine/dates`, `@tanstack/react-query`, Zustand, Vitest, Chrome DevTools.

---

## Task 1: Capture the baseline and protect the working tree

**Files:**
- Read only: `src/**`, `package.json`, `bun.lock`

**Step 1: Record current state**

Run:

```bash
git status --short
git diff --stat
bun run typecheck
bun run lint
bun test src/components/panels/ProjectsSidePanel.test.tsx src/components/tiles/editor/FloatingScheduleEditor.test.tsx src/components/ui/floating-menu/__tests__/FloatingMenu.test.tsx src/app/dashboard/dashboard-shell.ui.test.tsx
```

Record existing failures without changing unrelated code. Do not reset, stash, clean, or overwrite the current uncommitted edits.

**Step 2: Establish UI behavior coverage**

Before replacing state primitives, confirm tests cover the current contracts: modal open/close, Escape, click outside, portal clicks, focus return, form reset, failed submit retention, and controlled/uncontrolled FloatingMenu behavior. Add only missing assertions in the later task that owns each component.

**Verification:** Baseline output and the initial `git status --short` are available for comparison; no files are modified by this task.

---

## Task 2: Replace the custom media-query implementation

**Files:**
- Modify: `src/lib/hooks/use-media-query.ts:2-24`
- Test: `src/lib/hooks/use-media-query.test.tsx` (create if no equivalent test exists)
- Consumer: `src/components/tiles/QuickTileCreate.tsx:102,250`

**Step 1: Write the failing compatibility test**

Use the existing `matchMedia` test setup and assert that `useIsDesktop` follows the media-listener change and unregisters the listener on unmount. Preserve the current initial `false` behavior during SSR/jsdom.

**Step 2: Run the focused test**

```bash
bun test src/lib/hooks/use-media-query.test.tsx
```

Expected: the test fails only if the new Mantine-backed implementation is absent.

**Step 3: Replace the implementation**

Import Mantine's `useMediaQuery` from `@mantine/hooks` instead of maintaining a local `useEffect`/`matchMedia` subscription. Keep `useIsDesktop` as a small project convenience wrapper so existing consumers do not churn. Pass the installed Mantine options needed to preserve SSR behavior.

**Step 4: Verify**

```bash
bun test src/lib/hooks/use-media-query.test.tsx
bun run typecheck
```

---

## Task 3: Convert pure UI disclosure, hover, and keyboard state

**Files:**
- Modify: `src/components/panels/ProjectsSidePanel.tsx:38,55-60,126,194`
- Modify: `src/app/dashboard/preferences/account/page.tsx:94,196,225`
- Modify: `src/app/dashboard/layout-client.tsx:59-61,79-80,115,127`
- Modify: `src/app/dashboard/dashboard-shell.tsx:53-56,73-75`
- Modify: `src/components/shell/ActivityBar.tsx:55-58,116-117`
- Tests: existing sibling tests plus focused interaction assertions where missing

**Step 1: Add behavior assertions**

For each disclosure, assert closed-by-default, trigger opens, close action closes, and Escape/outside behavior remains unchanged. Assert ActivityBar hover still controls expandable sidebar width and its menu still closes after selection.

**Step 2: Run focused tests**

```bash
bun test src/components/panels/ProjectsSidePanel.test.tsx src/app/dashboard/dashboard-shell.ui.test.tsx src/components/layout/AppShell.test.tsx
```

**Step 3: Implement the smallest replacements**

Use `useDisclosure(false)` for payload-free booleans and wire `open`, `close`, and `toggle` directly to Mantine component props. Use `useHover` for the CSS-hover-only `hovered` value and keep the menu disclosure separate. Do not convert `activePanel`, selected IDs, async guards, or payload-bearing state.

Replace simple Escape listeners with `useHotkeys` only where the handler is scoped to the same open state; otherwise use `useWindowEvent` and retain the existing guard. Replace dashboard outside-pointer listener with a Mantine primitive only when a stable ref expresses the same boundary.

**Step 4: Verify**

```bash
bun test src/components/panels/ProjectsSidePanel.test.tsx src/app/dashboard/dashboard-shell.ui.test.tsx src/components/layout/AppShell.test.tsx
bun run lint
bun run typecheck
```

---

## Task 4: Replace generic event-listener and simple timer plumbing

**Files:**
- Modify: `src/lib/hooks/minute-clock.tsx:2,13-19`
- Modify: `src/components/shell/FloatingHeader.tsx:58-72`
- Modify: `src/components/execution/ActiveExecutionBar.tsx:30-45`
- Modify: `src/components/execution/V1ExecutionControls.tsx:35-52`
- Modify: `src/components/theme/ThemeClassSyncer.tsx:20-35`
- Modify: `src/lib/hooks/use-v1-active-tile.ts:45-55`
- Modify: `src/lib/hooks/use-tile-list.ts:160-167`
- Modify: `src/lib/hooks/calendar/use-events.ts:188-194`
- Tests: corresponding hook/component tests and cleanup assertions

**Step 1: Add timer and cleanup tests**

Use fake timers to assert one tick, cleanup on unmount, and no state update after unmount. Use spies to assert custom event listeners are registered and removed exactly once.

**Step 2: Replace simple plumbing**

Use Mantine `useInterval` for fixed display clocks and `useTimeout` for one-shot UI transitions where the callback/delay are simple. Keep exponential-backoff timers in `use-active-tile.ts` and `use-notifications.ts` until their server-state migration; their changing delay is business/network behavior, not a generic interval.

Use `useWindowEvent` for fixed window custom-event subscriptions, wrapping async refresh calls with `void` so event handlers remain synchronous. Do not use Mantine `useFetch` for these reads; TanStack Query owns remote data in a later task.

**Step 3: Verify**

```bash
bun test src/lib/hooks/use-v1-active-tile.test.tsx src/lib/hooks/use-zoom.test.tsx src/components/execution/TimelineAxis.test.tsx
bun run typecheck
```

---

## Task 5: Use Mantine clipboard and storage primitives

**Files:**
- Modify: `src/components/account/AccessTokenSection.tsx:25-33,120-140`
- Modify: `src/lib/hooks/use-track-visit.ts:1-28`
- Modify: `src/app/dashboard/page.tsx:30-42`
- Modify: `src/app/dashboard/tasks/tasks-page-client.tsx:1-12`
- Modify: `src/app/dashboard/schedule/schedule-page-client.tsx:1-12`
- Modify: `src/app/dashboard/projects/projects-page-client.tsx:1-12`
- Tests: `src/components/account/AccountSections.test.tsx` and a focused `use-track-visit` test

**Step 1: Test copy and visit behavior**

Assert copied state resets after the configured timeout, clipboard failure is surfaced as before, route visits write the same key, and the dashboard still reads the last path during client navigation.

**Step 2: Implement**

Use Mantine `useClipboard({ timeout: 2000 })` for token copy feedback. Use `useLocalStorage` in the React visit hook and `readLocalStorageValue` for the imperative dashboard read, preserving the existing key and SSR/storage-unavailable behavior. Do not replace security-lock storage or theme bootstrap storage: those paths require synchronous validation, legacy-key migration, or pre-hydration execution.

**Step 3: Verify**

```bash
bun test src/components/account/AccountSections.test.tsx src/lib/hooks/use-track-visit.test.ts
bun run typecheck
```

---

## Task 6: Migrate the ProjectsSidePanel form to `@mantine/form`

**Files:**
- Modify: `package.json` dependencies
- Modify: `bun.lock`
- Modify: `src/components/panels/ProjectsSidePanel.tsx:39-75,126,194`
- Test: `src/components/panels/ProjectsSidePanel.test.tsx`

**Step 1: Add the dependency**

```bash
bun add @mantine/form@^9.4.2
```

Keep the version aligned with the installed Mantine packages.

**Step 2: Add failing form-contract assertions**

Cover required-name validation without a request, slug/color updates, cancel reset, failed API submit retaining values, successful submit clearing values, and double-submit protection.

**Step 3: Implement the pilot**

Create a typed `useForm` with `name`, `slug`, and `color` values and a required-name validator. Replace manual field reset and field error bookkeeping with form APIs. Keep `creating` as `useDisclosure`, keep `busy` as mutation/UI state, and keep API errors outside form validation. Map server rejection to the existing visible error without clearing values.

**Step 4: Verify**

```bash
bun test src/components/panels/ProjectsSidePanel.test.tsx
bun run typecheck
bun run lint
```

Do not migrate QuickTileCreate's Zustand domain draft to `@mantine/form` in this task.

---

## Task 7: Replace custom controlled-state plumbing where behavior is equivalent

**Files:**
- Modify: `src/components/ui/floating-menu/FloatingMenu.tsx:46-85`
- Test: `src/components/ui/floating-menu/__tests__/FloatingMenu.test.tsx`
- Evaluate only: `src/components/ui/Dropdown.tsx`

**Step 1: Strengthen controlled/uncontrolled tests**

Assert controlled mode never mutates internal state, uncontrolled mode honors `defaultOpen`, `onOpenChange` receives every transition, external trigger refs still work, Escape closes, and portal content remains reachable.

**Step 2: Implement the low-risk internal replacement**

Use Mantine `useUncontrolled` for `open/defaultOpen/onOpenChange`, preserving the public props and context contract. Do not replace positioning or portal DOM yet.

**Step 3: Evaluate component replacement**

Compare `FloatingMenu` with Mantine `Menu`/`Popover` and `Dropdown` with Mantine `Select`/`Combobox` against current tests, keyboard behavior, external trigger support, and CSS. Do not rewrite either component unless all contracts can be preserved; otherwise retain the component with Mantine internals.

**Step 4: Verify**

```bash
bun test src/components/ui/floating-menu/__tests__/FloatingMenu.test.tsx
bun run typecheck
```

---

## Task 8: Consolidate auth and collection server state in TanStack Query

**Files:**
- Modify: `src/lib/context/auth-context.tsx:21-97`
- Modify: `src/components/layout/Header.tsx:27-31,160-180`
- Create or modify: `src/lib/query/auth-query-options.ts`
- Modify: `src/lib/hooks/use-tile-list.ts:82-170`
- Modify: `src/lib/hooks/use-placements.ts:29-100`
- Modify: `src/lib/hooks/use-projects.ts`
- Modify: `src/lib/hooks/use-recurring-templates.ts`
- Tests: query option tests, hook tests, and new cache-sharing/invalidation tests

**Step 1: Add failing cache-contract tests**

Assert AuthContext and Header share one session/profile query key and do not issue duplicate requests. Assert tile/placement mutations invalidate the matching collection query and two consumers see the same cached result. Assert stale responses cannot overwrite newer data.

**Step 2: Centralize query options**

Move shared auth query keys/fetchers into `src/lib/query/auth-query-options.ts`; make AuthContext consume Query results instead of its own session/profile `useState`/effect. Preserve the public `useAuth` shape so consumers do not all change at once.

**Step 3: Migrate one collection family at a time**

Introduce stable query keys/options for tiles, placements, projects, and recurring templates. Replace manual loading/error/request-id state with `useQuery`; use mutations or explicit query invalidation after commands. Preserve the core API client and v1 command envelope. Do not derive or persist domain status in the web client.

**Step 4: Verify**

```bash
bun test src/components/layout/Header.query-options.test.ts src/components/layout/Header.test.tsx src/lib/hooks/use-projects.test.ts src/lib/hooks/use-placements.test.ts
bun run typecheck
```

---

## Task 9: Retire the duplicate active-tile read path and fix notification refresh ownership

**Files:**
- Modify: `src/lib/hooks/use-active-tile.ts:39-94`
- Modify: `src/lib/hooks/use-v1-active-tile.ts:24-55`
- Modify: `src/components/shell/FloatingHeader.tsx:29,59`
- Modify: `src/lib/hooks/use-notifications.ts:58-172`
- Modify: notification consumers and tests discovered by reference search
- Tests: `src/lib/hooks/use-v1-active-tile.test.tsx` plus new notification race tests

**Step 1: Inventory consumers and add compatibility tests**

Assert the canonical v1 hook supplies every field needed by current consumers, and two consumers do not make duplicate active-tile requests.

**Step 2: Switch consumers to the canonical Query hook**

Adapt the presentation layer if snapshot field names differ, then remove the manual polling hook only after no consumer remains. Preserve event-triggered invalidation and Query polling semantics.

**Step 3: Migrate notifications or harden the interim path**

Prefer a Query-backed notifications read with mutation/invalidation. If the existing API shape prevents that in this phase, add request sequencing/cancellation so overlapping refreshes cannot commit stale snapshots, then migrate later.

**Step 4: Verify**

```bash
bun test src/lib/hooks/use-v1-active-tile.test.tsx src/components/layout/Header.test.tsx
bun run typecheck
```

---

## Task 10: Profile and narrow render-state ownership

**Files:**
- Modify only after profiling: `src/components/tiles/QuickTileCreate.tsx:249-359,1125-1465`
- Modify only after profiling: `src/lib/hooks/minute-clock.tsx`
- Modify only after profiling: `src/components/calendar/CalendarMain.tsx:222-447`
- Inspect: `src/lib/context/side-panel-context.tsx`
- Tests: targeted component tests and clock/panel interaction tests

**Step 1: Capture profiler traces**

Run the dev server and record typing in QuickTileCreate, panel switching, a minute tick, calendar filter/navigation, and side-panel updates. Record commit duration and rendered subtree count.

**Step 2: Write a regression test for the chosen hotspot**

Test only the observed behavior, such as inactive panels not mounting, clock consumers updating at the expected cadence, or filter changes not resetting navigation.

**Step 3: Apply the smallest ownership change**

Keep the Zustand QuickTileCreate draft as the source of truth, but colocate panel-only UI state and mount only the active panel if the trace justifies it. Narrow the minute-clock provider to actual consumers. Keep URL/navigation state at its page boundary and avoid broad context rewrites. Do not add blanket `memo`, `useMemo`, or `useCallback` because React Compiler is enabled.

**Step 4: Verify**

Repeat the same traces and compare commit count/duration. Run the targeted tests and typecheck before moving on.

---

## Task 11: Evaluate the complete Mantine component migration

**Files:**
- Evaluate: `src/components/ui/floating-menu/FloatingMenu.tsx`
- Evaluate: `src/components/ui/Dropdown.tsx`
- Tests: their existing test suites plus keyboard/portal accessibility assertions

**Step 1: Compare behavior and accessibility**

Use Chrome DevTools and Vitest to check focus order, Escape, outside click, portal placement, external trigger refs, collision positioning, controlled mode, and mobile layout.

**Step 2: Decide based on evidence**

Replace with Mantine `Menu`, `Popover`, `Select`, or `Combobox` only when the existing public contract and visual behavior remain intact. Otherwise document the retained custom shell and keep the Mantine primitive replacements from Task 7.

**Verification:** No component rewrite is accepted solely because it reduces local state; behavior parity is required.

---

## Task 12: Full verification and browser acceptance

**Files:**
- No additional source changes unless verification exposes a regression.

**Step 1: Run checks**

```bash
bun run lint:biome
bun run lint
bun run typecheck
bun run knip
bun run test:unit
bun run build:prod
```

**Step 2: Exercise the running UI**

Start `bun dev` and use Chrome DevTools at 320px, 768px, 1024px, and desktop widths. Verify dashboard disclosure flows, QuickTileCreate editing/submission/failure retention, Projects form validation/reset, clipboard feedback, notification refresh, active-tile display, and calendar navigation.

**Step 3: Inspect final scope**

```bash
git status --short
git diff --stat
git diff --check
```

Confirm only requested files and the approved plan/dependency changes are present. Do not create a commit unless the user explicitly requests one.

---

## Notes on execution

- Use `bun`, never npm/npx.
- Read each file immediately before editing and preserve unrelated user changes.
- Run the smallest relevant test after every task; run the full check at the end.
- If a Mantine replacement changes semantics or increases complexity, keep the existing implementation and record the reason rather than forcing the migration.
- The approved design is documented in `docs/plans/2026-07-27-mantine-first-state-optimization-design.md`.
