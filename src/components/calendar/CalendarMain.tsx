"use client";

import { Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import type { CalendarEvent } from "@/lib/domain/calendar";
import { useEvents } from "@/lib/hooks/calendar/use-events";
import { useSidePanel } from "@/lib/context/side-panel-context";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { cn } from "@/lib/utils/cn";
import { DayView } from "./DayView";
import { EventDialog } from "./EventDialog";
import { EventListView } from "./EventListView";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";

export type CalendarView = "day" | "week" | "month" | "list";

const VALID_VIEWS: CalendarView[] = ["day", "week", "month", "list"];

function localIsoDate(now = new Date()): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 10);
}

function shiftDate(dateStr: string, view: CalendarView, delta: -1 | 1): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (view === "day") d.setUTCDate(d.getUTCDate() + delta);
  else if (view === "week") d.setUTCDate(d.getUTCDate() + delta * 7);
  else if (view === "month") d.setUTCMonth(d.getUTCMonth() + delta);
  // list view does not need an anchor; fall-through is intentional.
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
  // list view
  return "All events";
}

function parseView(param: string | null, defaultView: CalendarView = "day"): CalendarView {
  if (param && (VALID_VIEWS as string[]).includes(param)) {
    return param as CalendarView;
  }
  return defaultView;
}

function rangeForView(view: CalendarView, anchor: string): { start: string; end: string } {
  const start = new Date(`${anchor}T00:00:00Z`);
  const end = new Date(start);
  switch (view) {
    case "day":
      end.setUTCDate(end.getUTCDate() + 1);
      break;
    case "week":
      start.setUTCDate(start.getUTCDate() - start.getUTCDay());
      end.setUTCDate(start.getUTCDate() + 7);
      break;
    case "month":
      start.setUTCDate(1);
      end.setUTCMonth(end.getUTCMonth() + 1);
      break;
    case "list":
      // 90-day forward window keeps the list snappy; pagination is
      // out of scope for the MVP and can be layered on later.
      start.setUTCDate(1);
      end.setUTCMonth(end.getUTCMonth() + 3);
      break;
  }
  return { start: start.toISOString(), end: end.toISOString() };
}

export function CalendarMain({ initialView = "day" }: { initialView?: CalendarView }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const urlView = parseView(searchParams.get("view"), initialView);
  const [view, setViewState] = useState<CalendarView>(urlView);
  const [anchor, setAnchor] = useState(() => localIsoDate());
  const [tzOffset, setTzOffset] = useState(0);

  useState(() => {
    if (typeof window === "undefined") return 0;
    setTzOffset(new Date().getTimezoneOffset() * -1);
    return 0;
  });

  const range = useMemo(() => rangeForView(view, anchor), [view, anchor]);
  const eventsState = useEvents(range);
  const openQuickCreate = useQuickCreateStore((s) => s.openAt);

  const [dialogState, setDialogState] = useState<
    | { mode: "create"; defaultStart: string; defaultEnd: string }
    | { mode: "edit"; event: CalendarEvent }
    | null
  >(null);

  function openCreate(prefill?: { start: string; end: string }) {
    const start =
      prefill?.start ?? new Date(`${anchor}T09:00:00Z`).toISOString();
    const end =
      prefill?.end ?? new Date(`${anchor}T10:00:00Z`).toISOString();
    setDialogState({ mode: "create", defaultStart: start, defaultEnd: end });
  }

  function openEdit(event: CalendarEvent) {
    setDialogState({ mode: "edit", event });
  }

  function closeDialog() {
    setDialogState(null);
  }

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
          data-testid="cal-prev"
          className="rounded p-1 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
        >
          ◀
        </button>
        <h2 className="font-mono text-sm text-foreground" data-testid="cal-anchor">
          {formatAnchor(view, anchor)}
        </h2>
        <button
          type="button"
          onClick={() => setAnchor((a) => shiftDate(a, view, 1))}
          aria-label="Next"
          data-testid="cal-next"
          className="rounded p-1 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
        >
          ▶
        </button>
        <button
          type="button"
          onClick={() => setAnchor(localIsoDate())}
          data-testid="cal-today"
          className="ml-1 rounded px-2 py-0.5 text-[11px] font-medium text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
        >
          Today
        </button>
        <div className="ml-auto flex gap-0.5 rounded-md bg-surface-1 p-0.5">
          {(["day", "week", "month", "list"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              data-testid={`cal-view-${v}`}
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
        <button
          type="button"
          onClick={() => openCreate()}
          data-testid="cal-create"
          className="ml-2 inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-fg hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
        {/* QuickTileCreate entry point — primary affordance for tile
            creation. Calendar-event "New" above stays for legacy event
            dialogs; this opens the v1 tile creator panel. */}
        <button
          type="button"
          onClick={() => openQuickCreate()}
          data-testid="cal-tile-create"
          aria-label="Create tile"
          className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-fg hover:opacity-90"
        >
          <Plus className="h-3.5 w-3.5" />
          Create
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
        {eventsState.error ? (
          <div className="flex h-32 flex-col items-center justify-center gap-1 text-xs">
            <span className="text-danger">Failed to load events</span>
            <span className="text-foreground-subtle">
              {eventsState.error.message}
            </span>
          </div>
        ) : null}
        {view === "day" ? (
          <DayView
            anchor={anchor}
            tzOffset={tzOffset}
            events={eventsState.events}
            loading={eventsState.loading}
            onCreateAtTime={(start, end) => openCreate({ start, end })}
            onEventClick={openEdit}
          />
        ) : null}
        {view === "week" ? (
          <WeekView
            anchor={anchor}
            tzOffset={tzOffset}
            events={eventsState.events}
            loading={eventsState.loading}
            onEventClick={openEdit}
          />
        ) : null}
        {view === "month" ? (
          <MonthView
            anchor={anchor}
            tzOffset={tzOffset}
            events={eventsState.events}
            loading={eventsState.loading}
            onEventClick={openEdit}
          />
        ) : null}
        {view === "list" ? (
          <EventListView
            events={eventsState.events}
            loading={eventsState.loading}
            error={eventsState.error}
            onEventClick={openEdit}
          />
        ) : null}
      </div>

      {dialogState ? (
        <EventDialog
          open
          mode={dialogState.mode}
          initial={dialogState.mode === "edit" ? dialogState.event : null}
          defaultStart={dialogState.mode === "create" ? dialogState.defaultStart : undefined}
          defaultEnd={dialogState.mode === "create" ? dialogState.defaultEnd : undefined}
          onClose={closeDialog}
          onSave={async (input) => {
            if (dialogState.mode === "create") {
              await eventsState.create(input);
            } else {
              const baseId = dialogState.event.id.split(":")[0]!;
              await eventsState.update(baseId, input);
            }
          }}
          onDelete={
            dialogState.mode === "edit"
              ? async (id) => {
                  const baseId = id.split(":")[0]!;
                  await eventsState.remove(baseId);
                }
              : undefined
          }
        />
      ) : null}
    </div>
  );
}
