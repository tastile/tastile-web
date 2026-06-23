"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { CalendarSidePanel } from "@/components/panels/CalendarSidePanel";
import { useSidePanel } from "@/lib/context/side-panel-context";
import { cn } from "@/lib/utils/cn";
import { DayView } from "./DayView";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";

export type CalendarView = "day" | "week" | "month" | "year";

const VALID_VIEWS: CalendarView[] = ["day", "week", "month", "year"];

function localIsoDate(now = new Date()): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function shiftDate(dateStr: string, view: CalendarView, delta: -1 | 1): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  void d.getTime();
  if (view === "day") d.setUTCDate(d.getUTCDate() + delta);
  else if (view === "week") d.setUTCDate(d.getUTCDate() + delta * 7);
  else if (view === "month") d.setUTCMonth(d.getUTCMonth() + delta);
  else d.setUTCFullYear(d.getUTCFullYear() + delta);
  return d.toISOString().slice(0, 10);
}

function formatAnchor(view: CalendarView, anchor: string): string {
  const d = new Date(`${anchor}T00:00:00Z`);
  if (view === "day") {
    return d.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });
  }
  if (view === "week") {
    const start = new Date(d);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay());
    const end = new Date(start);
    end.setUTCDate(end.getUTCDate() + 6);
    return `${start.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" })} – ${end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}`;
  }
  if (view === "month") {
    return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  return d.getUTCFullYear().toString();
}

function parseView(param: string | null, defaultView: CalendarView = "day"): CalendarView {
  if (param && VALID_VIEWS.includes(param as CalendarView)) {
    return param as CalendarView;
  }
  return defaultView;
}

export function CalendarMain({ initialView = "day" }: { initialView?: CalendarView }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const urlView = parseView(searchParams.get("view"), initialView);
  const [view, setViewState] = useState<CalendarView>(urlView);
  const [anchor, setAnchor] = useState(() => localIsoDate());
  const [tzOffset, setTzOffset] = useState(0);

  useEffect(() => {
    setTzOffset(new Date().getTimezoneOffset() * -1);
  }, []);

  const [visibleTypes, setVisibleTypes] = useState<Set<string>>(new Set());

  function toggleType(type: string) {
    setVisibleTypes((prev) => {
      const next = new Set(prev);
      if (next.has(type)) next.delete(type);
      else next.add(type);
      return next;
    });
  }

  useSidePanel(
    <CalendarSidePanel
      anchor={anchor}
      onSelectDate={setAnchor}
      visibleTypes={visibleTypes}
      onToggleType={toggleType}
    />,
  );

  const setView = (v: CalendarView) => {
    setViewState(v);
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", v);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-12 items-center gap-3 px-4 shrink-0">
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
          onClick={() => setAnchor(localIsoDate())}
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
                view === v
                  ? "bg-surface-2 text-foreground"
                  : "text-foreground-subtle hover:text-foreground",
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
        {view === "year" ? (
          <div className="py-8 text-center text-xs text-foreground-subtle">
            Year view — coming soon
          </div>
        ) : null}
      </div>
    </div>
  );
}
