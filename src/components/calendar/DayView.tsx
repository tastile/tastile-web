"use client";

import { useEffect, useState } from "react";
import { useCalendarProjection } from "@/lib/hooks/use-calendar-projection";
import { useReferenceOverlayStore } from "@/lib/stores/reference-overlay-store";
import { blocksForDate, allDayBlocksFor, hourSlotsForDay } from "@/lib/projection/calendar-projection";
import { TileBlock } from "./TileBlock";
import { AllDayLane } from "./AllDayLane";

function formatHour(slot: Date): string {
  const h = slot.getUTCHours();
  return `${h.toString().padStart(2, "0")}:00`;
}

export function DayView({ anchor, tzOffset, refreshKey }: { anchor: string; tzOffset: number; refreshKey?: number }) {
  const { projection, loading, error } = useCalendarProjection({ view: "day", anchor, tzOffset, refreshKey });
  const enabled = useReferenceOverlayStore((s) => s.enabled);
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  if (error) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-2 text-xs">
        <span className="text-danger">Failed to load calendar</span>
        <span className="text-foreground-subtle">{error.message}</span>
      </div>
    );
  }

  if (loading || !projection) {
    return <div className="flex h-64 items-center justify-center text-xs text-foreground-subtle">Loading…</div>;
  }

  const slots = hourSlotsForDay(anchor, tzOffset);
  const dayBlocks = blocksForDate(projection, anchor);
  const allDay = allDayBlocksFor(projection, anchor);

  const localMs = nowMs + tzOffset * 60_000;
  const localDate = new Date(localMs);
  const localMinutes = (localDate.getUTCHours() * 60 + localDate.getUTCMinutes());
  const nowSlotIndex = Math.floor(localMinutes / 60);
  const nowTopOffset = (localMinutes % 60) * 1.5;

  return (
    <div className="relative">
      <AllDayLane spans={allDay} />
      <div className="relative">
        {slots.map((slot, i) => {
          const hourBlocks = dayBlocks.filter((b) => {
            const bStart = new Date(b.start_at);
            return bStart.getUTCHours() === slot.getUTCHours();
          });
          const isNow = i === nowSlotIndex;
          return (
            <div key={i} className="relative flex" style={{ height: "90px" }}>
              <div className="w-10 shrink-0 pr-2 text-right font-mono text-[10px] text-foreground-subtle">
                {formatHour(slot)}
              </div>
              <div className="relative min-w-0 flex-1 border-t border-surface-2">
                {hourBlocks.map((block, bi) => {
                  const isDimmed = enabled.length > 0 && !enabled.includes(block.source_label);
                  return (
                    <div
                      key={`${block.tile_id}-${bi}`}
                      className="absolute left-1 right-1"
                      style={{
                        top: `${new Date(block.start_at).getUTCMinutes() * 1.5}px`,
                      }}
                    >
                      <TileBlock
                        block={block}
                        onClick={() => {/* TODO: open edit panel */}}
                        dimmed={isDimmed}
                      />
                    </div>
                  );
                })}
                {isNow && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 h-px bg-primary"
                    style={{ top: `${nowTopOffset * 1.5}px` }}
                  >
                    <span className="absolute -top-1.5 -left-1.5 h-2.5 w-2.5 rounded-full bg-primary" />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
