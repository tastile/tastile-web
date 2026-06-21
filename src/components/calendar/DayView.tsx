"use client";

import { useEffect, useState } from "react";
import { useCalendarProjection } from "@/lib/hooks/use-calendar-projection";
import { getCurrentTimeIndicatorPosition } from "@/lib/projection/current-time-indicator";
import { useReferenceOverlayStore } from "@/lib/stores/reference-overlay-store";
import { useTileEditStore } from "@/lib/stores/tile-edit-store";
import { blocksForDate, allDayBlocksFor, hourSlotsForDay } from "@/lib/projection/calendar-projection";
import { TileBlock } from "./TileBlock";
import { AllDayLane } from "./AllDayLane";

function formatHour(slot: Date): string {
  const h = slot.getUTCHours();
  return `${h.toString().padStart(2, "0")}:00`;
}

export function DayView({ anchor, tzOffset }: { anchor: string; tzOffset: number }) {
  const { projection, loading, error } = useCalendarProjection({ view: "day", anchor, tzOffset });
  const enabled = useReferenceOverlayStore((s) => s.enabled);
  const openEdit = useTileEditStore((s) => s.openEdit);
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

  const currentTime = getCurrentTimeIndicatorPosition(nowMs, tzOffset);
  const nowSlotIndex = Math.floor(currentTime.minutesFromMidnight / 60);
  const nowTopOffset = currentTime.minutesFromMidnight % 60;

  return (
    <div className="relative">
      <AllDayLane spans={allDay} />
      <div className="flex bg-surface-0 pb-16">
        <div className="w-16 shrink-0 border-r border-border bg-surface-1" />
        <div className="flex-1 bg-[url('/grid.svg')] bg-[length:100%_90px]" />
      </div>

      <div className="absolute top-[64px] bottom-0 left-0 right-0 flex">
        <div className="flex w-16 shrink-0 flex-col border-r border-border bg-surface-0">
          {slots.map((slot, i) => (
            <div key={i} className="flex h-[90px] items-start justify-end pr-2 pt-1">
              <span className="text-[10px] text-foreground-subtle">{formatHour(slot)}</span>
            </div>
          ))}
        </div>
        <div className="relative flex-1">
          {slots.map((slot, i) => {
            const h = slot.getUTCHours();
            const blocks = dayBlocks.filter((b) => new Date(b.start_at).getUTCHours() === h);
            const isNow = nowSlotIndex === h;
            return (
              <div key={i} className="relative h-[90px] border-b border-border/50 bg-surface-0">
                {blocks.map((block, bi) => {
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
                        onClick={() => {
                          if (block.tile_id) {
                            openEdit(block.tile_id, block.title, block.start_at, block.end_at || "", []);
                          }
                        }}
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
          );
        })}
        </div>
      </div>
    </div>
  );
}
