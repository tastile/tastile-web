# tastile-web カレンダー実機能化

> **2026-06-29**。`/dashboard/calendar` を実データで駆動する。
> スコープ: **Read (E2E) + Create (Quick / ダブルクリック) + Edit (title / span / description) + Start / Complete**。
> ドラッグ / リサイズ / Year ビュー / 詳細ドラッグ移動は次フェーズ。

---

## 背景 (なぜ今やるか)

`/dashboard/calendar` の現状:

- `CalendarMain` / `DayView` / `WeekView` / `MonthView` / `AllDayLane` / `TileBlock` は UI 骨格あり
- `useCalendarProjection` フックが `/v1/calendar/{view}` を叩く
- しかし **契約不一致**:
  - バックエンド (`crates/v1/api/...commands.rs:1043`) は `?start=&end=` の 2 パラメータで `Vec<TimelineItem>` を返す
  - フロントエンド (`use-calendar-projection.ts:64`) は `?anchor=&tz_offset=` を送っている
  - フロントエンドの型 `CalendarProjectionView` はバックエンドが返さない形 (`blocks` / `all_day_spans`)
- 結果: 起動すると **404 相当 / 型不一致 / 表示が空** になる
- 加えて「タイル作成が動かない」 (`TileEditPanel` の create 経路は `createTileCommand` のみで span を渡せない)

ユーザー指示:
- E2E 通電
- Google カレンダー相当 (= Read + Create + Edit + Start / Complete、ドラッグは要らない)
- タイル作成も動かせる

---

## ゴール

`/dashboard/calendar` で:

1. **Read**: バックエンド `/v1/calendar/{day,week,month}` を叩き、Effective Placement を日 / 週 / 月グリッドに表示
2. **Create**: 空きスロット (DayView / WeekView) をシングル / ダブルクリック → QuickTile 作成モーダルが開き、start / end を初期値にして保存 → 一覧 / カレンダーに反映
3. **Edit**: タイルクリック → 既存 `TileEditPanel` を流用して title / span (start, end) / description を編集 → 保存
4. **Start / Complete**: 編集パネル内に Start / Complete ボタン (既存 `useExecutionEngine` 経由)

---

## アーキテクチャ

```
┌────────────────────────────────────────────────────────────────────┐
│ /dashboard/calendar/[view]                                         │
│   └─ <CalendarMain initialView>                                    │
│        ├─ <DayView> / <WeekView> / <MonthView>                     │
│        │    └─ useCalendarProjection({view, anchor, tzOffset})     │
│        │         └─ resolveWindowForView() → {start, end} UTC ISO  │
│        │         └─ getCoreClient().call("getCalendarDay",         │
│        │              { query: { start, end } })                  │
│        │         └─ timelineResponseToBlocks(items) → blocks[]     │
│        ├─ <AllDayLane spans={allDay}>                              │
│        ├─ <TileBlock block onClick={openEdit(block)}>              │
│        └─ (空セル click) QuickCreateAt(start, end)                 │
└────────────────────────────────────────────────────────────────────┘

       backend:  GET /v1/calendar/{day,week,month}?start=&end=
                  (already wired, forwards to get_timeline → Vec<TimelineItem>)

       edit:     TileEditPanel (既存) + クリック経路 from TileBlock
       create:   QuickCreateAt(slotStart, slotEnd) → 既存 QuickTileCreate モーダル
       start:    useExecutionEngine().start(tileId) (既存)
       complete: useExecutionEngine().complete(tileId) (既存)
```

触らない:
- `tastile-core` の calendar_* ハンドラ (プローブ実装で forward しているだけ)
- `tastile-core` の v1 domain / storage / api の構造
- `@dnd-kit` / ドラッグ移動 / リサイズ
- Year ビュー (placeholder のまま)
- 既存テスト (`useTileList` / `useRecurringTemplates` 等)

---

## 変更ファイル一覧

| 種類 | ファイル |
| --- | --- |
| 新規 | `src/lib/domain/v1/timeline-item.ts` (TimelineItem 型定義) |
| 新規 | `src/lib/projection/timeline-to-blocks.ts` (TimelineItem[] → CalendarBlockView[] 投影) |
| 新規 | `src/lib/projection/timeline-to-blocks.test.ts` |
| 変更 | `src/lib/hooks/use-calendar-projection.ts` (クエリ + 戻り値型) |
| 変更 | `src/lib/projection/calendar-projection.ts` (依存型を新アタプタに切替) |
| 変更 | `src/components/calendar/CalendarMain.tsx` (空セル click ハンドラ追加) |
| 変更 | `src/components/calendar/DayView.tsx` (新クエリ + 空セル click) |
| 変更 | `src/components/calendar/WeekView.tsx` (同上) |
| 変更 | `src/components/calendar/MonthView.tsx` (同上) |
| 変更 | `src/components/calendar/TileBlock.tsx` (click → openEdit 経路) |
| 変更 | `src/components/tile/TileEditPanel.tsx` (start / end 保存 + Start / Complete ボタン) |

---

## Task 1: TimelineItem 型定義

**Files:**
- Create: `src/lib/domain/v1/timeline-item.ts`
- Create: `src/lib/domain/v1/timeline-item.test.ts`

**Step 1: Write failing test**

`src/lib/domain/v1/timeline-item.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import type { TimelineItem } from "./timeline-item";

const sample: TimelineItem = {
  placement_id: "00000000-0000-0000-0000-000000000001",
  revision: 1,
  content: { title: "Write plan", description: null },
  visual: { color: "#5e6ad2", icon: "check" },
  role: 0,
  span: { start: "2026-06-29T08:00:00Z", end: "2026-06-29T09:00:00Z" },
  inside: null,
  source: { kind: 0, detail: null },
  resolution: { state: 0, resolved_at: "2026-06-29T07:00:00Z", resolution_hash: "h", violations: [] },
};

describe("TimelineItem", () => {
  it("accepts minimal executable placement", () => {
    expect(sample.role).toBe(0);
    expect(sample.span.start).toBe("2026-06-29T08:00:00Z");
  });
});
```

**Step 2: Run failing test**

Run: `bun test src/lib/domain/v1/timeline-item.test.ts`
Expected: FAIL (module not found)

**Step 3: Create type file**

`src/lib/domain/v1/timeline-item.ts`:

```typescript
/**
 * v1 TimelineItem — tastile-core/v1/domain/src/read.rs §TimelineItem
 * Response of /v1/calendar/{day,week,month} (which forwards to /v1/timeline).
 */

export interface TimelineItemContent {
  title: string;
  description: string | null;
}

export interface TimelineItemVisual {
  color: string | null;
  icon: string | null;
}

export interface TimelineItemInside {
  parent: string;
  scope: number;
}

export interface TimelineItemSource {
  kind: number;
  detail: string | null;
}

export interface TimelineItemResolution {
  state: number;
  resolved_at: string;
  resolution_hash: string;
  violations: Array<{ kind: number; message: string; current_revision: number | null }>;
}

export interface TimelineItem {
  placement_id: string;
  revision: number;
  content: TimelineItemContent;
  visual: TimelineItemVisual;
  role: number;
  span: { start: string; end: string };
  inside: TimelineItemInside | null;
  source: TimelineItemSource;
  resolution: TimelineItemResolution;
}
```

**Step 4: Run passing test**

Run: `bun test src/lib/domain/v1/timeline-item.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add src/lib/domain/v1/timeline-item.ts src/lib/domain/v1/timeline-item.test.ts
git commit -m "feat(calendar): add TimelineItem domain type"
```

---

## Task 2: TimelineItem → CalendarBlockView アダプタ

**Files:**
- Create: `src/lib/projection/timeline-to-blocks.ts`
- Create: `src/lib/projection/timeline-to-blocks.test.ts`

**Step 1: Write failing tests**

`src/lib/projection/timeline-to-blocks.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { timelineResponseToBlocks } from "./timeline-to-blocks";
import type { TimelineItem } from "@/lib/domain/v1/timeline-item";

const item = (overrides: Partial<TimelineItem> = {}): TimelineItem => ({
  placement_id: "p1",
  revision: 1,
  content: { title: "x", description: null },
  visual: { color: null, icon: null },
  role: 0,
  span: { start: "2026-06-29T08:00:00Z", end: "2026-06-29T09:00:00Z" },
  inside: null,
  source: { kind: 0, detail: null },
  resolution: { state: 0, resolved_at: "2026-06-29T07:00:00Z", resolution_hash: "h", violations: [] },
  ...overrides,
});

describe("timelineResponseToBlocks", () => {
  it("returns empty for empty input", () => {
    expect(timelineResponseToBlocks([])).toEqual({ blocks: [], allDaySpans: [] });
  });

  it("places timed placement (start and end on same date) in blocks", () => {
    const r = timelineResponseToBlocks([item()]);
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0]?.tile_id).toBe("p1");
    expect(r.blocks[0]?.title).toBe("x");
    expect(r.allDaySpans).toHaveLength(0);
    expect(r.blocks[0]?.all_day).toBe(false);
  });

  it("places label role (1) in allDaySpans", () => {
    const r = timelineResponseToBlocks([item({ role: 1 })]);
    expect(r.blocks).toHaveLength(0);
    expect(r.allDaySpans).toHaveLength(1);
    expect(r.allDaySpans[0]?.semantic_role).toBe("label");
  });

  it("places multi-day placement in allDaySpans", () => {
    const r = timelineResponseToBlocks([
      item({ span: { start: "2026-06-29T20:00:00Z", end: "2026-06-30T02:00:00Z" } }),
    ]);
    expect(r.allDaySpans).toHaveLength(1);
    expect(r.blocks).toHaveLength(0);
  });

  it("marks active state (resolution.state === 0) as is_active true", () => {
    const r = timelineResponseToBlocks([item({ resolution: {
      state: 0, resolved_at: "2026-06-29T07:00:00Z", resolution_hash: "h", violations: [],
    }})]);
    expect(r.blocks[0]?.is_active).toBe(true);
  });

  it("marks blocked state (resolution.state === 2) with violations as is_active false and source synthetic", () => {
    const r = timelineResponseToBlocks([item({
      resolution: {
        state: 2,
        resolved_at: "2026-06-29T07:00:00Z",
        resolution_hash: "h",
        violations: [{ kind: 6, message: "CONFLICT", current_revision: null }],
      },
    })]);
    expect(r.blocks[0]?.is_active).toBe(false);
    expect(r.blocks[0]?.ownership).toBe("synthetic");
  });
});
```

**Step 2: Run failing test**

Run: `bun test src/lib/projection/timeline-to-blocks.test.ts`
Expected: FAIL (module not found)

**Step 3: Implement adapter**

`src/lib/projection/timeline-to-blocks.ts`:

```typescript
import type { TimelineItem } from "@/lib/domain/v1/timeline-item";

export type CalendarBlockKind = "work" | "break" | "label" | "scheduled";
export type SemanticRole = "work" | "break" | "label";
export type Ownership = "tastile_owned" | "remote_owned" | "synthetic";

export interface CalendarBlockView {
  tile_id: string | null;
  title: string;
  kind: CalendarBlockKind;
  is_active: boolean;
  start_at: string;
  end_at: string;
  semantic_role: SemanticRole;
  all_day: boolean;
  ownership: Ownership;
  editable: boolean;
  source_label: string;
}

export interface TimelineProjection {
  blocks: CalendarBlockView[];
  allDaySpans: CalendarBlockView[];
}

const PlanRole = { EXECUTABLE: 0, LABEL: 1 } as const;
const ResolutionState = { OPEN: 0, CLOSED: 1, BLOCKED: 2 } as const;

function dateKey(iso: string): string {
  return iso.slice(0, 10);
}

function isAllDay(item: TimelineItem): boolean {
  if (item.role === PlanRole.LABEL) return true;
  return dateKey(item.span.start) !== dateKey(item.span.end);
}

function roleToKind(role: number): CalendarBlockKind {
  switch (role) {
    case PlanRole.LABEL: return "label";
    default: return "work";
  }
}

function roleToSemantic(role: number): SemanticRole {
  switch (role) {
    case PlanRole.LABEL: return "label";
    default: return "work";
  }
}

function ownershipFor(state: number): Ownership {
  if (state === ResolutionState.BLOCKED) return "synthetic";
  return "tastile_owned";
}

export function timelineResponseToBlocks(items: TimelineItem[]): TimelineProjection {
  const blocks: CalendarBlockView[] = [];
  const allDaySpans: CalendarBlockView[] = [];
  for (const it of items) {
    const isActive = it.resolution.state === ResolutionState.OPEN;
    const block: CalendarBlockView = {
      tile_id: it.placement_id,
      title: it.content.title,
      kind: roleToKind(it.role),
      is_active: isActive,
      start_at: it.span.start,
      end_at: it.span.end,
      semantic_role: roleToSemantic(it.role),
      all_day: isAllDay(it),
      ownership: ownershipFor(it.resolution.state),
      editable: it.role === PlanRole.EXECUTABLE,
      source_label: it.visual.icon ?? "tile",
    };
    if (block.all_day) allDaySpans.push(block);
    else blocks.push(block);
  }
  return { blocks, allDaySpans };
}
```

**Step 4: Run passing test**

Run: `bun test src/lib/projection/timeline-to-blocks.test.ts`
Expected: PASS (6 tests)

**Step 5: Commit**

```bash
git add src/lib/projection/timeline-to-blocks.ts src/lib/projection/timeline-to-blocks.test.ts
git commit -m "feat(calendar): add TimelineItem -> CalendarBlockView adapter"
```

---

## Task 3: useCalendarProjection の契約切替

**Files:**
- Modify: `src/lib/hooks/use-calendar-projection.ts`

**Step 1: Update hook to send start/end and decode TimelineItem[]**

Replace the body (after the type definitions) with:

```typescript
import { useEffect, useState } from "react";
import { getCoreClient } from "@/lib/api/endpoints";
import type { TimelineItem } from "@/lib/domain/v1/timeline-item";
import {
  timelineResponseToBlocks,
  type CalendarBlockView,
  type TimelineProjection,
} from "@/lib/projection/timeline-to-blocks";

export type { CalendarBlockView } from "@/lib/projection/timeline-to-blocks";
export type CalendarView = "day" | "week" | "month" | "year";

export interface UseCalendarProjectionArgs {
  view: "day" | "week" | "month" | "year";
  anchor: string;
  tzOffset: number;
}

interface HookState {
  projection: TimelineProjection | null;
  loading: boolean;
  error: Error | null;
}

export function resolveWindowForView(
  view: "day" | "week" | "month" | "year",
  anchor: string,
  tzOffsetMinutes: number,
): { start: string; end: string } {
  const [y, m, d] = anchor.split("-").map(Number);
  const startUtcMs = Date.UTC(y, m - 1, d, 0, 0, 0) - tzOffsetMinutes * 60_000;
  const start = new Date(startUtcMs);
  const end = new Date(startUtcMs);
  switch (view) {
    case "day": end.setUTCDate(end.getUTCDate() + 1); break;
    case "week": end.setUTCDate(end.getUTCDate() + 7); break;
    case "month": end.setUTCMonth(end.getUTCMonth() + 1); break;
    case "year": end.setUTCFullYear(end.getUTCFullYear() + 1); break;
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

export function useCalendarProjection(args: UseCalendarProjectionArgs) {
  const [state, setState] = useState<HookState>({ projection: null, loading: true, error: null });

  useEffect(() => {
    let cancelled = false;
    async function fetch_() {
      const endpointKey =
        args.view === "day" ? "getCalendarDay"
          : args.view === "week" ? "getCalendarWeek"
          : args.view === "month" ? "getCalendarMonth"
          : "getCalendarYear";
      const { start, end } = resolveWindowForView(args.view, args.anchor, args.tzOffset);
      const res = await getCoreClient().call<TimelineItem[]>(endpointKey, {
        query: { start, end },
      });
      if (cancelled) return;
      setState(
        res.ok
          ? { projection: timelineResponseToBlocks(res.data), loading: false, error: null }
          : { projection: null, loading: false, error: new Error(res.error.message) },
      );
    }
    setState((prev) => ({ ...prev, loading: true, error: null }));
    void fetch_();
    return () => { cancelled = true; };
  }, [args.view, args.anchor, args.tzOffset]);

  return state;
}
```

**Step 2: Typecheck**

Run: `bun run typecheck`
Expected: 既存コンポーネントが `CalendarProjectionView` を import している箇所で型エラー → 次の Task で修正

**Step 3: Commit**

```bash
git add src/lib/hooks/use-calendar-projection.ts
git commit -m "refactor(calendar): switch useCalendarProjection to timeline /v1 contract"
```

---

## Task 4: DayView / WeekView / MonthView の依存切替

**Files:**
- Modify: `src/lib/projection/calendar-projection.ts`
- Modify: `src/components/calendar/DayView.tsx`
- Modify: `src/components/calendar/WeekView.tsx`
- Modify: `src/components/calendar/MonthView.tsx`

**Step 1: Update calendar-projection helper to read from new shape**

`src/lib/projection/calendar-projection.ts`:

```typescript
import type { TimelineProjection } from "./timeline-to-blocks";

export function blocksForDate(p: TimelineProjection, dateStr: string) {
  return p.blocks.filter((b) => {
    const s = b.start_at.slice(0, 10);
    const e = b.end_at.slice(0, 10);
    return s <= dateStr && e >= dateStr;
  });
}

export function allDayBlocksFor(p: TimelineProjection, dateStr: string) {
  return p.allDaySpans.filter((b) => {
    const s = b.start_at.slice(0, 10);
    const e = b.end_at.slice(0, 10);
    return s <= dateStr && e >= dateStr;
  });
}

export function hourSlotsForDay(dateStr: string, tzOffsetMinutes: number): Date[] {
  const [year, month, day] = dateStr.split("-").map(Number);
  const slots: Date[] = [];
  for (let h = 0; h < 24; h++) {
    const utcMs = Date.UTC(year, month - 1, day, h, 0, 0) - tzOffsetMinutes * 60_000;
    slots.push(new Date(utcMs));
  }
  return slots;
}
```

**Step 2: Update DayView to call openEdit via tileId and start/end**

In `src/components/calendar/DayView.tsx`:

- Replace the `useTileEditStore` import & `openEdit` call to also pass `start_at` and `end_at` strings instead of empty.
- Replace `openEdit(block.tile_id, block.title, block.start_at, block.end_at || "", [])` to pass `block.start_at, block.end_at`.

(The existing call already passes start_at / end_at — verify it now reaches the new block shape. The `blocksForDate` returns the new `CalendarBlockView`; the click handler in DayView already destructures `block.tile_id`, `block.title`, `block.start_at`, `block.end_at || ""`. Keep that — no source change beyond the import. The bug was the underlying type; the JSX works once types align.)

Add an empty-slot click handler:

```tsx
const openCreate = useQuickCreateStore((s) => s.open);

// inside the right-side grid, add onClick={(e) => {
//   const target = e.currentTarget;
//   const rect = target.getBoundingClientRect();
//   const minutes = e.clientY - rect.top;
//   const slot = hourSlotsForDay(anchor, tzOffset)[hour];
//   const startIso = new Date(slot.getTime() + minutes * 60_000).toISOString();
//   const endIso = new Date(slot.getTime() + minutes * 60_000 + 30 * 60_000).toISOString();
//   openCreate({ defaultStart: startIso, defaultEnd: endIso });
// }}
```

(Implementation: each hour cell gets an onClick that opens the QuickCreate store with the clicked time. Implemented in Task 6.)

**Step 3: WeekView, MonthView — read side**

`WeekView.tsx` and `MonthView.tsx`: import the new `TimelineProjection` shape (their projection source already comes from `useCalendarProjection`; the return type is now `TimelineProjection`). The helper functions `blocksForDate` / `allDayBlocksFor` already accept `TimelineProjection`. No further changes besides the type import. Verify by running typecheck.

**Step 4: Typecheck + existing tests**

Run: `bun run typecheck && bun test`
Expected: typecheck clean, all tests pass

**Step 5: Commit**

```bash
git add src/lib/projection/calendar-projection.ts \
        src/components/calendar/DayView.tsx \
        src/components/calendar/WeekView.tsx \
        src/components/calendar/MonthView.tsx
git commit -m "refactor(calendar): adapt view components to TimelineProjection shape"
```

---

## Task 5: TileBlock クリック → 編集パネル

**Files:**
- Modify: `src/components/calendar/TileBlock.tsx`

**Step 1: Inspect existing TileBlock**

Read the current file. Confirm it accepts `block: CalendarBlockView` and renders title / time. No source change needed if the type already imports from the new adapter.

**Step 2: Verify click propagation**

The current DayView wraps TileBlock in an onClick that calls `openEdit`. If TileBlock itself has an inner button, ensure `e.stopPropagation()` is set so the parent cell's onClick does not also fire.

If needed, add at the top of `TileBlock`'s root element: `onClick={(e) => e.stopPropagation()}`. (Read the current TileBlock first to apply minimally.)

**Step 3: Typecheck**

Run: `bun run typecheck`
Expected: clean

**Step 4: Commit (if changed)**

```bash
git add src/components/calendar/TileBlock.tsx
git commit -m "fix(calendar): stop event propagation on tile block click"
```

---

## Task 6: クイック作成 — ツールバー [+ Create] ボタン + 空きセル click

**Files:**
- Modify: `src/lib/stores/quick-create-store.ts` (read first; if no `defaultStart` / `defaultEnd` fields exist, add them)
- Modify: `src/components/calendar/CalendarMain.tsx` (add [+ Create] button in toolbar; register QuickTileCreate modal)
- Modify: `src/components/calendar/DayView.tsx` (add onClick to hour cells)
- Modify: `src/components/calendar/WeekView.tsx` (add onClick to half-hour cells)

**Step 1: Extend `useQuickCreateStore` to carry defaultStart / defaultEnd**

Read `src/lib/stores/quick-create-store.ts`. If `defaultStart` / `defaultEnd` are absent, add them to the state and to `open()`. Example:

```typescript
// existing pattern, augment:
state.open({ defaultStart?: string; defaultEnd?: string; source?: "calendar" | "header" } = {})
```

If the store has a different shape, follow the existing convention. Keep the diff minimal.

**Step 2 (PRIMARY): Add visible [+ Create] button in `CalendarMain` toolbar**

In `src/components/calendar/CalendarMain.tsx`, the toolbar row (lines 105–147) already contains prev/next, "Today", and the view selector. Add a **Create** button right after "Today" and before the view selector group:

```tsx
import { Plus } from "lucide-react";
// ... inside the component:
const openCreate = useQuickCreateStore((s) => s.open);

// inside the toolbar div (after the Today button):
<button
  type="button"
  onClick={() => openCreate({ source: "header" })}
  aria-label="Create tile"
  className="ml-2 flex items-center gap-1 rounded bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-fg hover:bg-primary-hover"
>
  <Plus className="h-3 w-3" />
  Create
</button>
```

This is the **primary** entry point. Without this button, the user has no discoverable way to create a tile from the calendar.

**Step 3: Wire CalendarMain to render QuickTileCreate modal when store is open**

Add inside the top-level `<div className="flex h-full flex-col">` of `CalendarMain`:

```tsx
const quickOpen = useQuickCreateStore((s) => s.open);
// ...inside the JSX:
{quickOpen && <QuickTileCreate />}
```

If `QuickTileCreate` already lives in the dashboard layout and reads the store itself, no CalendarMain change is needed. Verify by reading `src/components/tiles/QuickTileCreate.tsx`. Apply only if required.

**Step 4 (SECONDARY): DayView empty-cell onClick**

In `DayView.tsx`, change each hour cell div to:

```tsx
<div
  key={i}
  className="relative h-[90px] border-b border-border/50 bg-surface-0 cursor-cell"
  onClick={(e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const minutes = Math.max(0, Math.min(54, Math.round((e.clientY - rect.top) / 1.5 / 30) * 30));
    const start = new Date(slots[i].getTime() + minutes * 60_000).toISOString();
    const end = new Date(slots[i].getTime() + (minutes + 30) * 60_000).toISOString();
    openCreate({ defaultStart: start, defaultEnd: end, source: "calendar" });
  }}
>
```

Add `const openCreate = useQuickCreateStore((s) => s.open);` at the top of the component.

**Step 5 (SECONDARY): WeekView empty-cell onClick**

Add the same onClick to the 30-minute slot cells in `WeekView.tsx`. The week grid is 7 columns × 48 rows (30-min slots). Each cell's onClick calculates start/end and calls `openCreate`.

Read `WeekView.tsx` first; the exact cell-rendering varies. Apply the same onClick pattern.

**Step 6: Read QuickTileCreate to accept defaultStart / defaultEnd**

Read `src/components/tiles/QuickTileCreate.tsx`. If it doesn't pre-fill `defaultStart` / `defaultEnd`, add:

```typescript
const defaultStart = useQuickCreateStore((s) => s.defaultStart);
const defaultEnd = useQuickCreateStore((s) => s.defaultEnd);
// pass to whatever start/end inputs the form uses
```

If QuickTileCreate uses a v1-structured editor (recent refactor), it should already accept span defaults. Adjust minimally.

**Step 7: Typecheck + tests**

Run: `bun run typecheck && bun test`
Expected: clean

**Step 8: Commit**

```bash
git add src/lib/stores/quick-create-store.ts \
        src/components/calendar/CalendarMain.tsx \
        src/components/calendar/DayView.tsx \
        src/components/calendar/WeekView.tsx \
        src/components/tiles/QuickTileCreate.tsx
git commit -m "feat(calendar): add Create button + empty-cell quick-create"
```

---

## Task 7: TileEditPanel に start / end 保存 + Start / Complete ボタン

**Files:**
- Modify: `src/components/tile/TileEditPanel.tsx`

**Step 1: Add startAt / endAt save payload**

Replace the `handleSave` body so it sends `start_at` and `end_at` in the `updateTileCommand` payload when in edit mode and the values changed.

In `createTileCommand` (Task 6 path), use `startTileCommand` after create to set span if the store carries `defaultStart` / `defaultEnd`. Add to `tile-commands.ts` only if absent:

```typescript
export interface CreateTileWithSpanOptions {
  client: ApiClient;
  title: string;
  description?: string | null;
  start: string;
  end: string;
}

export async function createTileWithSpanCommand(
  options: CreateTileWithSpanOptions,
): Promise<CreateTileWithSpanResult> {
  const created = await createTileCommand({ client: options.client, title: options.title, description: options.description });
  if (!created.ok) return { ok: false, error: created.error };
  const tileId = created.data.aggregate?.id;
  if (!tileId) return { ok: false, error: { kind: 7, message: "create response missing tile aggregate", currentRevision: null, violations: [] } };
  const planId = created.data.aggregate?.plan_id ?? tileId;
  const started = await startTileCommand({ client: options.client, tileId, planId, start: options.start, end: options.end });
  if (!started.ok) return { ok: false, error: started.error };
  return { ok: true, tileId, placementId: started.data.aggregate?.id ?? null };
}
```

Read `tile-commands.ts` first; adapt to the existing pattern.

**Step 2: Pass startAt / endAt from TileEditPanel**

When the form is in `edit` mode, send the edited start/end to the backend. The `updateTileCommand` does not currently accept span; add a new command `updateTileSpanCommand(options: {client, tileId, start, end})` calling `POST /v1/tiles/{tileId}/start` (or whatever the v1 path is) with the new span. Read the v1 router if needed to find the right path.

**Step 3: Add Start / Complete buttons**

In `TileEditPanel`, inside the existing form, add a new section "Actions" with two buttons:

```tsx
{mode === "edit" && draft?.tileId && (
  <>
    <button
      type="button"
      onClick={async () => {
        const ok = await engine.start(draft.tileId!);
        if (ok) window.dispatchEvent(new CustomEvent("tastile:tiles-changed"));
      }}
    >Start</button>
    <button
      type="button"
      onClick={async () => {
        const ok = await engine.complete(draft.tileId!);
        if (ok) window.dispatchEvent(new CustomEvent("tastile:tiles-changed"));
      }}
    >Complete</button>
  </>
)}
```

`engine` is `useExecutionEngine()` from `@/lib/hooks/use-execution-engine`. Read the engine's API first to call the correct method names.

**Step 4: Typecheck + manual smoke**

Run: `bun run typecheck && bun test`
Expected: clean

**Step 5: Commit**

```bash
git add src/components/tile/TileEditPanel.tsx src/lib/api/v1/tile-commands.ts
git commit -m "feat(calendar): save span + start/complete in tile edit panel"
```

---

## Task 8: E2E 検証 (Browser 実機)

**Step 1: 起動**

```bash
# Terminal 1: daemon (既存の起動方法に従う)
cd ../tastile-core
cargo run -p tastile-v1-api    # or the actual binary name; check Cargo.toml

# Terminal 2: web
bun dev
```

**Step 2: chrome-devtools-mcp で /dashboard/calendar を開く**

`mcp__chrome-devtools__navigate_page({ type: "url", url: "http://localhost:3000/dashboard/calendar" })`

**Step 3: 検証フロー**

1. 初期表示で既存タイル (あれば) が見える
2. **ツールバー [+ Create] ボタン** がデフォルトズームで常に見える
3. [+ Create] click → QuickTileCreate が開く (空の start/end)
4. Title 入力 → Save → タイルがカレンダーに追加される
5. 追加したタイル click → TileEditPanel 開き、Start クリック → active 表示
6. 再度 click → Complete → done 表示
7. 既存タイル click → title / span 編集 → Save → カレンダーに反映
8. 空きセル click → QuickTileCreate が開き、start/end が初期値 (二次エントリ)
9. Network / Console エラーがないこと (`list_console_messages`)

**Step 4: 受け入れ条件**

- Read: バックエンドの Effective Placement が DayView / WeekView / MonthView に表示される
- **Create (primary)**: ツールバー [+ Create] ボタンが常に見える。click → QuickTileCreate → Save → カレンダーに即時反映
- Create (secondary): 空きセル click → start/end 初期値入り QuickTileCreate → 動作
- Edit: title / span 編集 → バックエンドに保存 → カレンダーに反映
- Start / Complete: タイルが active / done 状態になり視覚的に分かる
- エラー: Network 4xx/5xx なし、Console error なし

**Step 5: コミット (検証結果が問題なければ final commit)**

```bash
git add -A
git commit -m "chore(calendar): e2e verification passed"
```

---

## 触らないファイル (参照のみ)

- `tastile-core/crates/v1/api/src/handlers/commands.rs` (calendar_* ハンドラ) — プローブ実装で OK
- `tastile-core/crates/v1/api/src/handlers/timeline.rs` — 既存実装で OK
- `tastile-core/crates/v1/domain/src/read.rs` — TimelineItem の正本は backend
- `tastile-web/src/lib/api/endpoints.ts` — `toV1CorePath` の `/v1/calendar/{view}` マップ既存
- `tastile-web/src/components/panels/CalendarSidePanel.tsx` — visibleTypes トグル (Task 外)

---

## リスク

1. **`get_timeline` の認可**: `forward_timeline` は `include_labels=true, include_closed=true, include_blocked=true, include_nested=true` を強制。これは想定通り (カレンダーには全部欲しい)。
2. **TZ**: `tzOffset` (分) は minute 単位で backend に渡さない。`resolveWindowForView` で UTC ISO に丸める。anchor 日の 00:00 端末 TZ → UTC へ。
3. **Cognito 未ログイン**: ローカル daemon は anonymous 接続を許す設計 (`tastile-core` 側で `read_owner` の挙動を確認)。401 なら `tastile-web` 側の `getIdTokenClient` のフォールバックを尊重。
4. **既存の `useTileEditStore.openEdit` の引数**: 5 引数 `openEdit(tileId, title, startAt, endAt, labels)`。signature を変更しない。
5. **`startTileCommand` の `planId`**: `createTileWithSpanCommand` で `aggregate.plan_id` を使う。なければ tileId で代用 (READ 側で placement の `plan_id` が引かれる)。事後に E2E で詰める。

---

## 完了条件 (Definition of Done)

- [ ] `bun run typecheck` クリーン
- [ ] `bun test` 全件 Green
- [ ] `/dashboard/calendar` で Read / Create / Edit / Start / Complete が実機で動作
- [ ] Network / Console にエラーなし
- [ ] 上記 8 Tasks すべて commit 済み (Conventional Commits)
- [ ] PR を作成 (任意)
