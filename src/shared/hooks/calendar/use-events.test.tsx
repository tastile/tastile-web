/** @vitest-environment jsdom */
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
});