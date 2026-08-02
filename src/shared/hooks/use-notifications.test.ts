/** @vitest-environment jsdom */

import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { callMock, fetchMock } = vi.hoisted(() => ({
  callMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock("@/shared/api/endpoints", async () => {
  const actual = await vi.importActual<typeof import("@/shared/api/endpoints")>(
    "@/shared/api/endpoints",
  );
  return {
    ...actual,
    getCoreClient: () => ({ call: callMock }),
  };
});

vi.mock("@/lib/notifications/browser", () => ({
  requestNotificationPermissionOnce: vi.fn().mockResolvedValue(undefined),
  showNotification: vi.fn(),
}));

vi.mock("@/shared/i18n/use-translation", () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: "en" }),
}));

// Imported after the mocks so the hook under test uses them.
import { useNotifications } from "@/shared/hooks/use-notifications";

if (typeof window !== "undefined" && typeof window.matchMedia !== "function") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }),
  });
}

const executionSnapshot = {
  is_working: true,
  is_on_break: false,
  main_tile: { id: "tile-a", title: "First" },
  main_tile_started_at: "2026-07-23T09:00:00.000Z",
  main_tile_ends_at: "2026-07-23T10:00:00.000Z",
  pending_prompt_id: null,
};

const executionSnapshotB = {
  ...executionSnapshot,
  main_tile: { id: "tile-b", title: "Second" },
};

function okExecution(data: typeof executionSnapshot) {
  return { ok: true as const, data, status: 200, latencyMs: 1 };
}

function okNotifications(items: Array<{ id: string; message: string; created_at: string; read_at: string | null; kind: number }>) {
  return new Response(JSON.stringify({ items }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

describe("useNotifications", () => {
  beforeEach(() => {
    callMock.mockReset();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("starts in loading state and exposes an empty list", async () => {
    callMock.mockResolvedValue(okExecution(executionSnapshot));
    fetchMock.mockResolvedValueOnce(okNotifications([]));

    const { result, unmount } = renderHook(() => useNotifications());

    expect(result.current.loading).toBe(true);
    expect(result.current.notifications).toEqual([]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    unmount();
  });

  it("drops a stale access-list response when a newer refresh arrives", async () => {
    let resolveFirstList: (value: Response) => void = () => {};
    let resolveSecondList: (value: Response) => void = () => {};
    fetchMock
      .mockImplementationOnce(
        () => new Promise<Response>((r) => (resolveFirstList = r)),
      )
      .mockImplementationOnce(
        () => new Promise<Response>((r) => (resolveSecondList = r)),
      );

    callMock.mockResolvedValue(okExecution(executionSnapshot));

    const { result, unmount } = renderHook(() => useNotifications());

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    window.dispatchEvent(new CustomEvent("tastile:notifications-changed"));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    // Resolve out of order: stale empty list arrives after fresh populated list.
    resolveSecondList(
      okNotifications([
        {
          id: "notif-new",
          message: "Fresh",
          created_at: "2026-07-23T09:00:00.000Z",
          read_at: null,
          kind: 1,
        },
      ]),
    );
    resolveFirstList(okNotifications([]));

    await waitFor(() => {
      expect(result.current.notifications.some((n) => n.id === "access:notif-new")).toBe(true);
    });
    unmount();
  });

  it("refreshes when tastile:notifications-changed fires", async () => {
    callMock.mockResolvedValue(okExecution(executionSnapshot));
    fetchMock.mockResolvedValueOnce(okNotifications([]));

    const { result, unmount } = renderHook(() => useNotifications());
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const before = fetchMock.mock.calls.length;

    fetchMock.mockResolvedValueOnce(
      okNotifications([
        {
          id: "n1",
          message: "New invite",
          created_at: "2026-07-23T09:00:00.000Z",
          read_at: null,
          kind: 1,
        },
      ]),
    );
    window.dispatchEvent(new CustomEvent("tastile:notifications-changed"));

    await waitFor(() => {
      expect(fetchMock.mock.calls.length).toBeGreaterThan(before);
    });
    await waitFor(() => {
      expect(result.current.notifications.some((n) => n.id === "access:n1")).toBe(true);
    });
    unmount();
  });
});