"use client";

import type { CalendarEvent, CalendarEventInput } from "@/calendar/model/calendar";
import { queryKeys } from "@/shared/query/query-keys";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";

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
  /** Compact representative projection for month/year views. */
  summary?: "month";
  /** Hide recurring occurrences whose generator cadence is at or below this value. */
  minRecurringStepMs?: number;
  /**
   * When set, the range is split into chunks of this many days (max) and
   * each chunk is fetched independently.  The Rust /v1/timeline API caps
   * at 31 days per request, so year-view (365 d) must chunk.
   */
  maxWindowDays?: number;
  /**
   * When set, the request asks the upstream API for at most this many
   * events.  Used by month view to keep the response size bounded when
   * the owner has a dense schedule.  Defaults to unlimited.
   */
  limit?: number;
}

const EVENTS_CHANGED_EVENT = "tastile:events-changed";

/** Split [start, end) into at most `maxDays`-wide contiguous sub-ranges. */
function splitRange(start: string, end: string, maxDays: number): Array<{ start: string; end: string }> {
  const chunks: Array<{ start: string; end: string }> = [];
  let cursor = new Date(start);
  const stop = new Date(end);
  while (cursor < stop) {
    const chunkEnd = new Date(cursor);
    chunkEnd.setDate(chunkEnd.getDate() + maxDays);
    if (chunkEnd > stop) chunkEnd.setTime(stop.getTime());
    chunks.push({ start: cursor.toISOString(), end: chunkEnd.toISOString() });
    cursor = new Date(chunkEnd);
  }
  return chunks;
}

/** Build the TanStack Query key for a single chunk. All params that
 *  influence the upstream response must appear in the key so a
 *  `minMinutes` change, owner selection swap, etc. invalidates the
 *  chunk instead of serving stale data. `ownerIds` is sorted so two
 *  equivalent arrays produce the same key.
 */
function buildChunkKey(
  start: string,
  end: string,
  minMinutes: number | undefined,
  includeRecurring: boolean | undefined,
  ownerIds: readonly string[] | undefined,
  summary: string | undefined,
  minRecurringStepMs: number | undefined,
  limit: number | undefined,
): readonly unknown[] {
  return [
    ...queryKeys.eventsChunk,
    start,
    end,
    minMinutes ?? 0,
    includeRecurring ?? true,
    ownerIds ? [...ownerIds].sort() : [],
    summary ?? null,
    minRecurringStepMs ?? null,
    limit ?? null,
  ];
}

export function notifyEventsChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(EVENTS_CHANGED_EVENT));
}

/** Read the chunk cache synchronously for the supplied range. Returns the
 *  accumulator plus a loading flag set to `true` only when at least one
 *  chunk is still missing. Used by `useEvents` to seed the lazy initial
 *  state so the first paint already reflects the cache state — a fully-
 *  cached range (including one that returned [] the previous time it was
 *  fetched) paints directly with real data, no skeleton flash. Mirrors
 *  the cache walk inside `reload`, but never reaches the network. */
function readChunkState(
  queryClient: ReturnType<typeof useQueryClient>,
  range: UseEventsRange | undefined,
): { events: CalendarEvent[]; loading: boolean } {
  if (typeof window === "undefined") return { events: [], loading: true };
  const start = range?.start;
  const end = range?.end;
  if (!start || !end) return { events: [], loading: true };
  if (range?.ownerIds?.length === 0) return { events: [], loading: false };

  // Optional chaining throughout — after the `!start || !end` return
  // above `range` is guaranteed defined at runtime, but TypeScript's
  // narrowing across early returns is not reliable inside nested
  // helpers, and `useEventsRange` is `T | undefined` per the public
  // hook signature.
  const chunkKey = (s: string, e: string) =>
    buildChunkKey(
      s,
      e,
      range?.minMinutes,
      range?.includeRecurring,
      range?.ownerIds,
      range?.summary,
      range?.minRecurringStepMs,
      range?.limit,
    );

  const maxWindowDays = range?.maxWindowDays;

  if (maxWindowDays) {
    const chunks = splitRange(start, end, maxWindowDays);
    const acc: CalendarEvent[] = [];
    const seen = new Set<string>();
    let allCached = true;
    for (const c of chunks) {
      const cached = queryClient.getQueryData<CalendarEvent[]>(chunkKey(c.start, c.end));
      if (cached !== undefined) {
        for (const ev of cached) {
          if (!seen.has(ev.id)) {
            seen.add(ev.id);
            acc.push(ev);
          }
        }
      } else {
        allCached = false;
      }
    }
    // Render-time reseed must hand the consumer every cached event, even
    // when only some chunks are present. The reload body accumulates the
    // same way (see `runReload` below) and pairs `acc` with
    // `loading: true` until the missing chunks arrive — a fully-empty
    // reseed would erase the cache hit and force a skeleton flash on
    // e.g. Day → Week, where the Day view's chunk is already warm but
    // 6 of the Week view's 7 chunks are still missing.
    return { events: acc, loading: !allCached };
  }

  const cached = queryClient.getQueryData<CalendarEvent[]>(chunkKey(start, end));
  if (cached !== undefined) {
    return { events: cached, loading: false };
  }
  return { events: [], loading: true };
}

export function useEvents(range?: UseEventsRange): UseEventsState {
  const queryClient = useQueryClient();
  const initial = readChunkState(queryClient, range);
  const [events, setEvents] = useState<CalendarEvent[]>(initial.events);
  const [loading, setLoading] = useState<boolean>(initial.loading);
  const [error, setError] = useState<Error | null>(null);

  // Reseed events/loading from the chunk cache whenever the range identity
  // changes. `useState` only runs its initializer on mount, so on a rerender
  // (Week → Day → Week round-trip) the state would otherwise keep the
  // previous view's events until the effect-driven reload's `setEvents`
  // commits — a visible flash of the wrong view's data, even though the
  // chunk cache itself already has the answer. Re-seeding during render
  // makes React discard the stale pass before commit, so the consumer
  // sees the cached answer in the very next paint.
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes
  const rangeKey = [
    range?.start ?? "",
    range?.end ?? "",
    range?.minMinutes ?? "",
    range?.includeRecurring ?? "",
    range?.ownerIds ? [...range.ownerIds].sort().join(",") : "",
    range?.summary ?? "",
    range?.minRecurringStepMs ?? "",
    range?.maxWindowDays ?? "",
    range?.limit ?? "",
  ].join("|");
  const [committedRangeKey, setCommittedRangeKey] = useState(rangeKey);
  if (committedRangeKey !== rangeKey) {
    const reseed = readChunkState(queryClient, range);
    setCommittedRangeKey(rangeKey);
    setEvents(reseed.events);
    setLoading(reseed.loading);
  }

  // In-flight dedupe. When the effect that drives `reload` fires twice
  // for the same range (React 19 dev / StrictMode-style double-invoke,
  // or the microtask-deferred reload racing with an external
  // `events-changed` listener), both invocations walk the same still-
  // empty cache and each kicks off a fresh set of parallel chunk
  // fetches — Week navigation ends up firing 14 requests for 7 chunks.
  // Track the most recent in-flight reload keyed by range identity;
  // subsequent reload() calls with the same key attach to that promise
  // instead of duplicating the network round.
  const inflightRef = useRef<{ key: string; promise: Promise<void> } | null>(null);

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
    const summary = range?.summary;
    const minRecurringStepMs = range?.minRecurringStepMs;
    const maxWindowDays = range?.maxWindowDays;
    const limit = range?.limit;

    // Identity key for the in-flight dedupe. Every field that affects
    // either the cache walk or the upstream request must appear here;
    // otherwise a minMinutes/ownerIds swap would dedupe against the
    // previous request and serve stale data.
    const dedupeKey =
      `${start ?? ""}|${end ?? ""}|${minMinutes ?? ""}|${includeRecurring ?? ""}|` +
      `${(ownerIds ?? []).join(",")}|${summary ?? ""}|${minRecurringStepMs ?? ""}|` +
      `${maxWindowDays ?? ""}|${limit ?? ""}`;

    const existing = inflightRef.current;
    if (existing && existing.key === dedupeKey) {
      return existing.promise;
    }

    const promise = (async () => {
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

    /** Build the query-string for a single chunk. */
    const buildQs = (s: string, e: string) => {
      const qs = new URLSearchParams();
      qs.set("start", s);
      qs.set("end", e);
      qs.set("min_minutes", String(minMinutes ?? 0));
      qs.set("include_recurring", String(includeRecurring ?? true));
      if (summary) qs.set("summary", summary);
      if (minRecurringStepMs && minRecurringStepMs > 0) {
        qs.set("min_recurring_step_ms", String(minRecurringStepMs));
      }
      if (ownerIds?.length) qs.set("owner_ids", ownerIds.join(","));
      if (limit && limit > 0) qs.set("limit", String(limit));
      return qs.toString();
    };

    const chunkKey = (s: string, e: string) =>
      buildChunkKey(s, e, minMinutes, includeRecurring, ownerIds, summary, minRecurringStepMs, limit);

    /** Network fetch only — no cache reads or writes. */
    const fetchFromNetwork = async (s: string, e: string): Promise<CalendarEvent[]> => {
      const res = await fetch(`${OCC_BASE}?${buildQs(s, e)}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load events (${res.status})`);
      const data = (await res.json()) as
        | { events: CalendarEvent[] }
        | { occurrences: CalendarEvent[] };
      return ("events" in data ? data.events : (data as { occurrences: CalendarEvent[] }).occurrences) ?? [];
    };

    /** Read-through cache: return cached events if present, else fetch
     *  and populate the cache. Cache lookups happen against TanStack
     *  Query's shared queryClient so a Day chunk fetched on a previous
     *  view serves synchronously on a Day → Week → Day round trip. */
    const fetchChunk = async (s: string, e: string): Promise<CalendarEvent[]> => {
      const key = chunkKey(s, e);
      const cached = queryClient.getQueryData<CalendarEvent[]>(key);
      if (cached) return cached;
      const fresh = await fetchFromNetwork(s, e);
      queryClient.setQueryData<CalendarEvent[]>(key, fresh);
      return fresh;
    };

    // The reload body is expressed as a Promise chain (.then/.catch/.finally)
// rather than a try/catch/finally block. The React Compiler does not lower
// TryStatement, so any `try` — with or without `catch`/`finally` — disables
// auto-memoization for this component. See react-doctor's `react-hooks-js/
// todo` rule for the canonical fix.
const runReload = async (): Promise<void> => {
  if (maxWindowDays) {
    // Split the range into <= maxWindowDays chunks. Each chunk is
    // looked up in the chunk cache first; misses are fetched in
    // parallel and progressively merged into state so the UI paints
    // partial data (e.g. week 1 of a Month view before week 5).
    //
    // If EVERY chunk is already cached, skip `setLoading(true)`
    // entirely and update state synchronously — this is what removes
    // the skeleton flash on Day → Week → Day navigation: the second
    // Day view reads its chunk straight from cache.
    //
    // Otherwise `loading` stays true until every chunk has resolved,
    // because Month view renders skeleton placeholders for any cell
    // whose date range has not yet arrived. Flipping `loading` off
    // on the first chunk would erase skeletons from still-pending
    // cells and the user would see "real cards in some weeks,
    // nothing in others" with no signal that empty weeks are still
    // loading.
    const chunks = splitRange(start, end, maxWindowDays);
    const seen = new Set<string>();
    let acc: CalendarEvent[] = [];
    const missingChunks: Array<{ start: string; end: string }> = [];
    const errors: string[] = [];

    // Synchronous cache walk. Avoids `await` so React can paint the
    // cached accumulator in the same render pass as the reload.
    for (const c of chunks) {
      const cached = queryClient.getQueryData<CalendarEvent[]>(chunkKey(c.start, c.end));
      if (cached) {
        for (const ev of cached) {
          if (!seen.has(ev.id)) {
            seen.add(ev.id);
            acc.push(ev);
          }
        }
      } else {
        missingChunks.push(c);
      }
    }

    if (missingChunks.length === 0) {
      // All chunks served from cache — no network, no skeleton flash.
      setEvents(acc);
      setLoading(false);
      setError(null);
      return;
    }

    // Some chunks still need fetching. Set loading before kicking
    // off the parallel fetches so the panel renders skeletons for
    // any cell whose chunk hasn't arrived yet.
    setLoading(true);
    setError(null);

    await Promise.all(
      missingChunks.map((c) =>
        fetchChunk(c.start, c.end)
          .then((batch) => {
            const fresh: CalendarEvent[] = [];
            for (const ev of batch) {
              if (!seen.has(ev.id)) {
                seen.add(ev.id);
                fresh.push(ev);
              }
            }
            if (fresh.length > 0) {
              acc = [...acc, ...fresh];
              setEvents(acc);
            }
          })
          .catch((err: unknown) => {
            errors.push(err instanceof Error ? err.message : String(err));
          }),
      ),
    );

    // Stable Error reference: a poll that fails repeatedly with the same
    // message must not create a new Error object every cycle, or
    // consumers (CalendarMain's banner, EventListView) re-render on
    // every tick and the calendar appears to shake.
    const recordError = (msg: string) =>
      setError((prev) => (prev?.message === msg ? prev : new Error(msg)));

    if (acc.length === 0 && errors.length === missingChunks.length) {
      // Every missing chunk failed — surface the first error.
      recordError(errors[0]);
      return;
    }
    if (errors.length > 0) {
      // Partial failure — record but keep the partial data
      // already pushed to state.
      recordError(`${errors.length}/${missingChunks.length} chunks failed: ${errors[0]}`);
    }
  } else {
    // Single-chunk path: cache hit → synchronous setEvents, miss → fetch.
    const key = chunkKey(start, end);
    const cached = queryClient.getQueryData<CalendarEvent[]>(key);
    if (cached) {
      setEvents(cached);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    await fetchChunk(start, end).then((batch) => {
      setEvents(batch);
    });
  }
};

await runReload()
  .catch((err: unknown) => {
    // Stable Error reference for unexpected failures (e.g. the single-
    // chunk fetch rejecting). Mirrors the behavior of the prior
    // try/catch — same Error-reference stability.
    const msg = err instanceof Error ? err.message : String(err);
    setError((prev) => (prev?.message === msg ? prev : new Error(msg)));
  })
  .finally(() => {
    setLoading(false);
  });
})();

// Register this promise as the active in-flight reload and arm a
// cleanup that clears the slot only if no newer reload has supplanted
// it. We key on promise identity (not the dedupe key) so a stale
// in-flight reload that finishes first doesn't accidentally clear the
// slot for a newer reload that's still pending.
inflightRef.current = { key: dedupeKey, promise };
promise.finally(() => {
  if (inflightRef.current?.promise === promise) {
    inflightRef.current = null;
  }
});

return promise;
}, [
    range?.start,
    range?.end,
    range?.minMinutes,
    range?.includeRecurring,
    range?.ownerIds,
    range?.summary,
    range?.minRecurringStepMs,
    range?.maxWindowDays,
    range?.limit,
    queryClient,
  ]);

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
    // Drop every cached chunk so the next reload refetches and the new
    // event surfaces in whichever range actually contains it. We
    // could surgically patch only chunks that overlap with `event`,
    // but the simplicity of a wholesale drop matches the small chunk
    // count typical of dashboard navigation.
    queryClient.removeQueries({ queryKey: queryKeys.eventsChunk });
    notifyEventsChanged();
    return event;
  }, [queryClient]);

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
      queryClient.removeQueries({ queryKey: queryKeys.eventsChunk });
      notifyEventsChanged();
      return merged;
    },
    [events, queryClient],
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
      queryClient.removeQueries({ queryKey: queryKeys.eventsChunk });
      notifyEventsChanged();
    },
    [events, queryClient],
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
      // External invalidation (e.g. QuickCreate submission in another
      // panel) — drop every cached chunk so the reload that follows
      // actually fetches fresh data instead of serving from cache.
      queryClient.removeQueries({ queryKey: queryKeys.eventsChunk });
      void reload();
    };
    window.addEventListener(EVENTS_CHANGED_EVENT, handler);
    return () => window.removeEventListener(EVENTS_CHANGED_EVENT, handler);
  }, [reload, queryClient]);

  return { events, loading, error, reload, create, update, remove };
}
