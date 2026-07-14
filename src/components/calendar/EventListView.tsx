"use client";

import { Alert } from "@mantine/core";
import { AlertCircle, Calendar, Clock, MapPin } from "lucide-react";
import { useMemo, useState } from "react";
import { type CalendarEvent, EVENT_COLOR_HEX } from "@/lib/domain/calendar";
import { cn } from "@/lib/utils/cn";

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function groupByDay(events: CalendarEvent[]): Array<[string, CalendarEvent[]]> {
  const map = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const key = e.start.slice(0, 10);
    const arr = map.get(key) ?? [];
    arr.push(e);
    map.set(key, arr);
  }
  const days = Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  for (const [, arr] of days) {
    arr.sort((a, b) => a.start.localeCompare(b.start));
  }
  return days;
}

export interface EventListViewProps {
  events: CalendarEvent[];
  loading: boolean;
  error: Error | null;
}

export function EventListView({ events, loading, error }: EventListViewProps) {
  const [query, setQuery] = useState("");
  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? events.filter(
          (e) =>
            e.title.toLowerCase().includes(q) ||
            (e.location ?? "").toLowerCase().includes(q) ||
            (e.description ?? "").toLowerCase().includes(q),
        )
      : events;
    return groupByDay(filtered);
  }, [events, query]);

  // Frame (search input + day-grouped list container) is always rendered
  // so the shell never flashes between a "Loading…" placeholder and the
  // list. While events are in-flight, the search input stays usable and
  // the list area shows a small spinner.
  return (
    <div className="relative space-y-6" data-testid="event-list-wrapper">
      <div className="flex items-center gap-2">
        <input
          type="search"
          data-testid="event-list-search"
          placeholder="Search events…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 w-full max-w-sm rounded-md border border-border bg-surface-1 px-2.5 text-xs placeholder:text-foreground-muted focus:border-control focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-background-control"
        />
        {loading ? (
          <span
            data-testid="event-list-loading"
            className="text-[10px] uppercase tracking-wider text-foreground-subtle"
          >
            Loading…
          </span>
        ) : null}
      </div>
      {/* Absolute overlay so the list rows below do not shift when the
          polling error flips on/off — same fix as CalendarMain. */}
      {error ? (
        <div className="pointer-events-none absolute inset-x-0 top-10 z-20 flex justify-center">
          <Alert
            variant="light"
            color="red"
            icon={<AlertCircle className="h-4 w-4" />}
            title="Couldn’t load events"
            data-testid="event-list-error"
            className="pointer-events-auto w-full max-w-2xl"
          >
            {error.message}
          </Alert>
        </div>
      ) : null}
      {groups.length === 0 ? (
        <div
          className="flex flex-col items-center gap-2 py-16 text-center"
          data-testid="event-list"
        >
          <Calendar className="h-8 w-8 text-foreground-subtle" />
          <p className="text-sm text-foreground-subtle">
            {loading
              ? "Loading events…"
              : query
                ? "No events match your search."
                : "No events yet. Click + to create one."}
          </p>
        </div>
      ) : (
        groups.map(([day, items]) => (
          <div key={day} data-testid={`event-list-day-${day}`}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-foreground-subtle">
              {new Date(`${day}T00:00:00Z`).toLocaleDateString(undefined, {
                weekday: "long",
                month: "long",
                day: "numeric",
                year: "numeric",
                timeZone: "UTC",
              })}
            </h3>
            <ul className="divide-y divide-border rounded-md border border-border bg-surface-0">
              {items.map((event) => (
                <li key={event.id}>
                  <button
                    type="button"
                    data-testid={`event-list-item-${event.id}`}
                    className="flex w-full items-start gap-3 px-3 py-2.5 text-left transition-colors hover:bg-surface-1"
                  >
                    <span
                      aria-hidden
                      className="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: EVENT_COLOR_HEX[event.color] ?? EVENT_COLOR_HEX.blue,
                      }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium text-foreground">
                        {event.title}
                      </div>
                      <div
                        className={cn(
                          "mt-0.5 flex flex-wrap items-center gap-3 text-[11px] text-foreground-subtle",
                        )}
                      >
                        <span className="inline-flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3" />
                          {event.allDay ? "All day" : formatDate(event.start)}
                        </span>
                        {event.location ? (
                          <span className="inline-flex items-center gap-1 truncate">
                            <MapPin className="h-3 w-3" />
                            {event.location}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))
      )}
    </div>
  );
}
