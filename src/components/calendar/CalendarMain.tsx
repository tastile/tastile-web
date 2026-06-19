"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { DayView } from "./DayView";

export type CalendarView = "day" | "week" | "month" | "year";

function shiftDate(dateStr: string, view: CalendarView, delta: -1 | 1): string {
  const d = new Date(dateStr + "T00:00:00Z");
  void d.getTime();
  if (view === "day") d.setUTCDate(d.getUTCDate() + delta);
  else if (view === "week") d.setUTCDate(d.getUTCDate() + delta * 7);
  else if (view === "month") d.setUTCMonth(d.getUTCMonth() + delta);
  else d.setUTCFullYear(d.getUTCFullYear() + delta);
  return d.toISOString().slice(0, 10);
}

function formatAnchor(view: CalendarView, anchor: string): string {
  const d = new Date(anchor + "T00:00:00Z");
  if (view === "day") {
    return d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
  }
  if (view === "week") {
    const end = new Date(d);
    end.setUTCDate(end.getUTCDate() + 6);
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  }
  if (view === "month") {
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  return d.getUTCFullYear().toString();
}

export function CalendarMain({ initialView = "day" }: { initialView?: CalendarView }) {
  const [view, setView] = useState<CalendarView>(initialView);
  const [anchor, setAnchor] = useState(() => new Date().toISOString().slice(0, 10));
  const tzOffset = new Date().getTimezoneOffset() * -1;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center gap-3 px-4">
        <button
          type="button"
          onClick={() => setAnchor((a) => shiftDate(a, view, -1))}
          aria-label="Previous"
          className="rounded p-1 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="font-mono text-sm text-foreground">{formatAnchor(view, anchor)}</h2>
        <button
          type="button"
          onClick={() => setAnchor((a) => shiftDate(a, view, 1))}
          aria-label="Next"
          className="rounded p-1 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setAnchor(new Date().toISOString().slice(0, 10))}
          className="ml-1 rounded px-2 py-0.5 text-[11px] font-medium text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
        >
          Today
        </button>
        <div className="ml-auto flex gap-0.5 rounded-md bg-surface-1 p-0.5">
          {(["day", "week", "month", "year"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={cn(
                "rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider",
                view === v ? "bg-surface-2 text-foreground" : "text-foreground-subtle hover:text-foreground",
              )}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {view === "day" ? <DayView anchor={anchor} tzOffset={tzOffset} /> : null}
        {view === "week" ? <div className="py-8 text-center text-xs text-foreground-subtle">Week view — coming soon</div> : null}
        {view === "month" ? <div className="py-8 text-center text-xs text-foreground-subtle">Month view — coming soon</div> : null}
        {view === "year" ? <div className="py-8 text-center text-xs text-foreground-subtle">Year view — coming soon</div> : null}
      </div>
    </div>
  );
}
