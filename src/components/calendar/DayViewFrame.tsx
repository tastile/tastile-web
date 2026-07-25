"use client";

import { Button } from "@mantine/core";
import { memo, type ReactNode, type Ref } from "react";

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export interface DayViewFrameProps {
  /** Ref forwarded to the time-grid container so the parent's zoom hook can attach listeners. */
  gridRef: Ref<HTMLDivElement>;
  /** px per hour in the time grid (changes on user zoom). */
  hourHeight: number;
  /** List of hour numbers to render as gutter labels and slot rows. */
  hours: number[];
  /** YYYY-MM-DD; used for slot-button test ids and as the anchor passed to onCreateAtSlot. */
  effectiveDay: string;
  /** Stable callback from the parent (useCallback) — memo skips re-render only when this is referentially stable. */
  onCreateAtSlot?: (anchor: string, hour: number) => void;
  /** Dynamic content rendered in the ALL DAY sticky bar (chips). */
  allDayArea: ReactNode;
  /** Dynamic content overlaid on top of the slot grid (tiles, now-line, loading overlay). */
  eventsArea: ReactNode;
}

/**
 * Static template for the day-view shell: outer wrapper, sticky ALL DAY
 * bar container, hour gutter, slot-button rows. Memoized so that
 * DayView's `nowMs` tick (or any unrelated state change) does NOT
 * repaint the frame — only `eventsArea` / `allDayArea` re-render.
 *
 * The slot-button onClick is delegated through `onCreateAtSlot`, which
 * must be a stable reference (useCallback at the CalendarMain level)
 * for memo to take effect.
 */
function DayViewFrameImpl({
  gridRef,
  hourHeight,
  hours,
  effectiveDay,
  onCreateAtSlot,
  allDayArea,
  eventsArea,
}: DayViewFrameProps) {
  return (
    <div className="flex flex-col rounded-md border border-surface-2 bg-surface-0">
      <div className="sticky top-12 z-30 flex items-center gap-2 border-b border-surface-2 bg-surface-1 px-3 py-1.5">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle">
          All day
        </span>
        {allDayArea}
      </div>
      <div ref={gridRef} className="relative flex" style={{ height: `${24 * hourHeight}px` }}>
        <div className="flex w-16 shrink-0 flex-col border-r border-surface-2">
          {hours.map((h, idx) => (
            <div
              key={`${h}-${idx}`}
              className="flex items-start justify-end pr-2 pt-1"
              style={{ height: `${hourHeight}px` }}
            >
              <span className="font-mono text-[10px] text-foreground-subtle">{pad(h)}:00</span>
            </div>
          ))}
        </div>
        <div
          className="relative flex-1 bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--color-surface-2)_70%,transparent)_1px,transparent_1px)]"
          style={{ backgroundSize: `100% ${hourHeight}px` }}
        >
          {hours.map((h, idx) => (
            <Button
              key={`slot-${h}-${idx}`}
              type="button"
              data-testid={`day-slot-${effectiveDay}-${pad(h)}`}
              data-slot-anchor={effectiveDay}
              onClick={
                onCreateAtSlot
                  ? // For around/future we anchor slot creation to the
                  // start of the displayed window so the new tile
                  // lands inside the visible range.
                  () => onCreateAtSlot(effectiveDay, h)
                  : undefined
              }
              className="block w-full border-b border-surface-2/60 text-left hover:bg-surface-1/40 focus:outline-hidden focus-visible:bg-surface-1/40"
              style={{ height: `${hourHeight}px`, padding: 0 }}
            />
          ))}
          {eventsArea}
        </div>
      </div>
    </div>
  );
}

export const DayViewFrame = memo(DayViewFrameImpl);
