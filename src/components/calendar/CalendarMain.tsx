"use client";
import { Alert } from "@mantine/core";
import { AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarSidePanel } from "@/components/panels/CalendarSidePanel";
import { type DisplayMode, getModeRange, todayLocalIso } from "@/lib/calendar/layout";
import { useSidePanel } from "@/lib/context/side-panel-context";
import type { CalendarEvent } from "@/lib/domain/calendar";
import { type UseEventsRange, useEvents } from "@/lib/hooks/calendar/use-events";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { cn } from "@/lib/utils/cn";
import { DayView } from "./DayView";
import { EventListView } from "./EventListView";
import { MonthView } from "./MonthView";
import { WeekView } from "./WeekView";

export type CalendarView = "day" | "week" | "month" | "list";

const VALID_VIEWS: CalendarView[] = ["day", "week", "month", "list"];
const VALID_MODES: DisplayMode[] = ["scope", "around", "future"];

function localIsoDate(now = new Date()): string {
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function shiftDate(dateStr: string, view: CalendarView, delta: -1 | 1): string {
  const d = new Date(`${dateStr}T00:00:00Z`);
  if (view === "day" || view === "list") d.setUTCDate(d.getUTCDate() + delta);
  else if (view === "week") d.setUTCDate(d.getUTCDate() + delta * 7);
  else d.setUTCMonth(d.getUTCMonth() + delta);
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
  return "All events";
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function parseView(param: string | null, defaultView: CalendarView = "day"): CalendarView {
  if (param && VALID_VIEWS.includes(param as CalendarView)) {
    return param as CalendarView;
  }
  return defaultView;
}

function parseMode(param: string | null): DisplayMode {
  if (param && VALID_MODES.includes(param as DisplayMode)) {
    return param as DisplayMode;
  }
  return "scope";
}

/** Map (view, mode) → title prefix shown next to the date range. */
function modeLabel(view: CalendarView, mode: DisplayMode): string | null {
  if (mode === "scope") return null;
  if (mode === "around") {
    if (view === "day") return "Today · ±12h";
    if (view === "week") return "Today · ±3d";
    return "Today · ±15d";
  }
  // future
  if (view === "day") return "From now · 24h";
  if (view === "week") return "From now · 7d";
  return "From now · 31d";
}

export function CalendarMain({ initialView = "day" }: { initialView?: CalendarView }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const urlView = parseView(searchParams.get("view"), initialView);
  const urlMode = parseMode(searchParams.get("mode"));
  const [view, setViewState] = useState<CalendarView>(urlView);
  const [mode, setModeState] = useState<DisplayMode>(urlMode);
  const [anchor, setAnchor] = useState(() => localIsoDate());
  const [tzOffset, setTzOffset] = useState(0);
  const [minDuration, setMinDuration] = useState(0);
  // Capture Date.now() once on mount so listRange only refreshes when
  // tzOffset changes, never during render. Held in state (not a ref)
  // because the linter treats ref.current reads inside render as
  // side-channel state.
  const [nowMs, setNowMs] = useState<number>(0);

  useEffect(() => {
    setNowMs(Date.now());
    setTzOffset(new Date().getTimezoneOffset() * -1);
  }, []);

  // Effective anchor for date math — in around/future modes the anchor
  // is always today, regardless of what the user has previously selected.
  const effectiveAnchor = mode === "scope" ? anchor : todayLocalIso(tzOffset);

  // The occurrences API expects RFC3339; expand the (mode, view) window
  // into explicit [start, end] datetimes.
  // The list view pulls a fixed wide window (today - 30d / +90d) so
  // the entire list is in one capability-aware /v1/timeline call.
  const listRange = useMemo((): UseEventsRange => {
    // Before the mount effect has run, nowMs is 0 — render with a
    // sentinel window rather than touching Date during render.
    const adjusted = nowMs - tzOffset * 60_000;
    return {
      start: new Date(adjusted - 30 * 24 * 60 * 60 * 1000).toISOString(),
      end: new Date(adjusted + 90 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }, [tzOffset, nowMs]);

  const range = useMemo(() => {
    if (view === "list") return listRange;
    return getModeRange(view, mode, effectiveAnchor, tzOffset);
  }, [view, mode, effectiveAnchor, tzOffset, listRange]);

  const selectedOwnerIds = useMemo(() => {
    const raw = searchParams.get("projects");
    return raw === null ? undefined : raw.split(",").filter(Boolean);
  }, [searchParams]);

  const { events, loading, error } = useEvents({ ...range, minMinutes: minDuration, ownerIds: selectedOwnerIds });

  // Sync the URL whenever view or mode changes. We keep `mode` in the
  // URL only when it's not the default so existing URLs stay clean.
  const syncUrl = useCallback(
    (next: { view?: CalendarView; mode?: DisplayMode }) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.view) params.set("view", next.view);
      if (next.mode !== undefined) {
        if (next.mode === "scope") params.delete("mode");
        else params.set("mode", next.mode);
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const setView = useCallback(
    (v: CalendarView) => {
      setViewState(v);
      syncUrl({ view: v });
    },
    [syncUrl],
  );

  const setMode = useCallback(
    (m: DisplayMode) => {
      setModeState(m);
      // around/future pins the visible window to "now"; reset anchor
      // so prev/next (when mode reverts to scope) starts fresh.
      if (m !== "scope") setAnchor(localIsoDate());
      syncUrl({ mode: m });
    },
    [syncUrl],
  );

  // Side panel controls use the same URL-synchronised state transitions as
  // the toolbar, so deep links and browser navigation remain reliable.
  useSidePanel(
    <CalendarSidePanel
      anchor={anchor}
      view={view}
      mode={mode}
      minDuration={minDuration}
      onSelectDate={setAnchor}
      onModeChange={setMode}
      onMinDurationChange={setMinDuration}
    />,
  );

  const navDisabled = mode !== "scope";

  // Open the side panel pre-populated with a new tile at the clicked slot.
  const handleCreateAtSlot = useCallback((slotAnchor: string, hour: number) => {
    const start = `${slotAnchor}T${pad(hour)}:00:00.000Z`;
    const endHour = Math.min(23, hour + 1);
    const end = `${slotAnchor}T${pad(endHour)}:00:00.000Z`;
    useQuickCreateStore.getState().reset();
    useQuickCreateStore.getState().setField("time.span.start", start);
    useQuickCreateStore.getState().setField("time.span.end", end);
    useQuickCreateStore.getState().setField("identity.title", "");
    useQuickCreateStore.getState().setField("identity.description", null);
    useQuickCreateStore.getState().setField("meta.project", null);
    useQuickCreateStore.getState().setField("meta.tags", []);
    useQuickCreateStore.getState().setField("meta.memo", "");
    useQuickCreateStore.getState().openCreate({ initialAllDay: false });
  }, []);

  // Open the side panel hydrated from the clicked occurrence for editing.
  // Strip any occurrence cursor suffix (":<cursor>") from the id so the
  // edit submit hits the source event via PATCH /api/events/{id}.
  //
  // Recurring-sourced placements (source.kind === 1) carry the parent
  // tile id in `event.tileId`.  v1 spec §02 says the recurring tile is
  // the source of truth, so editing such a placement should re-route
  // through `loadFromRecurringTile` which calls
  // GET /v1/tiles/{id} and submits via POST /v1/tiles/{id}/update.
  // Without this, PATCH /api/events/{id} 404s because that endpoint
  // only knows v1_event rows, not v1_placement rows.
  const handleEditEvent = useCallback((event: CalendarEvent) => {
    const colon = event.id.indexOf(":");
    const sourceId = colon > 0 ? event.id.slice(0, colon) : event.id;
    if (event.source?.kind === 1 && event.tileId) {
      void useQuickCreateStore.getState().loadFromRecurringTile(event.tileId);
      return;
    }
    useQuickCreateStore.getState().loadFromEvent({ ...event, id: sourceId });
    useQuickCreateStore.getState().openEdit(sourceId, event.tileId ?? null);
  }, []);

  const visibleEvents = events;

  const titlePrefix = modeLabel(view, mode);

  return (
    <div className="flex h-full flex-col" data-testid="calendar-main">
      <div className="sticky top-0 z-40 flex h-12 shrink-0 items-center gap-2 bg-surface-0 px-4">
        <button
          type="button"
          onClick={() => setAnchor((a) => shiftDate(a, view, -1))}
          aria-label="Previous"
          aria-disabled={navDisabled}
          disabled={navDisabled}
          title={navDisabled ? "Always anchored at today" : undefined}
          data-testid="cal-prev"
          className={cn(
            "rounded p-1 text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
            navDisabled &&
              "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-foreground-subtle",
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <h2 className="font-mono text-sm text-foreground" data-testid="cal-title">
          {titlePrefix ? (
            <span className="mr-2 rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
              {titlePrefix}
            </span>
          ) : null}
          {formatAnchor(view, effectiveAnchor)}
        </h2>
        <button
          type="button"
          onClick={() => setAnchor((a) => shiftDate(a, view, 1))}
          aria-label="Next"
          aria-disabled={navDisabled}
          disabled={navDisabled}
          title={navDisabled ? "Always anchored at today" : undefined}
          data-testid="cal-next"
          className={cn(
            "rounded p-1 text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
            navDisabled &&
              "opacity-40 cursor-not-allowed hover:bg-transparent hover:text-foreground-subtle",
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setMode("scope");
            setAnchor(localIsoDate());
          }}
          data-testid="cal-today"
          className="ml-1 rounded px-2 py-0.5 text-[11px] font-medium text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
        >
          Today
        </button>
        <div className="ml-auto flex items-center gap-2">
          <div
            className="flex gap-0.5 rounded-md bg-surface-1 p-0.5"
            data-testid="cal-mode-switcher"
          >
            {VALID_MODES.map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                data-testid={`cal-mode-${m}`}
                className={cn(
                  "rounded px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider",
                  mode === m
                    ? "bg-surface-2 text-foreground"
                    : "text-foreground-subtle hover:text-foreground",
                )}
              >
                {m === "scope" ? "Scope" : m === "around" ? "Around" : "Future"}
              </button>
            ))}
          </div>
          <div
            className="flex gap-0.5 rounded-md bg-surface-1 p-0.5"
            data-testid="cal-view-switcher"
          >
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
        </div>
      </div>
      <div className="relative min-h-0 flex-1 px-4 pb-6">
        {/* Error banner overlays the calendar area without taking layout
            space — the API poll cycle flips `error` on/off repeatedly,
            and rendering the banner inline would shift the grid up/down
            every cycle ("calendar shaking"). */}
        {error ? (
          <div className="pointer-events-none absolute inset-x-4 top-2 z-20 flex justify-center">
            <Alert
              variant="light"
              color="red"
              icon={<AlertCircle className="h-4 w-4" />}
              title="Couldn’t load events"
              data-testid="cal-error"
              className="pointer-events-auto w-full max-w-2xl"
            >
              {error.message}
            </Alert>
          </div>
        ) : null}
        {view === "day" ? (
          <DayView
            anchor={effectiveAnchor}
            mode={mode}
            tzOffset={tzOffset}
            events={visibleEvents}
            loading={loading}
            onCreateAtSlot={handleCreateAtSlot}
            onEditEvent={handleEditEvent}
          />
        ) : null}
        {view === "week" ? (
          <WeekView
            anchor={effectiveAnchor}
            mode={mode}
            tzOffset={tzOffset}
            events={visibleEvents}
            onCreateAtSlot={handleCreateAtSlot}
            onEditEvent={handleEditEvent}
          />
        ) : null}
        {view === "month" ? (
          <MonthView
            anchor={effectiveAnchor}
            mode={mode}
            tzOffset={tzOffset}
            events={visibleEvents}
            loading={loading}
          />
        ) : null}
        {view === "list" ? (
          <EventListView events={visibleEvents} loading={loading} error={error} />
        ) : null}
      </div>
    </div>
  );
}
