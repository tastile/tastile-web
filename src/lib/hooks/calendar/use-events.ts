"use client";

import { useCallback, useEffect, useState } from "react";
import type { CalendarEvent, CalendarEventInput } from "@/lib/domain/calendar";

export interface UseEventsState {
  events: CalendarEvent[];
  loading: boolean;
  error: Error | null;
  reload: () => Promise<void>;
  create: (input: CalendarEventInput) => Promise<CalendarEvent>;
  update: (id: string, patch: Partial<CalendarEventInput>) => Promise<CalendarEvent>;
  remove: (id: string) => Promise<void>;
}

/** Range-based calendar reads go through /api/events/occurrences, which
 *  proxies to the v1 Rust /v1/timeline (capability-aware).
 */
const OCC_BASE = "/api/events/occurrences";

/** The tile id is the {id} segment; placement id is the same string in
 *  the hook's local state (the upstream module returns the
 *  placement_id as `event.id`).
 */
const _TILE_BASE = "/api/events/tiles";
const _PLACEMENT_BASE = "/api/events/placements";

export interface UseEventsRange {
  start: string;
  end: string;
  /** Drop occurrences shorter than this many minutes (default 0: show breaks). */
  minMinutes?: number;
  /** Whether recurring instances should be expanded (default true). */
  includeRecurring?: boolean;
  /** Workspace owner ids selected in the calendar side panel. */
  ownerIds?: string[];
}

export const EVENTS_CHANGED_EVENT = "tastile:events-changed";

export function notifyEventsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENTS_CHANGED_EVENT));
}

export function useEvents(range?: UseEventsRange): UseEventsState {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const reload = useCallback(async () => {
    if (typeof window === "undefined") return;
    // Pull every field we read out into local consts so the body never
    // references `range` itself. `range` is intentionally NOT in the
    // dependency list: the caller passes `{ ...range, minMinutes,
    // ownerIds }` as a fresh object literal on every render, so including
    // it would produce a new `reload` closure every render and the
    // `useEffect(..., [reload])` consumers would then refire on every
    // render → fetch storm → render loop. The five field references
    // below are stable: primitives are compared by value and the
    // `ownerIds` array reference is stable across renders unless the
    // caller actually swaps the selection.
    const start = range?.start;
    const end = range?.end;
    const minMinutes = range?.minMinutes;
    const includeRecurring = range?.includeRecurring;
    const ownerIds = range?.ownerIds;
    if (!start || !end) {
      // No range yet (e.g. component not mounted with a window); the
      // caller can re-invoke reload() once range is available.
      setEvents([]);
      setLoading(false);
      return;
    }
    // An explicitly empty project selection means "show none".  It is
    // distinct from an omitted selection, which means all workspaces.
    if (ownerIds?.length === 0) {
      setEvents([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams();
    qs.set("start", start);
    qs.set("end", end);
    qs.set("min_minutes", String(minMinutes ?? 0));
    qs.set("include_recurring", String(includeRecurring ?? true));
    if (ownerIds?.length) qs.set("owner_ids", ownerIds.join(","));
    await fetch(`${OCC_BASE}?${qs.toString()}`, { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Failed to load events (${res.status})`);
        const data = (await res.json()) as
          | { events: CalendarEvent[] }
          | { occurrences: CalendarEvent[] };
        const list =
          "events" in data ? data.events : (data as { occurrences: CalendarEvent[] }).occurrences;
        setEvents(list ?? []);
      })
      .catch((err: unknown) => {
        // Stable Error reference: a poll that fails repeatedly with the same
        // message must not create a new Error object every cycle, or
        // consumers (CalendarMain's banner, EventListView) re-render on
        // every tick and the calendar appears to shake.
        const msg = err instanceof Error ? err.message : String(err);
        setError((prev) => (prev?.message === msg ? prev : new Error(msg)));
      })
      .finally(() => {
        setLoading(false);
      });
  }, [range?.start, range?.end, range?.minMinutes, range?.includeRecurring, range?.ownerIds]);

  const create = useCallback(async (input: CalendarEventInput): Promise<CalendarEvent> => {
    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: input.title,
        description: input.description ?? null,
        start: input.start,
        end: input.end,
        color: input.color,
        icon: input.icon ?? null,
      }),
    });
    if (!res.ok) throw new Error(`Failed to create event (${res.status})`);
    const body = (await res.json()) as { event: CalendarEvent };
    const event = body.event;
    setEvents((prev) => [...prev, event]);
    notifyEventsChanged();
    return event;
  }, []);

  const update = useCallback(
    async (id: string, patch: Partial<CalendarEventInput>): Promise<CalendarEvent> => {
      // Resolve the underlying tile from current state; the timeline
      // join surfaces tileId for every placement it returns.
      const current = events.find((e) => e.id === id);
      const tileId = current?.tileId;
      if (!tileId) {
        throw new Error("Cannot update event: tileId is unknown for this placement");
      }
      const body: Record<string, unknown> = {};
      if (patch.title !== undefined) body.title = patch.title;
      if (patch.description !== undefined) body.description = patch.description;
      if (patch.color !== undefined) body.color = patch.color;
      if (patch.icon !== undefined) body.icon = patch.icon;
      const res = await fetch(`/api/events/tiles/${encodeURIComponent(tileId)}/update`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(`Failed to update event (${res.status})`);
      const out = (await res.json()) as { tile: Partial<CalendarEvent> };
      const merged: CalendarEvent = current
        ? { ...current, ...out.tile, updatedAt: new Date().toISOString() }
        : ({ ...(out.tile as CalendarEvent), id, tileId } as CalendarEvent);
      setEvents((prev) => prev.map((e) => (e.id === id ? merged : e)));
      notifyEventsChanged();
      return merged;
    },
    [events],
  );

  const remove = useCallback(
    async (id: string): Promise<void> => {
      const current = events.find((e) => e.id === id);
      const tileId = current?.tileId;
      if (!tileId) {
        throw new Error("Cannot remove event: tileId is unknown for this placement");
      }
      const res = await fetch(`/api/events/tiles/${encodeURIComponent(tileId)}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error(`Failed to remove event (${res.status})`);
      }
      setEvents((prev) => prev.filter((e) => e.id !== id));
      notifyEventsChanged();
    },
    [events],
  );

  useEffect(() => {
    // Defer the initial reload by a microtask so the first reload call
    // doesn't run synchronously inside the effect body. The fetch chain
    // still drives every state update.
    Promise.resolve().then(() => {
      void reload();
    });
  }, [reload]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (): void => {
      void reload();
    };
    window.addEventListener(EVENTS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(EVENTS_CHANGED_EVENT, handler);
  }, [reload]);

  return { events, loading, error, reload, create, update, remove };
}
