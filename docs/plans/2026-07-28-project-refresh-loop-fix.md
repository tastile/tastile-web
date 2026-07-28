# Project Refresh Loop Fix Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Stop the unbounded `/api/proxy/access/subjects?kind=1` request loop caused by an unstable `useProjects().refresh` callback.

**Architecture:** Keep React Query as the single workspace cache. Make the public `refresh` callback referentially stable while preserving its existing `query.refetch()` behavior; do not alter proxy routing, retry policy, or workspace data shape.

**Tech Stack:** React 19, TanStack React Query, TypeScript, Vitest, Testing Library.

---

### Task 1: Pin the callback stability contract

**Files:**
- Modify: `src/lib/hooks/use-projects.test.ts`

1. Render `useProjects`, wait for the initial query to settle, save `result.current.refresh`, force a hook rerender, and assert the callback reference is unchanged.
2. Run `bun test src/lib/hooks/use-projects.test.ts`.
3. Expected RED: the two callback references differ under the current inline-function implementation.

### Task 2: Stabilize `refresh`

**Files:**
- Modify: `src/lib/hooks/use-projects.ts:27-36`

1. Use React `useCallback` around the existing `query.refetch()` operation.
2. Return the memoized callback without changing loading, error, or data semantics.
3. Run the focused test and expect GREEN.

### Task 3: Verify the request loop is gone

**Files:**
- Test: `src/lib/hooks/use-projects.test.ts`
- Observe: `src/components/tiles/QuickTileCreate.tsx:298-320`

1. Run the related unit tests, typecheck, and lint.
2. Start the local web and core services when available, open the dashboard in a browser, and confirm mounting/rerendering Quick Create does not repeatedly request `access/subjects?kind=1`.
3. Do not claim runtime verification if the local core service is unavailable; report that limitation explicitly.

No commit or deployment is performed without separate user authorization.
