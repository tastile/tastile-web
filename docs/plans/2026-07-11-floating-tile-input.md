# Floating Tile Input Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create one-time floating tiles from a title, required duration, and availability windows without forcing a Placement span.

**Architecture:** The default creation path creates a v1 Recurring Tile/Plan with a one-time active life and a Flow candidate; it does not create a manual Placement. The panel keeps its existing expandable sections: base summary, required duration, availability window, recurrence, and metadata. Placement-specific datetime controls are shown only when the user explicitly chooses a fixed placement.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Tastile v1 command API.

---

### Task 1: Prove floating input defaults

**Files:**
- Modify: `src/components/tiles/QuickTileCreate.test.tsx`
- Modify: `src/lib/stores/quick-create-store.test.ts`

1. Add failing tests proving a fresh form has no Placement span, is not all-day, exposes a required-duration panel, and exposes an availability-window panel.
2. Add a failing test proving the default kind is a one-time filling target rather than a fixed Placement.
3. Run focused Vitest tests; expect failure against the current default span/all-day UI.

### Task 2: Restore panel-led creation

**Files:**
- Modify: `src/components/tiles/QuickTileCreate.tsx`
- Modify: `src/lib/stores/quick-create-store.ts`
- Modify: `src/lib/i18n/translations.ts`

1. Remove prefilled start/end defaults from initial create state.
2. Restore panels for duration, availability, recurrence, and metadata to the base view; keep only domain-internal implementation detail under advanced settings.
3. Make “one-time filling target” the default. Its primary submission must create the Tile/Plan configuration, not a manual Placement.
4. Keep fixed placement as an explicit separate option; only that option exposes a start/end editor.
5. Make all-day available only when role is LABEL, never as the default for executable tiles.
6. Run focused tests and type checking.

### Task 3: Wire and prove the API path

**Files:**
- Modify: `src/lib/api/v1/tile-commands.ts`
- Modify: `src/lib/api/v1/tile-commands.test.ts`
- Modify: `src/components/tiles/QuickTileCreate.tsx`

1. Write a failing command test asserting the one-time path posts Tile/Plan/Flow configuration without a `POST /v1/placements` call.
2. Implement the minimal command sequence supported by the v1 API.
3. Verify request body carries duration and availability window; run focused API/component tests.
4. If the current v1 API cannot express this aggregate without a schema change, stop before inventing a client-side substitute and extend the core command surface in a separate plan.

**Acceptance criteria:**
- Default create has no prefilled placement datetime and no all-day state.
- A user can create a title-only floating tile and then configure duration/window through visible panels.
- The system, not the user, chooses Placement start/end.
- Fixed placement and LABEL remain explicit, separate paths.
