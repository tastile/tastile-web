"use client";

import {
  type NotificationKind,
  requestNotificationPermissionOnce,
  showNotification,
} from "@/lib/notifications/browser";
import { getCoreClient } from "@/shared/api/endpoints";
import { useTranslation } from "@/shared/i18n/use-translation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

// Polling cadence used while the previous poll succeeded. When upstream
// returns a 5xx or the fetch itself fails, the next poll waits longer
// so a permanently-down daemon doesn't burn CPU/network and pollute the
// browser console with redundant errors.
const BASE_INTERVAL_MS = 15_000;
const MAX_BACKOFF_MS = 5 * 60_000;

/** Prefix for notification IDs that carry an execution pending_prompt_id. */
export const EXECUTION_PROMPT_PREFIX = "prompt:";

/** Returns true if the notification id is an execution pending-prompt id. */
export function isExecutionPromptNotification(id: string): boolean {
  return id.startsWith(EXECUTION_PROMPT_PREFIX);
}

/**
 * Compute the delay for the next poll based on the most recent result.
 * Successful polls reset to the base cadence. Failed polls grow the
 * delay (15s → 30s → 60s → 120s → 240s → … capped at 5 minutes).
 */
function nextDelayMs(consecutiveFailures: number): number {
  if (consecutiveFailures <= 0) return BASE_INTERVAL_MS;
  const exp = Math.min(consecutiveFailures, 6); // 2^6 = 64× base
  return Math.min(BASE_INTERVAL_MS * 2 ** exp, MAX_BACKOFF_MS);
}

export interface NotificationItem {
  id: string;
  message: string;
  timestamp: Date;
  readAt: Date | null;
  source: "access" | "execution";
}

interface AccessNotificationWire {
  id: string;
  kind: number;
  message: string | null;
  created_at: string;
  read_at: string | null;
}

interface ListResponse<T> {
  items?: T[];
}

interface ExecutionSnapshot {
  is_working: boolean;
  is_on_break: boolean;
  main_tile: { id: string; title: string } | null;
  main_tile_started_at: string | null;
  main_tile_ends_at: string | null;
  pending_prompt_id: string | null;
}

export function useNotifications() {
  const [accessItems, setAccessItems] = useState<NotificationItem[]>([]);
  const [executionItem, setExecutionItem] = useState<NotificationItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const seenSystemNotifications = useRef<Set<string>>(new Set());
  const requestIdRef = useRef(0);
  const { t } = useTranslation();

  const refresh = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    const client = getCoreClient();
    const [access, execution] = await Promise.all([
      fetchAccessNotifications(t),
      // The endpoint may legitimately return null when no execution is
      // active.  Type the result loosely so we can runtime-null-check
      // it here instead of crashing when /v1/active-tile returns null.
      client.call<ExecutionSnapshot | null>("getExecutionView"),
    ]);
    if (requestId !== requestIdRef.current) return { failed: false };

    let failed = false;

    if (access.ok) {
      setAccessItems(access.items);
      for (const item of access.items) {
        if (item.readAt) continue;
        emitOnce(seenSystemNotifications.current, `access:${item.id}`, {
          kind: "prompt_pending",
          title: t("notifications.brandTitle"),
          body: item.message,
          tag: `access:${item.id}`,
        });
      }
    } else {
      failed = true;
      // Stabilize the Error reference: identical failure message must not
      // mint a new Error object every 15s poll.
      const msg = access.error.message;
      setError((prev) => (prev?.message === msg ? prev : new Error(msg)));
    }

    if (execution.ok && execution.data) {
      const execData = execution.data;
      const item = toExecutionNotification(execData, t);
      setExecutionItem(item);
      if (item) {
        const kind: NotificationKind = execData.pending_prompt_id
          ? "prompt_pending"
          : "tile_started";
        emitOnce(seenSystemNotifications.current, item.id, {
          kind,
          title: t("notifications.brandTitle"),
          body: item.message,
          tag: item.id,
        });
      }
    } else if (!execution.ok) {
      failed = true;
      const msg = execution.error.message;
      setError((prev) => (prev?.message === msg ? prev : new Error(msg)));
    }
    // else: execution.ok === true && execution.data === null.  No active
    // tile, nothing to notify, no error to surface.  Skip both branches.

    setLoading(false);
    return { failed };
  }, [t]);

  useEffect(() => {
    void requestNotificationPermissionOnce();
    const failuresRef = { current: 0 };
    let cancelled = false;
    let timer: number | null = null;
    const schedule = (delay: number) => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        const run = async () => {
          const result = await refresh();
          if (cancelled) return;
          if (result.failed) failuresRef.current += 1;
          else failuresRef.current = 0;
          schedule(nextDelayMs(failuresRef.current));
        };
        void run();
      }, delay);
    };
    const initialRun = async () => {
      const result = await refresh();
      if (cancelled) return;
      if (result.failed) failuresRef.current += 1;
      schedule(nextDelayMs(failuresRef.current));
    };
    void initialRun();
    const onChanged = () => {
      failuresRef.current = 0;
      void refresh();
    };
    window.addEventListener("tastile:execution-changed", onChanged);
    window.addEventListener("tastile:notifications-changed", onChanged);
    return () => {
      cancelled = true;
      if (timer !== null) window.clearTimeout(timer);
      window.removeEventListener("tastile:execution-changed", onChanged);
      window.removeEventListener("tastile:notifications-changed", onChanged);
    };
  }, [refresh]);

  const notifications = useMemo(() => {
    const merged = executionItem ? [executionItem, ...accessItems] : accessItems;
    return merged
      .filter((item, index, arr) => arr.findIndex((other) => other.id === item.id) === index)
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }, [accessItems, executionItem]);

  const unreadCount = notifications.filter((item) => !item.readAt).length;

  return { notifications, unreadCount, loading, error, refresh };
}

async function fetchAccessNotifications(
  t: (key: string) => string,
): Promise<{ ok: true; items: NotificationItem[] } | { ok: false; error: Error }> {
  try {
    const res = await getCoreClient().call<
      ListResponse<AccessNotificationWire> | AccessNotificationWire[]
    >("listAccessNotifications", { query: { limit: 20 } });
    if (!res.ok) {
      return { ok: false, error: new Error(`notifications API returned ${res.error.status}`) };
    }
    const body = res.data;
    const rows = Array.isArray(body) ? body : (body.items ?? []);
    return {
      ok: true,
      items: rows.map((row) => ({
        id: `access:${row.id}`,
        message: row.message ?? accessNotificationMessage(row.kind, t),
        timestamp: parseDate(row.created_at),
        readAt: row.read_at ? parseDate(row.read_at) : null,
        source: "access",
      })),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err : new Error("failed to fetch notifications"),
    };
  }
}

function toExecutionNotification(
  snapshot: ExecutionSnapshot,
  t: (key: string) => string,
): NotificationItem | null {
  if (snapshot.pending_prompt_id) {
    return {
      id: `${EXECUTION_PROMPT_PREFIX}${snapshot.pending_prompt_id}`,
      message: t("notifications.promptPending"),
      timestamp: new Date(),
      readAt: null,
      source: "execution",
    };
  }
  if (!snapshot.is_working || !snapshot.main_tile) return null;
  return {
    id: `execution:${snapshot.main_tile.id}`,
    message: snapshot.is_on_break
      ? t("notifications.onBreak")
      : `${t("notifications.running")}: ${snapshot.main_tile.title}`,
    timestamp: snapshot.main_tile_started_at
      ? parseDate(snapshot.main_tile_started_at)
      : new Date(),
    readAt: null,
    source: "execution",
  };
}

function emitOnce(seen: Set<string>, key: string, payload: Parameters<typeof showNotification>[0]) {
  if (seen.has(key)) return;
  seen.add(key);
  showNotification(payload);
}

function parseDate(value: string): Date {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date() : parsed;
}

function accessNotificationMessage(kind: number, t: (key: string) => string): string {
  switch (kind) {
    case 1:
      return t("notifications.accessShareOffer");
    case 2:
      return t("notifications.accessRequest");
    case 3:
    case 4:
      return t("notifications.accessUpdated");
    case 5:
    case 6:
    case 7:
    case 8:
      return t("notifications.accessOther");
    default:
      return t("notifications.generic");
  }
}
