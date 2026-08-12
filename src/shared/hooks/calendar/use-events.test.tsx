/** @vitest-environment jsdom */
import type { CalendarEvent } from "@/calendar/model/calendar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useEvents } from "./use-events";

interface TestEvent {
  id: string;
  title: string;
  start: string;
  end: string;
  allDay: boolean;
  color: "blue";
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function makeEvent(id: string, start: string, end?: string): TestEvent {
  return {
    id,
    title: id,
    start,
    end: end ?? start,
    allDay: false,
    color: "blue",
  };
}

function makeQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function makeWrapper(qc: QueryClient) {
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useEvents chunk cache", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("first load fetches and populates the chunk cache", async () => {
    const event = makeEvent("e-1", "2026-08-11T09:00:00Z", "2026-08-11T10:00:00Z");
    fetchMock.mockResolvedValue(jsonResponse({ events: [event] }));

    const qc = makeQueryClient();
    const { result } = renderHook(
      () => useEvents({ start: "2026-08-11T00:00:00.000Z", end: "2026-08-12T00:00:00.000Z" }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.events).toEqual([event]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain("/api/events/occurrences");

    // Cache must now contain the chunk we just fetched.
    const cached = qc.getQueryData<TestEvent[]>([
      "v1",
      "events-chunk",
      "2026-08-11T00:00:00.000Z",
      "2026-08-12T00:00:00.000Z",
      0,
      true,
      [],
      null,
      null,
      null,
    ]);
    expect(cached).toEqual([event]);
  });

  it("reload with the same range serves from cache without a network fetch", async () => {
    const event = makeEvent("e-1", "2026-08-11T09:00:00.000Z", "2026-08-11T10:00:00.000Z");
    fetchMock.mockResolvedValue(jsonResponse({ events: [event] }));

    const qc = makeQueryClient();
    const { result } = renderHook(
      () => useEvents({ start: "2026-08-11T00:00:00.000Z", end: "2026-08-12T00:00:00.000Z" }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockClear();
    await act(async () => {
      await result.current.reload();
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.events).toEqual([event]);
  });

  it("maxWindowDays: when every chunk is cached, reload skips fetch entirely (no skeleton flash)", async () => {
    // Build 7 single-day events so each chunked fetch returns one row.
    const events = Array.from({ length: 7 }, (_, i) =>
      makeEvent(`d${i}`, `2026-08-${10 + i}T00:00:00.000Z`, `2026-08-${10 + i}T01:00:00.000Z`),
    );
    fetchMock.mockImplementation(async (url: string) => {
      const u = new URL(url, "http://localhost");
      const start = u.searchParams.get("start") ?? "";
      const day = events.find((e) => e.start === start);
      return jsonResponse({ events: day ? [day] : [] });
    });

    const qc = makeQueryClient();
    const range = {
      start: "2026-08-10T00:00:00.000Z",
      end: "2026-08-17T00:00:00.000Z",
      maxWindowDays: 1,
    };
    const { result } = renderHook(() => useEvents(range), { wrapper: makeWrapper(qc) });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(result.current.events).toHaveLength(7);

    // Second reload — every chunk is cached, so no network call.
    fetchMock.mockClear();
    await act(async () => {
      await result.current.reload();
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.events).toHaveLength(7);
  });

  it("seeds events and loading=false from the chunk cache on initial mount (no skeleton flash on cache hit)", async () => {
    // Pre-populate the cache for an existing range. When the hook
    // mounts against this range the lazy initial state must read
    // straight from the cache, so the first paint already has events
    // and `loading=false` — no skeleton flash.
    const event = makeEvent("e-1", "2026-08-11T09:00:00.000Z", "2026-08-11T10:00:00.000Z");
    const qc = makeQueryClient();
    qc.setQueryData<CalendarEvent[]>(
      [
        "v1",
        "events-chunk",
        "2026-08-11T00:00:00.000Z",
        "2026-08-12T00:00:00.000Z",
        0,
        true,
        [],
        null,
        null,
        null,
      ],
      // CalendarEvent requires extra fields that the cache helper
      // doesn't really need for this test — cast through `unknown`.
      [event as unknown as CalendarEvent],
    );

    const { result } = renderHook(
      () => useEvents({ start: "2026-08-11T00:00:00.000Z", end: "2026-08-12T00:00:00.000Z" }),
      { wrapper: makeWrapper(qc) },
    );

    // Initial render reads the cache synchronously.
    expect(result.current.loading).toBe(false);
    expect(result.current.events).toEqual([event]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("negative cache: an empty [] chunk result seeds loading=false on remount", async () => {
    // The user-visible scenario: previous fetch for the range returned
    // no tiles. That empty array must be cached and serve the next
    // mount synchronously, so the user doesn't see a skeleton on
    // re-navigation to a range that has no events.
    fetchMock.mockResolvedValue(jsonResponse({ events: [] }));

    const qc = makeQueryClient();
    const range = { start: "2026-08-11T00:00:00.000Z", end: "2026-08-12T00:00:00.000Z" };

    // First mount fetches and stores [] in the cache.
    const first = renderHook(() => useEvents(range), { wrapper: makeWrapper(qc) });
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    expect(first.result.current.events).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Unmount, then remount against the same range. The cache must
    // serve the empty array synchronously: loading=false on first
    // render, no second network call.
    first.unmount();
    fetchMock.mockClear();
    const second = renderHook(() => useEvents(range), { wrapper: makeWrapper(qc) });
    expect(second.result.current.loading).toBe(false);
    expect(second.result.current.events).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maxWindowDays: render-time reseed serves partial events with loading=true (Day → Week, only Day's chunk is cached)", async () => {
    // Regression: prior bug had `readChunkState` return `events: []` whenever
    // ANY chunk was missing, which made a partial-cache range flash a
    // skeleton on first paint even though some chunks were already warm.
    // The correct shape is `events: <accumulator>` paired with
    // `loading: true` — the same accumulation logic the reload body uses.
    //
    // User-visible scenario: open the calendar on Day (its 1-day chunk
    // gets fetched and cached), then navigate to Week. 6 of Week's 7
    // chunks are missing, but the Day chunk IS one of them — the
    // initial paint of Week must show that 1 cached event with the
    // loading flag on, not an empty array. With the buggy `events: []`,
    // WeekPanel's `loadingEvents && events.length === 0` guard would
    // hand the user a skeleton flash even though 1/7 chunks is warm.
    const dayChunkEvent = makeEvent("e-1", "2026-08-12T09:00:00.000Z", "2026-08-12T10:00:00.000Z");
    const qc = makeQueryClient();
    qc.setQueryData<CalendarEvent[]>(
      [
        "v1",
        "events-chunk",
        "2026-08-12T00:00:00.000Z",
        "2026-08-13T00:00:00.000Z",
        0,
        true,
        [],
        null,
        null,
        null,
      ],
      [dayChunkEvent as unknown as CalendarEvent],
    );

    const fetchEvents = [
      dayChunkEvent,
      makeEvent("d10", "2026-08-10T00:00:00.000Z"),
      makeEvent("d11", "2026-08-11T00:00:00.000Z"),
      makeEvent("d13", "2026-08-13T00:00:00.000Z"),
      makeEvent("d14", "2026-08-14T00:00:00.000Z"),
      makeEvent("d15", "2026-08-15T00:00:00.000Z"),
      makeEvent("d16", "2026-08-16T00:00:00.000Z"),
    ];
    fetchMock.mockImplementation(async (url: string) => {
      const u = new URL(url, "http://localhost");
      const start = u.searchParams.get("start") ?? "";
      const day = fetchEvents.find((e) => e.start === start);
      return jsonResponse({ events: day ? [day] : [] });
    });

    const { result } = renderHook(
      () =>
        useEvents({
          start: "2026-08-10T00:00:00.000Z",
          end: "2026-08-17T00:00:00.000Z",
          maxWindowDays: 1,
        }),
      { wrapper: makeWrapper(qc) },
    );

    // Initial render — synchronous cache walk. The cached Day chunk
    // must surface immediately; `loading` stays true because 6 of 7
    // chunks are still missing.
    expect(result.current.loading).toBe(true);
    expect(result.current.events.map((e) => e.id)).toEqual(["e-1"]);

    // Reload resolves the remaining 6 chunks.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(result.current.events).toHaveLength(7);
  });

  it("maxWindowDays: range change with every chunk already cached skips the network (Week → Day → Week round-trip)", async () => {
    // Simulates the user-visible scenario: visit Week (7 chunks cached),
    // navigate to Day (Day chunk fetched, Week chunks untouched),
    // navigate back to Week. The Week return must hit the existing
    // chunk cache for all 7 days and not call fetch — that is the
    // "should be instant" promise the user expects.
    const events = Array.from({ length: 7 }, (_, i) =>
      makeEvent(`w${i}`, `2026-08-${10 + i}T00:00:00.000Z`, `2026-08-${10 + i}T01:00:00.000Z`),
    );
    fetchMock.mockImplementation(async (url: string) => {
      const u = new URL(url, "http://localhost");
      const start = u.searchParams.get("start") ?? "";
      const day = events.find((e) => e.start === start);
      return jsonResponse({ events: day ? [day] : [] });
    });

    const qc = makeQueryClient();
    const weekRange: Args = {
      start: "2026-08-10T00:00:00.000Z",
      end: "2026-08-17T00:00:00.000Z",
      maxWindowDays: 1,
    };
    // Day's range is the third day of the Week, so its chunk key
    // (Aug 12 → Aug 13) is identical to one of Week's chunks. The
    // Day → Week → Day round-trip therefore exercises only chunks
    // that are already in cache.
    const dayRange: Args = {
      start: "2026-08-12T00:00:00.000Z",
      end: "2026-08-13T00:00:00.000Z",
    };

    interface Args {
      start: string;
      end: string;
      maxWindowDays?: number;
    }

    const { result, rerender } = renderHook(({ args }: { args: Args }) => useEvents(args), {
      wrapper: makeWrapper(qc),
      initialProps: { args: weekRange },
    });

    // First mount on Week — fetches all 7 chunks.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(7);
    expect(result.current.events).toHaveLength(7);

    // Navigate to Day. Day's chunk key matches the Aug 12-13 Week
    // chunk, so no new fetch is needed.
    fetchMock.mockClear();
    rerender({ args: dayRange });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.events).toHaveLength(1);

    // Navigate back to Week. All 7 Week chunks must still be cached,
    // so this must NOT issue any fetch. If it does, the cache walk is
    // missing chunks and the user sees a skeleton/lag on every Week
    // re-entry.
    fetchMock.mockClear();
    rerender({ args: weekRange });
    // Synchronous cache walk: loading flips to false in the same tick
    // as the rerender. waitFor is the only async step here; the
    // assertions below verify nothing else happened in the meantime.
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.events).toHaveLength(7);
  });

  it("maxWindowDays: partial cache fetches only the missing chunks", async () => {
    // Chunks 10–12 are fetched first; the second reload asks for 12–15
    // (chunks 12, 13, 14). Chunk 12 is cached, 13/14 are misses.
    const d10 = makeEvent("d10", "2026-08-10T00:00:00.000Z");
    const d11 = makeEvent("d11", "2026-08-11T00:00:00.000Z");
    const d12 = makeEvent("d12", "2026-08-12T00:00:00.000Z");
    const d13 = makeEvent("d13", "2026-08-13T00:00:00.000Z");
    const d14 = makeEvent("d14", "2026-08-14T00:00:00.000Z");

    fetchMock.mockImplementation(async (url: string) => {
      const u = new URL(url, "http://localhost");
      const start = u.searchParams.get("start") ?? "";
      const map: Record<string, TestEvent> = {
        "2026-08-10T00:00:00.000Z": d10,
        "2026-08-11T00:00:00.000Z": d11,
        "2026-08-12T00:00:00.000Z": d12,
        "2026-08-13T00:00:00.000Z": d13,
        "2026-08-14T00:00:00.000Z": d14,
      };
      return jsonResponse({ events: map[start] ? [map[start]] : [] });
    });

    const qc = makeQueryClient();
    interface Range {
      start: string;
      end: string;
    }
    const initial: Range = { start: "2026-08-10T00:00:00.000Z", end: "2026-08-13T00:00:00.000Z" };
    const { result, rerender } = renderHook(
      ({ range }: { range: Range }) =>
        useEvents({ start: range.start, end: range.end, maxWindowDays: 1 }),
      { wrapper: makeWrapper(qc), initialProps: { range: initial } },
    );

    await waitFor(() => expect(result.current.events).toHaveLength(3));
    expect(fetchMock).toHaveBeenCalledTimes(3);

    // Switch to a range that overlaps the cached chunks only on its first day.
    fetchMock.mockClear();
    rerender({ range: { start: "2026-08-12T00:00:00.000Z", end: "2026-08-15T00:00:00.000Z" } });

    // Wait for events to reflect the new range — d12 from cache, d13/d14
    // fetched fresh. Asserting on content (not on loading) avoids
    // resolving on the initial load's already-false loading state.
    await waitFor(() =>
      expect(result.current.events.map((e) => e.id).sort()).toEqual(["d12", "d13", "d14"]),
    );

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("create() drops every cached chunk so the next reload refetches", async () => {
    const event = makeEvent("e-1", "2026-08-11T09:00:00.000Z", "2026-08-11T10:00:00.000Z");
    const newEvent = makeEvent("new-1", "2026-08-11T15:00:00.000Z", "2026-08-11T16:00:00.000Z");

    fetchMock.mockImplementation(async (url: string | URL | Request, init?: RequestInit) => {
      const urlStr = String(url);
      const method = init?.method ?? "GET";
      if (urlStr.includes("/api/events/occurrences")) {
        return jsonResponse({ events: [event] });
      }
      if (method === "POST" && /\/api\/events(\?|$)/.test(urlStr)) {
        return jsonResponse({ event: newEvent });
      }
      throw new Error(`Unexpected fetch: ${method} ${urlStr}`);
    });

    const qc = makeQueryClient();
    const { result } = renderHook(
      () => useEvents({ start: "2026-08-11T00:00:00.000Z", end: "2026-08-12T00:00:00.000Z" }),
      { wrapper: makeWrapper(qc) },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Cache should hold the chunk we fetched.
    const chunkKey = [
      "v1",
      "events-chunk",
      "2026-08-11T00:00:00.000Z",
      "2026-08-12T00:00:00.000Z",
      0,
      true,
      [],
      null,
      null,
      null,
    ];
    expect(qc.getQueryData(chunkKey)).toBeDefined();

    // create() drops the cached chunk. The `notifyEventsChanged()`
    // listener that fires right after will trigger a reload that
    // re-fetches from the network — the assertion below confirms the
    // chunk is gone immediately after the POST resolves.
    let createError: unknown = null;
    await act(async () => {
      try {
        await result.current.create({
          title: newEvent.title,
          start: newEvent.start,
          end: newEvent.end,
          color: newEvent.color,
          allDay: false,
          recurrence: { frequency: "none" },
        });
      } catch (err) {
        createError = err;
      }
    });

    if (createError) throw createError;

    // create() drops the cached chunk AND dispatches `events-changed`,
    // which fires the listener → reload → fetch. Net effect on the
    // fetch counter: initial GET + create POST + listener reload GET = 3.
    // If the cache had NOT been dropped, the listener's reload would
    // hit the cache and skip the network fetch (counter would stay at 2).
    await waitFor(() => expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(3));
  });

  it("different params (minMinutes) miss the cache even with the same range", async () => {
    const event = makeEvent("e-1", "2026-08-11T09:00:00.000Z", "2026-08-11T10:00:00.000Z");
    fetchMock.mockResolvedValue(jsonResponse({ events: [event] }));

    interface Args {
      start: string;
      end: string;
      minMinutes?: number;
    }
    const initialArgs: Args = { start: "2026-08-11T00:00:00.000Z", end: "2026-08-12T00:00:00.000Z" };

    const qc = makeQueryClient();
    const { result, rerender } = renderHook(({ args }: { args: Args }) => useEvents(args), {
      wrapper: makeWrapper(qc),
      initialProps: { args: initialArgs },
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockClear();
    rerender({ args: { start: "2026-08-11T00:00:00.000Z", end: "2026-08-12T00:00:00.000Z", minMinutes: 30 } });
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Different minMinutes → different cache key → miss → fetch.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("inflight guard: concurrent reload() calls with the same range share one fetch promise", async () => {
    // The Week-lag root cause: when the effect that drives reload()
    // fires twice for the same range (React 19 dev / StrictMode-style
    // double-invoke, or any other source of re-entrancy), both
    // invocations walk the same still-empty chunk cache and each kick
    // off a fresh set of parallel fetches. Without the inflight guard
    // Week navigation fires 14 requests for 7 chunks. With the guard,
    // a second reload() call while the first is still pending returns
    // the existing in-flight promise and issues zero additional
    // network requests.
    //
    // We can't easily simulate React's effect double-invoke, but we
    // can call reload() directly while the initial mount's fetch is
    // still pending — same shape, same race.
    let release: (value: Response) => void = () => {};
    const blocked = new Promise<Response>((resolve) => {
      release = resolve;
    });
    fetchMock.mockReturnValue(blocked);

    const qc = makeQueryClient();
    const { result } = renderHook(
      () => useEvents({ start: "2026-08-11T00:00:00.000Z", end: "2026-08-12T00:00:00.000Z" }),
      { wrapper: makeWrapper(qc) },
    );

    // Wait for the effect-driven reload to start its fetch.
    await waitFor(() => expect(result.current.loading).toBe(true));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Fire a second reload() while the first is still pending. The
    // dedupe guard should attach to the existing in-flight promise
    // and NOT issue a second fetch. We capture the promise but don't
    // await it yet — awaiting here would deadlock because the original
    // fetch is still blocked.
    fetchMock.mockClear();
    const secondReload = result.current.reload();
    expect(fetchMock).not.toHaveBeenCalled();

    // Resolve the original fetch; the IIFE unwinds, setLoading(false)
    // runs, and the shared promise resolves so the awaited reload
    // call from the test can complete too.
    release(jsonResponse({ events: [] }));
    await secondReload;
    expect(fetchMock).not.toHaveBeenCalled();
    await waitFor(() => expect(result.current.loading).toBe(false));
  });
});