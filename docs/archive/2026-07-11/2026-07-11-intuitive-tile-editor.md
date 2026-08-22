# Intuitive Tile Creation and Editing Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make tile creation and editing understandable without documentation while preserving the v1 API command flow.

**Architecture:** Convert the initial QuickTileCreate surface into a progressive disclosure form. A user enters a title, chooses “scheduled” or “recurring”, sets a clear time, and saves. Existing structural v1 fields remain available behind an “advanced settings” disclosure and continue to submit through the existing API adapter.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS v4, Vitest, Playwright, Bun.

---

### Task 1: Add user-centred create-form tests

**Files:**
- Create: `src/components/tiles/QuickTileCreate.test.tsx`
- Modify: `src/components/tiles/QuickTileCreate.tsx`

**Step 1: Write failing tests**
- Default view exposes a labelled title input and a primary “create tile” action.
- Scheduled tiles expose a date/time choice without requiring any internal v1 field.
- Advanced settings are hidden by default and keyboard-operable.

**Step 2: Run test to verify it fails**
Run: `bun test src/components/tiles/QuickTileCreate.test.tsx`
Expected: FAIL against the structural editor.

### Task 2: Implement progressive-disclosure creation and editing

**Files:**
- Modify: `src/components/tiles/QuickTileCreate.tsx`
- Test: `src/components/tiles/QuickTileCreate.test.tsx`

**Step 1: Implement minimal primary flow**
- Lead with title and a plain-language tile type selector.
- Make date/time visible only for a scheduled tile; show recurrence controls only for a recurring tile.
- Use concise, outcome-focused labels and inline validation.
- Preserve the existing store and submit flow; do not duplicate core business logic in the web client.

**Step 2: Move structural controls behind an accessible disclosure**
- Preserve existing advanced controls and edit-mode data hydration.
- Hide internal terms such as FrameRule, ChangeSet, and Window from the default path.

**Step 3: Run component tests**
Run: `bun test src/components/tiles/QuickTileCreate.test.tsx`
Expected: PASS.

### Task 3: Verify responsive browser behaviour and project gates

**Files:**
- Test: `e2e/` (only if an existing dashboard test fixture supports the flow)

**Step 1: Run static and unit checks**
Run: `bun run lint:biome; bun run lint; bun run typecheck; bun test src/components/tiles/QuickTileCreate.test.tsx`
Expected: PASS.

**Step 2: Run the app and verify**
- Open the dashboard at 320px and desktop width.
- Confirm the title field receives focus, the primary action is visible, and advanced settings are optional.
- Confirm no browser console errors.

**Acceptance criteria:**
- A first-time user can name, schedule or repeat, and save a tile without seeing v1 structural vocabulary.
- Edit opens the same understandable primary fields and retains advanced access.
- Keyboard and mobile usage work.
- Existing API command/event flow remains the only persistence path.
