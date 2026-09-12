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

// Stable translation function so the hook's useCallback dep stays stable
// (otherwise the dep churns each render and the test below spins).
const stableT = (key: string) => key;
vi.mock("@/shared/i18n/use-translation", () => ({
  useTranslation: () => ({ t: stableT, locale: "en" }),
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

type CallOk<T> = { ok: true; data: T; status: number; latencyMs: number };

function okExecution(
  data: typeof executionSnapshot | null,
): CallOk<typeof executionSnapshot | null> {
  return { ok: true, data, status: 200, latencyMs: 1 };
}

function failedExecution(message = "execution view unavailable") {
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
  return { ok: true, data: { items }, status: 200, latencyMs: 1 };
}

function defaultMockImpl(method: string) {
  if (method === "listAccessNotifications") {
    return Promise.resolve(okNotifications([]));
  }
  return Promise.resolve(okExecution(executionSnapshot));
}

function listCallsSoFar(): number {
  return callMock.mock.calls.filter(([m]) => m === "listAccessNotifications").length;
}

describe("useNotifications", () => {
  beforeEach(() => {
    callMock.mockReset();
    // Default behavior: every call returns a well-formed envelope so the
    // hook's re-renders don't blow up on `undefined.ok`.
    callMock.mockImplementation(defaultMockImpl);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the active execution from execution-view", async () => {
    const { result, unmount } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications.some((item) => item.id === "execution:tile-a")).toBe(true);
    });
    expect(
      result.current.notifications.find((item) => item.id === "execution:tile-a")?.message,
    ).toBe("notifications.running: First");
    unmount();
  });

  it("renders a pending prompt from execution-view", async () => {
    callMock.mockImplementation((method: string) => {
      if (method === "listAccessNotifications") {
        return Promise.resolve(okNotifications([]));
      }
      return Promise.resolve(
        okExecution({
          ...executionSnapshot,
          is_working: false,
          main_tile: null,
          main_tile_started_at: null,
          main_tile_ends_at: null,
          pending_prompt_id: "prompt-a",
        }),
      );
    });

    const { result, unmount } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications.some((item) => item.id === "prompt:prompt-a")).toBe(true);
    });
    expect(
      result.current.notifications.find((item) => item.id === "prompt:prompt-a")?.message,
    ).toBe("notifications.promptPending");
    unmount();
  });

  it("clears a stale execution notification when execution-view returns no active execution", async () => {
    const { result, unmount } = renderHook(() => useNotifications());

    await waitFor(() => {
      expect(result.current.notifications.some((item) => item.id === "execution:tile-a")).toBe(true);
    });

    callMock.mockImplementation((method: string) => {
      if (method === "listAccessNotifications") {
        return Promise.resolve(okNotifications([]));
      }
      return Promise.resolve(okExecution(null));
    });

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.notifications.some((item) => item.source === "execution")).toBe(false);
    });
    unmount();
  });

  it("surfaces execution-view errors and clears them after recovery", async () => {
    callMock.mockImplementation((method: string) => {
      if (method === "listAccessNotifications") {
        return Promise.resolve(okNotifications([]));
      }
      return Promise.resolve(failedExecution());
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

    // Override ONLY the first two listAccessNotifications calls with
    // pending promises. `mockImplementationOnce` is consumed in call order,
    // so we have to inspect the method name inside the impl.
    callMock.mockImplementation((method: string) => {
      if (method === "listAccessNotifications") {
        listCallIdx++;
        if (listCallIdx === 1) {
          return new Promise<CallOk<{ items: unknown[] }>>((r) => {
            resolveFirstList = r;
          });
        }
        if (listCallIdx === 2) {
          return new Promise<CallOk<{ items: unknown[] }>>((r) => {
            resolveSecondList = r;
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
    const { result, unmount } = renderHook(() => useNotifications());
    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    const before = listCallsSoFar();

    // Override the next listAccessNotifications call to return a populated list.
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
      expect(result.current.notifications.some((n) => n.id === "access:n1")).toBe(true);
    });
    unmount();
  });
});
