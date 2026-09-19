/** @vitest-environment jsdom */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { callMock } = vi.hoisted(() => ({
  callMock: vi.fn(),
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

const stableT = (key: string) => key;
vi.mock("@/shared/i18n/use-translation", () => ({
  useTranslation: () => ({ t: stableT, locale: "en" }),
}));

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

type ActiveTileFixture = {
  tile_id: string;
  placement_id: string;
  execution_id: string | null;
  title: string;
  span_start: string | null;
  span_end: string | null;
};

type PendingPromptFixture = {
  id: string;
  created_at: string;
};

const activeTile: ActiveTileFixture = {
  tile_id: "tile-a",
  placement_id: "placement-a",
  execution_id: "execution-a",
  title: "First",
  span_start: "2026-07-23T09:00:00.000Z",
  span_end: "2026-07-23T10:00:00.000Z",
};

const pendingPrompt: PendingPromptFixture = {
  id: "prompt-a",
  created_at: "2026-07-23T09:30:00.000Z",
};

type CallOk<T> = { ok: true; data: T; status: number; latencyMs: number };

function ok<T>(data: T): CallOk<T> {
  return { ok: true, data, status: 200, latencyMs: 1 };
}

function failed(message = "execution view unavailable") {
  return {
    ok: false as const,
    error: {
      kind: "server" as const,
      status: 503,
      message,
      body: null,
    },
  };
}

function okNotifications(
  items: Array<{ id: string; message: string; created_at: string; read_at: string | null; kind: number }>,
): CallOk<{ items: typeof items }> {
  return ok({ items });
}

function defaultMockImpl(method: string) {
  if (method === "listAccessNotifications") {
    return Promise.resolve(okNotifications([]));
  }
  if (method === "getExecutionView") {
    return Promise.resolve(ok(activeTile));
  }
  if (method === "getPendingPrompt") {
    return Promise.resolve(ok<PendingPromptFixture[]>([]));
  }
  throw new Error(`unexpected endpoint: ${method}`);
}

function listCallsSoFar(): number {
  return callMock.mock.calls.filter(([m]) => m === "listAccessNotifications").length;
}

describe("useNotifications", () => {
  beforeEach(() => {
    callMock.mockReset();
    callMock.mockImplementation(defaultMockImpl);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the active tile from the current execution-view mapping", async () => {
    const { result, unmount } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications.some((item) => item.id === "execution:tile-a")).toBe(true);
    });
    expect(
      result.current.notifications.find((item) => item.id === "execution:tile-a")?.message,
    ).toBe("notifications.running: First");
    unmount();
  });

  it("prioritizes a pending prompt over the active tile", async () => {
    callMock.mockImplementation((method: string) => {
      if (method === "listAccessNotifications") {
        return Promise.resolve(okNotifications([]));
      }
      if (method === "getExecutionView") {
        return Promise.resolve(ok(activeTile));
      }
      if (method === "getPendingPrompt") {
        return Promise.resolve(ok([pendingPrompt]));
      }
      throw new Error(`unexpected endpoint: ${method}`);
    });

    const { result, unmount } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications.some((item) => item.id === "prompt:prompt-a")).toBe(true);
    });
    expect(result.current.notifications.some((item) => item.id === "execution:tile-a")).toBe(false);
    expect(
      result.current.notifications.find((item) => item.id === "prompt:prompt-a")?.message,
    ).toBe("notifications.promptPending");
    unmount();
  });

  it("shows a pending prompt even when active-tile fails", async () => {
    callMock.mockImplementation((method: string) => {
      if (method === "listAccessNotifications") {
        return Promise.resolve(okNotifications([]));
      }
      if (method === "getExecutionView") {
        return Promise.resolve(failed("active tile unavailable"));
      }
      if (method === "getPendingPrompt") {
        return Promise.resolve(ok([pendingPrompt]));
      }
      throw new Error(`unexpected endpoint: ${method}`);
    });

    const { result, unmount } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications.some((item) => item.id === "prompt:prompt-a")).toBe(true);
    });
    expect(result.current.error).toBeNull();
    unmount();
  });

  it("clears a stale execution notification when there is no active tile or pending prompt", async () => {
    const { result, unmount } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications.some((item) => item.id === "execution:tile-a")).toBe(true);
    });

    callMock.mockImplementation((method: string) => {
      if (method === "listAccessNotifications") {
        return Promise.resolve(okNotifications([]));
      }
      if (method === "getExecutionView") {
        return Promise.resolve(ok<ActiveTileFixture | null>(null));
      }
      if (method === "getPendingPrompt") {
        return Promise.resolve(ok<PendingPromptFixture[]>([]));
      }
      throw new Error(`unexpected endpoint: ${method}`);
    });

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.notifications.some((item) => item.source === "execution")).toBe(false);
    });
    unmount();
  });

  it("surfaces read-model errors and clears them after recovery", async () => {
    callMock.mockImplementation((method: string) => {
      if (method === "listAccessNotifications") {
        return Promise.resolve(okNotifications([]));
      }
      if (method === "getExecutionView") {
        return Promise.resolve(failed());
      }
      if (method === "getPendingPrompt") {
        return Promise.resolve(ok<PendingPromptFixture[]>([]));
      }
      throw new Error(`unexpected endpoint: ${method}`);
    });

    const { result, unmount } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.error?.message).toBe("execution view unavailable");
    });

    callMock.mockImplementation(defaultMockImpl);
    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.error).toBeNull();
    });
    unmount();
  });

  it("starts in loading state and exposes an empty list", async () => {
    const { result, unmount } = renderHook(() => useNotifications());

    expect(result.current.loading).toBe(true);
    expect(result.current.notifications).toEqual([]);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    unmount();
  });

  it("drops a stale access-list response when a newer refresh arrives", async () => {
    let resolveFirstList: (value: CallOk<{ items: unknown[] }>) => void = () => {};
    let resolveSecondList: (value: CallOk<{ items: unknown[] }>) => void = () => {};
    let listCallIdx = 0;

    callMock.mockImplementation((method: string) => {
      if (method === "listAccessNotifications") {
        listCallIdx++;
        if (listCallIdx === 1) {
          return new Promise<CallOk<{ items: unknown[] }>>((resolve) => {
            resolveFirstList = resolve;
          });
        }
        if (listCallIdx === 2) {
          return new Promise<CallOk<{ items: unknown[] }>>((resolve) => {
            resolveSecondList = resolve;
          });
        }
      }
      return defaultMockImpl(method);
    });

    const { result, unmount } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(listCallsSoFar()).toBeGreaterThanOrEqual(1);
    });

    window.dispatchEvent(new CustomEvent("tastile:notifications-changed"));

    await waitFor(() => {
      expect(listCallsSoFar()).toBeGreaterThanOrEqual(2);
    });

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
      expect(result.current.notifications.some((item) => item.id === "access:notif-new")).toBe(true);
    });
    unmount();
  });

  it("refreshes when tastile:notifications-changed fires", async () => {
    const { result, unmount } = renderHook(() => useNotifications());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    const before = listCallsSoFar();

    callMock.mockImplementationOnce((method: string) => {
      if (method === "listAccessNotifications") {
        return Promise.resolve(
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
      }
      return defaultMockImpl(method);
    });

    window.dispatchEvent(new CustomEvent("tastile:notifications-changed"));

    await waitFor(() => {
      expect(listCallsSoFar()).toBeGreaterThan(before);
    });
    await waitFor(() => {
      expect(result.current.notifications.some((item) => item.id === "access:n1")).toBe(true);
    });
    unmount();
  });
});
