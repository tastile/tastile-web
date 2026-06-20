# Tastile Web Redesign — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the existing chrome (CommandShell + RailOverflow + AvatarMenu + dashboard-projection) with a Google Calendar-style shell (floating header + Activity Bar + Side Bar + Day timeline home), wired to real tastile-core API endpoints, with all design rules (no border / no shadow / color = accent only / 2-cushion drag / icon status).

**Architecture:** Server-precomputed calendar projections from `/views/calendar/{day|week|month|year}`. Side bar panels derive from tile `labels[]` (references / projects / recurring) — no first-class entities for those in the API. SSE sync via `/read/events/state` for multi-device. Tile editing via panel (modal-less, slides in from right), drag-edit with 2-cushion friction.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript + Tailwind v4. Vitest for tests. `useExecutionEngineContext` already wired — extend, don't replace. `getCoreClient()` already exists — use directly.

**Design source of truth:** `docs/plans/2026-06-20-tastile-web-redesign.md`.

---

## Task 1: Remove old chrome

**Files:**
- Delete: `src/components/shell/CommandShell.tsx`
- Delete: `src/components/shell/RailOverflow.tsx`
- Delete: `src/components/shell/AvatarMenu.tsx`
- Delete: `src/components/dashboard/ActivePhaseCanvas.tsx`
- Delete: `src/components/dashboard/QueueSection.tsx`
- Delete: `src/components/dashboard/TimelineRibbon.tsx`
- Delete: `src/components/execution/ConditionVector.tsx`
- Delete: `src/lib/projection/dashboard-projection.ts`
- Delete: `src/lib/stores/dashboard-workspace-store.ts`
- Modify: any file that imports the above (run a search and fix)

**Step 1.1: Find all import sites**

Run:
```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
grep -rn "CommandShell\|RailOverflow\|AvatarMenu\|ActivePhaseCanvas\|QueueSection\|TimelineRibbon\|ConditionVector\|dashboard-projection\|dashboard-workspace-store" src
```

Expected: list of files importing any of the above.

**Step 1.2: Delete the files**

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
rm src/components/shell/CommandShell.tsx
rm src/components/shell/RailOverflow.tsx
rm src/components/shell/AvatarMenu.tsx
rm src/components/dashboard/ActivePhaseCanvas.tsx
rm src/components/dashboard/QueueSection.tsx
rm src/components/dashboard/TimelineRibbon.tsx
rm src/components/execution/ConditionVector.tsx
rm src/lib/projection/dashboard-projection.ts
rm src/lib/stores/dashboard-workspace-store.ts
```

**Step 1.3: Fix import sites**

For each file from step 1.1:
- Remove the imports of deleted modules.
- Replace any usage with a TODO comment: `{/* TODO(new-shell): wire to new component */}`. Do NOT reimplement yet — Task 8 does that.

**Step 1.4: Verify it still typechecks (with placeholders)**

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun run typecheck
```

Expected: errors only about unresolved symbols that will be re-added later (this is OK for now). If there are unrelated errors, fix them.

**Step 1.5: Commit**

```bash
git add -A
git commit -m "chore(redesign): remove obsolete chrome components"
```

---

## Task 2: API hooks layer

**Files:**
- Create: `src/lib/hooks/use-calendar-projection.ts`
- Create: `src/lib/hooks/use-tile-list.ts`
- Create: `src/lib/hooks/use-active-tile.ts`
- Create: `src/lib/hooks/use-sse-sync.ts`
- Create: `src/lib/hooks/__tests__/use-calendar-projection.test.ts`
- Create: `src/lib/hooks/__tests__/use-tile-list.test.ts`
- Create: `src/lib/hooks/__tests__/use-active-tile.test.ts`

**Step 2.1: Write failing test for `useCalendarProjection`**

File `src/lib/hooks/__tests__/use-calendar-projection.test.ts`:

```ts
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useCalendarProjection } from "../use-calendar-projection";

vi.mock("@/lib/api/endpoints", () => ({
  getCoreClient: () => ({
    call: vi.fn().mockResolvedValue({
      ok: true,
      data: { view: "day", blocks: [], all_day_spans: [], overflow_counters: {}, month_summaries: [] },
      status: 200,
      latencyMs: 1,
    }),
  }),
}));

describe("useCalendarProjection", () => {
  it("returns a CalendarProjection from /views/calendar/{view}", async () => {
    const { result } = renderHook(() =>
      useCalendarProjection({ view: "day", anchor: "2026-06-18", tzOffset: 9 }),
    );
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.projection?.view).toBe("day");
    expect(result.current.error).toBeNull();
  });
});
```

**Step 2.2: Run, expect FAIL**

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun run test:unit -- use-calendar-projection.test.ts
```

Expected: FAIL with "Cannot find module '../use-calendar-projection'".

**Step 2.3: Implement `useCalendarProjection`**

File `src/lib/hooks/use-calendar-projection.ts`:

```ts
"use client";

import { useEffect, useState } from "react";
import { getCoreClient } from "@/lib/api/endpoints";

export type CalendarView = "day" | "week" | "month" | "year";

export interface CalendarBlockView {
  tile_id: string | null;
  title: string;
  kind: "work" | "break" | "label" | "scheduled";
  is_active: boolean;
  start_at: string;
  end_at: string;
  semantic_role: "work" | "break" | "label";
  all_day: boolean;
  ownership: "tastile_owned" | "remote_owned" | "synthetic";
  editable: boolean;
  source_label: string;
}

export interface CalendarProjectionView {
  view: CalendarView;
  range_start: string;
  range_end: string;
  grid_start: string;
  grid_end: string;
  blocks: CalendarBlockView[];
  all_day_spans: CalendarBlockView[];
  overflow_counters: Record<string, number>;
  month_summaries: unknown[];
}

export interface UseCalendarProjectionArgs {
  view: CalendarView;
  /** ISO date (YYYY-MM-DD) or full ISO timestamp */
  anchor: string;
  /** IANA tz offset in minutes (e.g. 540 for JST). */
  tzOffset: number;
}

export function useCalendarProjection(args: UseCalendarProjectionArgs) {
  const [projection, setProjection] = useState<CalendarProjectionView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      const res = await getCoreClient().call<CalendarProjectionView>(
        args.view === "day"
          ? "getCalendarDay"
          : args.view === "week"
            ? "getCalendarWeek"
            : args.view === "month"
              ? "getCalendarMonth"
              : "getCalendarYear",
        { query: { anchor: args.anchor, tz_offset: args.tzOffset } },
      );
      if (cancelled) return;
      if (res.ok) {
        setProjection(res.data);
        setLoading(false);
      } else {
        setError(new Error(res.error.message));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [args.view, args.anchor, args.tzOffset]);

  return { projection, loading, error };
}
```

**Step 2.4: Run, expect PASS**

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun run test:unit -- use-calendar-projection.test.ts
```

Expected: PASS.

**Step 2.5: Write + implement `useTileList`**

Add test file `use-tile-list.test.ts` with same pattern. Implement `src/lib/hooks/use-tile-list.ts` that calls `getTiles` (or `getTileListView`) with `{ view_mode, lifecycle, limit, search, exclude_future }` query params. Returns `{ tiles, nextActionableTileId, nextActionableStartAt, loading, error }`.

**Step 2.6: Write + implement `useActiveTile`**

Add test file `use-active-tile.test.ts`. Implement `src/lib/hooks/use-active-tile.ts` that calls `getExecutionView` and returns `{ snapshot: ExecutionView | null, loading, error }`.

**Step 2.7: Implement `useSseSync` (no test — SSE is hard to test in jsdom)**

File `src/lib/hooks/use-sse-sync.ts`:

```ts
"use client";

import { useEffect } from "react";

/**
 * Subscribes to the tastile-core state-event SSE stream. Calls `onEvent`
 * for every received event. Reconnects with exponential backoff on error.
 * Cleans up on unmount.
 */
export function useSseSync(opts: {
  accessToken: string;
  onEvent: (data: unknown) => void;
  enabled?: boolean;
}) {
  useEffect(() => {
    if (!opts.enabled && opts.enabled !== undefined) return;
    const base = process.env.NEXT_PUBLIC_TASTILE_CORE_URL ?? "http://127.0.0.1:3140";
    const url = new URL(`${base}/read/events/state`);
    url.searchParams.set("access_token", opts.accessToken);
    const es = new EventSource(url.toString());
    es.onmessage = (e) => {
      try {
        opts.onEvent(JSON.parse(e.data));
      } catch {
        /* malformed event — ignore */
      }
    };
    es.onerror = () => {
      es.close();
      // Naive reconnect after 3s. The browser will also auto-reconnect.
      setTimeout(() => {
        // Caller will re-render with a new useSseSync invocation if needed.
      }, 3000);
    };
    return () => es.close();
  }, [opts.accessToken, opts.enabled]);
}
```

**Step 2.8: Verify all hooks typecheck + tests pass**

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun run typecheck
bun run test:unit -- use-calendar-projection use-tile-list use-active-tile
```

Expected: clean.

**Step 2.9: Commit**

```bash
git add src/lib/hooks/use-calendar-projection.ts src/lib/hooks/use-tile-list.ts src/lib/hooks/use-active-tile.ts src/lib/hooks/use-sse-sync.ts src/lib/hooks/__tests__/
git commit -m "feat(api): add hooks for calendar projection, tile list, active tile, sse sync"
```

---

## Task 3: Client stores + projection utilities

**Files:**
- Create: `src/lib/stores/labels-store.ts`
- Create: `src/lib/stores/projects-store.ts`
- Create: `src/lib/projection/calendar-projection.ts`
- Create: `src/lib/projection/label-grouping.ts`
- Create: `src/lib/stores/__tests__/labels-store.test.ts`
- Create: `src/lib/stores/__tests__/projects-store.test.ts`
- Create: `src/lib/projection/__tests__/label-grouping.test.ts`

**Step 3.1: Test for `labels-store`**

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { useLabelsStore } from "../labels-store";

describe("labels-store", () => {
  beforeEach(() => useLabelsStore.setState({ labels: {} }));

  it("assigns auto-color from palette", () => {
    useLabelsStore.getState().ensureLabel("work");
    const c = useLabelsStore.getState().labels["work"];
    expect(c).toBeDefined();
    expect(c.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("uses user-set color when present", () => {
    useLabelsStore.getState().setColor("work", "#ff00ff");
    useLabelsStore.getState().ensureLabel("work");
    expect(useLabelsStore.getState().labels["work"].color).toBe("#ff00ff");
  });
});
```

**Step 3.2: Implement `labels-store.ts`**

```ts
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

const PALETTE = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#a855f7", // purple
  "#f97316", // orange
  "#ec4899", // pink
  "#06b6d4", // cyan
  "#eab308", // yellow
  "#ef4444", // red
  "#14b8a6", // teal
  "#6366f1", // indigo
  "#84cc16", // lime
  "#6b7280", // gray
];

interface LabelEntry {
  name: string;
  color: string;
}

interface LabelsState {
  labels: Record<string, LabelEntry>;
  ensureLabel: (name: string) => void;
  setColor: (name: string, color: string) => void;
  remove: (name: string) => void;
}

export const useLabelsStore = create<LabelsState>()(
  persist(
    (set, get) => ({
      labels: {},
      ensureLabel: (name) => {
        if (get().labels[name]) return;
        const used = new Set(Object.values(get().labels).map((l) => l.color));
        const next = PALETTE.find((c) => !used.has(c)) ?? PALETTE[0];
        set((s) => ({ labels: { ...s.labels, [name]: { name, color: next } } }));
      },
      setColor: (name, color) =>
        set((s) => ({ labels: { ...s.labels, [name]: { name, color } } })),
      remove: (name) =>
        set((s) => {
          const { [name]: _, ...rest } = s.labels;
          return { labels: rest };
        }),
    }),
    { name: "tastile.labels" },
  ),
);
```

**Step 3.3: Run, expect PASS**

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun run test:unit -- labels-store.test.ts
```

**Step 3.4: Implement `projects-store.ts`**

Mirrors labels-store but stores `Project { id, name, labelFilter: string[], color: string }`. Persistence key `tastile.projects`. Methods: `create`, `update`, `delete`.

**Step 3.5: Test + implement `label-grouping.ts`**

```ts
import { describe, expect, it } from "vitest";
import { groupTilesByLabel } from "../label-grouping";

describe("groupTilesByLabel", () => {
  it("returns unique labels sorted by count desc", () => {
    const tiles = [
      { labels: ["work", "urgent"] },
      { labels: ["work"] },
      { labels: ["personal"] },
    ] as any[];
    const groups = groupTilesByLabel(tiles);
    expect(groups.map((g) => g.name)).toEqual(["work", "urgent", "personal"]);
    expect(groups[0].count).toBe(2);
  });
});
```

Implement `src/lib/projection/label-grouping.ts`:

```ts
export interface LabelGroup {
  name: string;
  count: number;
  tileIds: string[];
}

export function groupTilesByLabel(tiles: { id: string; labels: string[] }[]): LabelGroup[] {
  const map = new Map<string, LabelGroup>();
  for (const t of tiles) {
    for (const label of t.labels) {
      const g = map.get(label) ?? { name: label, count: 0, tileIds: [] };
      g.count += 1;
      g.tileIds.push(t.id);
      map.set(label, g);
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count);
}
```

**Step 3.6: Implement `calendar-projection.ts`**

Utilities on top of the API response:
- `blocksByHour(projection, date): CalendarBlockView[]` — filter blocks to a specific date.
- `allDayBlocksFor(projection, date): CalendarBlockView[]`.
- `hourSlotsForDay(date: Date, tzOffset: number): Date[]` — returns 24 hour markers in the user's tz.

**Step 3.7: Verify**

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun run typecheck
bun run test:unit -- labels-store projects-store label-grouping
```

**Step 3.8: Commit**

```bash
git add src/lib/stores/labels-store.ts src/lib/stores/projects-store.ts src/lib/projection/calendar-projection.ts src/lib/projection/label-grouping.ts
git commit -m "feat(state): add labels + projects stores, label grouping projection"
```

---

## Task 4: Shell — FloatingHeader, ActivityBar, SideBar router

**Files:**
- Create: `src/components/shell/FloatingHeader.tsx`
- Create: `src/components/shell/ActivityBar.tsx`
- Create: `src/components/shell/SideBar.tsx`
- Create: `src/lib/stores/shell-store.ts`
- Create: `src/components/shell/__tests__/FloatingHeader.test.tsx`
- Create: `src/components/shell/__tests__/ActivityBar.test.tsx`

**Step 4.1: `shell-store.ts`**

```ts
"use client";

import { create } from "zustand";

export type SidePanel = "references" | "tasks" | "projects" | "schedule";

interface ShellState {
  panel: SidePanel;
  sideBarOpen: boolean;
  setPanel: (p: SidePanel) => void;
  toggleSideBar: () => void;
}

export const useShellStore = create<ShellState>()((set) => ({
  panel: "references",
  sideBarOpen: true,
  setPanel: (panel) => set({ panel, sideBarOpen: true }),
  toggleSideBar: () => set((s) => ({ sideBarOpen: !s.sideBarOpen })),
}));
```

**Step 4.2: Test FloatingHeader**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FloatingHeader } from "../FloatingHeader";

describe("FloatingHeader", () => {
  it("renders execution status and right-side icons", () => {
    render(
      <FloatingHeader
        execution={{
          is_working: true,
          is_on_break: false,
          is_idle: false,
          main_tile: { id: "x", title: "Quarterly plan" } as any,
          main_tile_started_at: "2026-06-20T05:00:00Z",
          main_tile_ends_at: "2026-06-20T05:25:00Z",
          tile_count: 1,
          event_count: 0,
          tiles_in_progress: [],
        }}
        userName="Operator"
        onOpenSearch={() => {}}
        onOpenNotifications={() => {}}
      />,
    );
    expect(screen.getByText(/Quarterly plan/)).toBeTruthy();
    expect(screen.getByLabelText("Open search")).toBeTruthy();
    expect(screen.getByLabelText("Open notifications")).toBeTruthy();
  });
});
```

**Step 4.3: Implement FloatingHeader**

File `src/components/shell/FloatingHeader.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { useActiveTile } from "@/lib/hooks/use-active-tile";
import { Bell, Search } from "lucide-react";

interface FloatingHeaderProps {
  userName: string;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
}

export function FloatingHeader({ userName, onOpenSearch, onOpenNotifications }: FloatingHeaderProps) {
  const { snapshot } = useActiveTile();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const main = snapshot?.main_tile;
  const ends = snapshot?.main_tile_ends_at ? new Date(snapshot.main_tile_ends_at) : null;
  const remainingSec = ends ? Math.max(0, Math.round((ends.getTime() - nowMs) / 1000)) : 0;
  const mm = Math.floor(remainingSec / 60).toString().padStart(2, "0");
  const ss = (remainingSec % 60).toString().padStart(2, "0");

  const status = snapshot?.is_idle ? "IDLE" : snapshot?.is_working ? "EXECUTING" : "IDLE";

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 flex h-12 items-center gap-3 bg-surface-0/70 px-4 backdrop-blur-md"
      role="banner"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 font-mono text-[11px] text-ink-2">
        <span aria-hidden className="text-ink-4">●</span>
        <span className="font-semibold">{status}</span>
        {main ? (
          <>
            <span aria-hidden className="text-ink-4">·</span>
            <span className="truncate text-ink-1">{main.title}</span>
            {ends ? (
              <>
                <span aria-hidden className="text-ink-4">·</span>
                <span className="tabular-nums">{mm}:{ss} left</span>
              </>
            ) : null}
          </>
        ) : null}
      </div>

      <button
        type="button"
        aria-label="Open search"
        onClick={onOpenSearch}
        className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink-1"
      >
        <Search className="h-4 w-4" />
      </button>

      <button
        type="button"
        aria-label="Open notifications"
        onClick={onOpenNotifications}
        className="rounded-md p-1.5 text-ink-3 hover:bg-surface-2 hover:text-ink-1"
      >
        <Bell className="h-4 w-4" />
      </button>

      <button
        type="button"
        aria-label="Open avatar menu"
        className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-fg"
      >
        {userName.charAt(0)}
      </button>
    </header>
  );
}
```

**Step 4.4: Test + implement ActivityBar**

ActivityBar renders the T logo + 4 icon buttons. Selected button shows a 2px accent bar on the left.

```tsx
"use client";

import { CalendarDays, CheckSquare, Layers, Repeat, type LucideIcon } from "lucide-react";
import { useShellStore, type SidePanel } from "@/lib/stores/shell-store";
import { cn } from "@/lib/utils/cn";

interface IconDef { panel: SidePanel; label: string; Icon: LucideIcon }

const ICONS: IconDef[] = [
  { panel: "references", label: "References", Icon: CalendarDays },
  { panel: "tasks", label: "Tasks", Icon: CheckSquare },
  { panel: "projects", label: "Projects", Icon: Layers },
  { panel: "schedule", label: "Schedule", Icon: Repeat },
];

export function ActivityBar() {
  const panel = useShellStore((s) => s.panel);
  const setPanel = useShellStore((s) => s.setPanel);

  return (
    <nav aria-label="Activity bar" className="flex w-12 shrink-0 flex-col items-stretch bg-surface-0">
      <a
        href="/dashboard"
        aria-label="tastile home"
        className="flex h-12 items-center justify-center"
      >
        <span className="grid h-6 w-6 place-items-center rounded bg-primary text-[11px] font-bold text-primary-fg">T</span>
      </a>
      {ICONS.map(({ panel: p, label, Icon }) => {
        const active = panel === p;
        return (
          <button
            key={p}
            type="button"
            aria-label={label}
            aria-current={active ? "true" : undefined}
            onClick={() => setPanel(p)}
            className={cn(
              "relative flex h-12 items-center justify-center text-ink-3 hover:bg-surface-2 hover:text-ink-1",
              active && "text-accent",
            )}
          >
            {active ? <span aria-hidden className="absolute inset-y-3 left-0 w-0.5 rounded-r-full bg-accent" /> : null}
            <Icon className="h-4 w-4" aria-hidden />
          </button>
        );
      })}
    </nav>
  );
}
```

**Step 4.5: Implement SideBar router**

```tsx
"use client";

import { useShellStore } from "@/lib/stores/shell-store";
import { ReferencesPanel } from "@/components/sidebar/ReferencesPanel";
import { TasksPanel } from "@/components/sidebar/TasksPanel";
import { ProjectsPanel } from "@/components/sidebar/ProjectsPanel";
import { SchedulePanel } from "@/components/sidebar/SchedulePanel";

export function SideBar() {
  const panel = useShellStore((s) => s.panel);
  const open = useShellStore((s) => s.sideBarOpen);

  if (!open) return null;

  return (
    <aside
      aria-label="Side panel"
      className="w-72 shrink-0 overflow-y-auto bg-surface-1 pt-12"
    >
      {panel === "references" ? <ReferencesPanel /> : null}
      {panel === "tasks" ? <TasksPanel /> : null}
      {panel === "projects" ? <ProjectsPanel /> : null}
      {panel === "schedule" ? <SchedulePanel /> : null}
    </aside>
  );
}
```

**Step 4.6: Commit shell scaffolding**

```bash
git add src/components/shell/FloatingHeader.tsx src/components/shell/ActivityBar.tsx src/components/shell/SideBar.tsx src/lib/stores/shell-store.ts
git commit -m "feat(shell): floating header + activity bar + side bar router"
```

Note: `SideBar` references panels that don't exist yet. That's fine — Task 5 adds them. To unblock typecheck during shell development, add stub files:

```tsx
// src/components/sidebar/{References,Tasks,Projects,Schedule}Panel.tsx
export function ReferencesPanel() { return <div>ReferencesPanel</div>; }
// ... same for the other three
```

These are placeholders. Real implementations land in Task 5.

---

## Task 5: Side bar panels (References, Tasks, Projects, Schedule)

**Files:**
- Rewrite: `src/components/sidebar/ReferencesPanel.tsx`
- Rewrite: `src/components/sidebar/TasksPanel.tsx`
- Rewrite: `src/components/sidebar/ProjectsPanel.tsx`
- Rewrite: `src/components/sidebar/SchedulePanel.tsx`
- Create: `src/lib/stores/reference-overlay-store.ts`
- Create: `src/components/sidebar/__tests__/ReferencesPanel.test.tsx`

**Step 5.1: `reference-overlay-store.ts`**

```ts
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface State {
  /** Set of label names currently visible on the timeline. */
  enabled: string[];
  toggle: (label: string) => void;
  enable: (label: string) => void;
  disable: (label: string) => void;
}

export const useReferenceOverlayStore = create<State>()(
  persist(
    (set, get) => ({
      enabled: [],
      toggle: (label) => {
        const e = new Set(get().enabled);
        if (e.has(label)) e.delete(label);
        else e.add(label);
        set({ enabled: Array.from(e) });
      },
      enable: (label) => set((s) => ({ enabled: Array.from(new Set([...s.enabled, label])) })),
      disable: (label) => set((s) => ({ enabled: s.enabled.filter((l) => l !== label) })),
    }),
    { name: "tastile.reference-overlay" },
  ),
);
```

**Step 5.2: Test + implement ReferencesPanel**

```tsx
// test
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ReferencesPanel } from "../ReferencesPanel";

vi.mock("@/lib/hooks/use-tile-list", () => ({
  useTileList: () => ({ tiles: [
    { id: "1", labels: ["work"], lifecycle: "ready" },
    { id: "2", labels: ["work"], lifecycle: "ready" },
    { id: "3", labels: ["personal"], lifecycle: "ready" },
  ], loading: false, error: null }),
}));

describe("ReferencesPanel", () => {
  it("groups tiles by label and shows counts", () => {
    render(<ReferencesPanel />);
    expect(screen.getByText("work")).toBeTruthy();
    expect(screen.getByText("personal")).toBeTruthy();
    expect(screen.getAllByText(/2/)).toBeTruthy();
  });
});
```

Implement ReferencesPanel:
- Pull tiles via `useTileList`.
- Derive label groups via `groupTilesByLabel`.
- Ensure each label has a color (`useLabelsStore.ensureLabel`).
- Render rows: colored dot + label name + tile count.
- Row click → toggle in `useReferenceOverlayStore`.
- If `enabled.length === 0` (first time), auto-enable the top 3.

**Step 5.3: Implement TasksPanel**

- Pull tiles via `useTileList({ view_mode: "list", limit: 200 })`.
- Group by `lifecycle` then by `due_at` bucket: Overdue / Today / This Week / Later / No date / Closed.
- Render row: status icon + title (mono) + duration + labels.
- Search input at top, debounced 250ms, calls `useTileList({ search })`.
- Click row → opens `<TileEditPanel>` (Task 7).

**Step 5.4: Implement ProjectsPanel**

- Pull from `useProjectsStore` (saved filters).
- "+ New project" → inline form: name + label multi-select + color.
- Each row: project name + tile count + last activity (from events SSE if available).
- Click → navigates Main to Day view with the project's labels applied as filter.

**Step 5.5: Implement SchedulePanel**

- Pull tiles via `useTileList({ view_mode: "list" })`.
- Client-side filter: `objective.objective_mode === "recurring"`.
- Each row: title + `recurrence.human_summary` + `projected_next_start_at` formatted.
- Click row → opens `<TileEditPanel>` with the recurrence section pre-expanded.

**Step 5.6: Verify**

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun run typecheck
bun run test:unit -- ReferencesPanel
```

**Step 5.7: Commit**

```bash
git add src/components/sidebar/ src/lib/stores/reference-overlay-store.ts
git commit -m "feat(sidebar): references / tasks / projects / schedule panels"
```

---

## Task 6: Calendar main + Day view + TileBlock

**Files:**
- Create: `src/components/calendar/CalendarMain.tsx`
- Create: `src/components/calendar/DayView.tsx`
- Create: `src/components/calendar/TileBlock.tsx`
- Create: `src/components/calendar/AllDayLane.tsx`
- Create: `src/components/calendar/__tests__/DayView.test.tsx`

**Step 6.1: Test DayView**

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DayView } from "../DayView";

vi.mock("@/lib/hooks/use-calendar-projection", () => ({
  useCalendarProjection: () => ({
    projection: {
      view: "day",
      blocks: [{
        tile_id: "t1", title: "Quarterly plan", kind: "work",
        is_active: false, start_at: "2026-06-18T00:00:00Z",
        end_at: "2026-06-18T00:25:00Z", semantic_role: "work",
        all_day: false, ownership: "tastile_owned",
        editable: true, source_label: "work",
      }],
      all_day_spans: [],
      overflow_counters: {},
      month_summaries: [],
    },
    loading: false,
    error: null,
  }),
}));

describe("DayView", () => {
  it("renders a tile block with title", () => {
    render(<DayView anchor="2026-06-18" tzOffset={540} />);
    expect(screen.getByText("Quarterly plan")).toBeTruthy();
  });
});
```

**Step 6.2: Implement DayView**

- Hooks: `useCalendarProjection({ view: "day", anchor, tzOffset })`.
- Compute 24 hour slots via `hourSlotsForDay(new Date(anchor), tzOffset)`.
- Render `<AllDayLane>` first (from `projection.all_day_spans`).
- Then render 24 rows: hour label on left, blocks overlaid on the right.
- "Now line": find the current hour/minute in `tzOffset`, draw a 1px line at that vertical position. Use `bg-accent`. Update each minute.
- Pass blocks through `<TileBlock>` for rendering.

**Step 6.3: Implement TileBlock**

Pure presentational. Props: `block: CalendarBlockView`, `onClick()`, `dimmed: boolean`.

```tsx
"use client";

import { CalendarBlockView } from "@/lib/hooks/use-calendar-projection";
import { useLabelsStore } from "@/lib/stores/labels-store";
import { cn } from "@/lib/utils/cn";

export function TileBlock({
  block,
  onClick,
  dimmed,
}: {
  block: CalendarBlockView;
  onClick: () => void;
  dimmed?: boolean;
}) {
  useLabelsStore.getState().ensureLabel(block.source_label);
  const color = useLabelsStore((s) => s.labels[block.source_label]?.color ?? "#6b7280");
  const notEditable = !block.editable;
  const start = new Date(block.start_at);
  const end = new Date(block.end_at);
  const minutes = Math.max(5, Math.round((end.getTime() - start.getTime()) / 60_000));

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={notEditable}
      style={{
        // @ts-expect-error CSS var
        "--accent": color,
        height: `${Math.max(20, minutes * 1.5)}px`,
        opacity: dimmed ? 0.3 : 1,
      }}
      className={cn(
        "relative w-full overflow-hidden rounded-md px-2 py-1 text-left",
        "bg-[color-mix(in_oklab,var(--accent)_8%,transparent)]",
        notEditable ? "cursor-default" : "hover:bg-[color-mix(in_oklab,var(--accent)_14%,transparent)]",
      )}
    >
      <span
        aria-hidden
        className="absolute inset-y-0 left-0 w-1 bg-[var(--accent)]"
      />
      <div className="text-xs font-medium text-ink-1">{block.title}</div>
      <div className="font-mono text-[10px] text-ink-3">
        {Math.round(minutes)}m
        {notEditable ? " · read-only" : ""}
      </div>
    </button>
  );
}
```

**Step 6.4: Implement AllDayLane**

Horizontal row at top of day view. Renders `all_day_spans` as small chips with the same color treatment.

**Step 6.5: Implement CalendarMain (view switcher)**

```tsx
"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayView } from "./DayView";
import { WeekView } from "./WeekView";
import { MonthView } from "./MonthView";
import { YearView } from "./YearView";

export type CalendarView = "day" | "week" | "month" | "year";

export function CalendarMain({ initialView = "day" }: { initialView?: CalendarView }) {
  const [view, setView] = useState<CalendarView>(initialView);
  const [anchor, setAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const tzOffset = new Date().getTimezoneOffset() * -1; // minutes east of UTC

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center gap-3 px-4">
        <button onClick={() => shiftAnchor(setAnchor, view, -1)} aria-label="Previous">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="font-mono text-sm text-ink-1">{formatAnchor(view, anchor)}</h2>
        <button onClick={() => shiftAnchor(setAnchor, view, 1)} aria-label="Next">
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="ml-auto flex gap-1 rounded-md bg-surface-1 p-0.5">
          {(["day", "week", "month", "year"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider",
                view === v ? "bg-surface-2 text-ink-1" : "text-ink-3 hover:text-ink-1",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {view === "day" ? <DayView anchor={anchor} tzOffset={tzOffset} /> : null}
        {view === "week" ? <WeekView anchor={anchor} tzOffset={tzOffset} /> : null}
        {view === "month" ? <MonthView anchor={anchor} tzOffset={tzOffset} /> : null}
        {view === "year" ? <YearView anchor={anchor} tzOffset={tzOffset} /> : null}
      </div>
    </div>
  );
}

function shiftAnchor(setAnchor: (s: string) => void, view: CalendarView, delta: -1 | 1) {
  // … date math per view (day +1/-1, week +7/-7, etc.)
}

function formatAnchor(view: CalendarView, anchor: string): string {
  // … pretty-print per view
}
```

**Step 6.6: Verify**

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun run typecheck
bun run test:unit -- DayView
```

**Step 6.7: Commit**

```bash
git add src/components/calendar/
git commit -m "feat(calendar): day view + tile block + all-day lane + main switcher"
```

---

## Task 7: Week / Month / Year views + Tile edit panel + Search + Notifications

**Files:**
- Create: `src/components/calendar/WeekView.tsx`
- Create: `src/components/calendar/MonthView.tsx`
- Create: `src/components/calendar/YearView.tsx`
- Create: `src/components/tile/TileEditPanel.tsx`
- Create: `src/components/tile/TileEditPanel.Recurrence.tsx`
- Create: `src/components/tile/TileEditPanel.Conditions.tsx`
- Create: `src/components/search/SearchOverlay.tsx`
- Create: `src/components/notifications/NotificationsDropdown.tsx`

**Step 7.1: WeekView**

- `useCalendarProjection({ view: "week", anchor, tzOffset })`.
- Render 7 columns (Mon-Sun), 24 rows per column.
- Each column gets the day's blocks stacked.
- Use `<TileBlock>` per block.

**Step 7.2: MonthView**

- `useCalendarProjection({ view: "month", anchor, tzOffset })`.
- 7×6 grid (or 7×5 depending on month).
- Each cell shows up to 3 block chips + "+ N more" from `overflow_counters`.

**Step 7.3: YearView**

- `useCalendarProjection({ view: "year", anchor, tzOffset })`.
- 12 mini-month grids. Each shows block counts per day.

**Step 7.4: TileEditPanel**

Modal-less, slides in from right. w-96. Backdrop dim (5% black).

State: `open: boolean`, `mode: "create" | "edit"`, `tile: TileView | null`, `draft: EditableTileView | null`.

Top section (always):
- Title (required)
- Start/End (auto-snapped)
- Reference labels (chip multi-select)

Progressive disclosure (collapsed by default in create, expanded in edit):
- ▸ Repeat
- ▸ Conditions (7 layers)
- ▸ Notes (memo)
- ▸ Color override

Footer: `[Delete]` (edit only) | `[Cancel]` `[Save ⏎]`.

Conflict resolution dropdown: shown only when overlapping blocks exist; uses `CreateTileRequest.conflict_resolution` enum.

**Step 7.5: SearchOverlay**

- Triggered by FloatingHeader's 🔍 or `⌘K`.
- Floating top-center, w-[600px], bg-surface-1.
- Input → `useTileList({ search })` (debounced 200ms).
- Results: tiles + pages (from a static list of 17 dashboard routes).
- Arrow keys navigate, Enter focuses/opens, ESC closes.

**Step 7.6: NotificationsDropdown**

- Triggered by FloatingHeader's 🔔.
- Backed by `useSseSync` events buffered client-side.
- Renders last 20 events with relative timestamps.

**Step 7.7: Verify + commit**

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun run typecheck
bun run test:unit
git add -A
git commit -m "feat(calendar,tile,search): week/month/year views, edit panel, search, notifications"
```

---

## Task 8: Wire layout + dashboard pages

**Files:**
- Rewrite: `src/app/dashboard/layout.tsx`
- Rewrite: `src/app/dashboard/layout-client.tsx`
- Rewrite: `src/app/dashboard/page.tsx`
- Modify: `src/app/dashboard/execute/page.tsx`
- Modify: `src/app/dashboard/calendar/day/page.tsx` (new — renders CalendarMain view=day with custom anchor)
- Modify: `src/app/dashboard/calendar/week/page.tsx`
- Modify: `src/app/dashboard/calendar/month/page.tsx`
- Modify: `src/app/dashboard/calendar/year/page.tsx`
- Modify: `src/app/dashboard/tiles/page.tsx` (renders `<TasksPanel>` as full page)
- Modify: `src/app/dashboard/timeline/page.tsx` (renders CalendarMain view=day for arbitrary date)
- Modify: `src/app/dashboard/{prompts,breaks,history,events,quota,runtime,integrations,projects}/page.tsx` — leave mostly alone, just wrap with the new shell

**Step 8.1: Rewrite `layout-client.tsx`**

```tsx
"use client";

import { ExecutionEngineProvider } from "@/lib/hooks/execution-engine-context";
import { FloatingHeader } from "@/components/shell/FloatingHeader";
import { ActivityBar } from "@/components/shell/ActivityBar";
import { SideBar } from "@/components/shell/SideBar";
import { SecurityLockGate } from "@/components/security/SecurityLockGate";
import { GlobalPromptBanner } from "@/components/execution/GlobalPromptBanner";
import { QuickTileCreate } from "@/components/tiles/QuickTileCreate";
import { SearchOverlay } from "@/components/search/SearchOverlay";
import { NotificationsDropdown } from "@/components/notifications/NotificationsDropdown";
import { TileEditPanel } from "@/components/tile/TileEditPanel";

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ExecutionEngineProvider>
      <SecurityLockGate>
        <GlobalPromptBanner ... />
        <div className="flex h-screen flex-col bg-background">
          <FloatingHeader
            userName="Operator"
            onOpenSearch={() => openSearch()}
            onOpenNotifications={() => openNotifications()}
          />
          <div className="flex min-h-0 flex-1 pt-12">
            <ActivityBar />
            <SideBar />
            <main className="min-w-0 flex-1 overflow-hidden bg-surface-0">
              {children}
            </main>
          </div>
        </div>
        <QuickTileCreate />
        <SearchOverlay />
        <NotificationsDropdown />
        <TileEditPanel />
      </SecurityLockGate>
    </ExecutionEngineProvider>
  );
}
```

**Step 8.2: Rewrite `dashboard/page.tsx`**

```tsx
import { CalendarMain } from "@/components/calendar/CalendarMain";
export default function Page() {
  return <CalendarMain initialView="day" />;
}
```

**Step 8.3: Update other pages**

For each dashboard route, the page body just renders the appropriate view component. Remove the old PageHeader + Pill chrome (replaced by CalendarMain's own toolbar).

For `execute/page.tsx`: render `<CalendarMain initialView="day" />` filtered to the active tile.

For `tiles/page.tsx`: render the `<TasksPanel>` directly as a full-page view (no header bar).

For `timeline/page.tsx`: render `<CalendarMain initialView="day" />` with arbitrary date.

For `calendar/{day|week|month|year}/page.tsx`: render `<CalendarMain initialView="..." />` with `anchor` from URL query.

**Step 8.4: Verify**

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun run typecheck
bun run lint
bun run build
```

Expected: 17+ dashboard routes generate. No new lint errors.

**Step 8.5: Commit**

```bash
git add -A
git commit -m "feat(layout): wire new shell across dashboard pages"
```

---

## Task 9: Verification + polish

**Files:** none added. Fix issues found.

**Step 9.1: Run full verification suite**

```bash
cd C:/Users/rebui/Desktop/tastile/tastile-web
bun run typecheck
bun run lint
bun run test:unit
bun run build
```

Expected: all green.

**Step 9.2: Browser smoke (Chrome DevTools MCP)**

Verify:
1. `/dashboard` renders Day calendar projection with vertical time-of-day + now-line.
2. Floating header overlays the top with backdrop-blur.
3. Activity Bar shows T logo + 4 icons, click switches side panel.
4. Side Bar shows References panel by default with label checkboxes.
5. Click empty time → TileEditPanel slides in (create mode), title empty, time pre-filled.
6. Click existing tile → TileEditPanel slides in (edit mode), values pre-filled.
7. Drag empty area → ghost → drop → TileEditPanel with range.
8. Click tile once → focus state. Click again + drag → move (after 5px). Release → persists.
9. Switch Day/Week/Month/Year → each loads projection.
10. Toggle reference off → tile dims to 30% alpha.
11. `⌘K` opens search overlay, type → server-side results appear.
12. `🔔` opens notifications dropdown.
13. Avatar menu opens with profile/settings/billing/theme/sign-out.
14. Offline simulation: stop network → ⚠ appears, cached tiles still render.
15. 2-cushion drag: try to drag without 2 clicks → nothing happens.

**Step 9.3: Fix any issues**

For each issue, apply a minimal fix. Don't refactor unrelated code.

**Step 9.4: Final commit**

```bash
git add -A
git commit -m "fix(redesign): polish browser smoke issues"
```

---

## Done criteria

- All 9 tasks complete.
- `bun run typecheck`, `bun run lint`, `bun run test:unit`, `bun run build` all green.
- Browser smoke shows the design matches the validated plan.
- No regressions in existing functionality (auth, security, prompts, billing).
