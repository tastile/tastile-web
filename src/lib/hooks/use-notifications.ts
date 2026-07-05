"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getCoreClient } from "@/lib/api/endpoints";
import {
  type NotificationKind,
  requestNotificationPermissionOnce,
  showNotification,
} from "@/lib/notifications/browser";

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

  const refresh = useCallback(async () => {
    const client = getCoreClient();
    const [access, execution] = await Promise.all([
      fetchAccessNotifications(),
      client.call<ExecutionSnapshot>("getExecutionView"),
    ]);

    if (access.ok) {
      setAccessItems(access.items);
      for (const item of access.items) {
        if (item.readAt) continue;
        emitOnce(seenSystemNotifications.current, `access:${item.id}`, {
          kind: "prompt_pending",
          title: "Tastile",
          body: item.message,
          tag: `access:${item.id}`,
        });
      }
    } else {
      setError(access.error);
    }

    if (execution.ok) {
      const item = toExecutionNotification(execution.data);
      setExecutionItem(item);
      if (item) {
        const kind: NotificationKind = execution.data.pending_prompt_id
          ? "prompt_pending"
          : "tile_started";
        emitOnce(seenSystemNotifications.current, item.id, {
          kind,
          title: "Tastile",
          body: item.message,
          tag: item.id,
        });
      }
    } else {
      setError(new Error(execution.error.message));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void requestNotificationPermissionOnce();
    void refresh();
    const interval = window.setInterval(() => void refresh(), 15_000);
    const onChanged = () => void refresh();
    window.addEventListener("tastile:execution-changed", onChanged);
    window.addEventListener("tastile:notifications-changed", onChanged);
    return () => {
      window.clearInterval(interval);
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

async function fetchAccessNotifications(): Promise<
  { ok: true; items: NotificationItem[] } | { ok: false; error: Error }
> {
  try {
    const res = await fetch("/api/proxy/access/notifications?limit=20", {
      headers: { accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) return { ok: false, error: new Error(`notifications API returned ${res.status}`) };
    const body = (await res.json()) as
      | ListResponse<AccessNotificationWire>
      | AccessNotificationWire[];
    const rows = Array.isArray(body) ? body : (body.items ?? []);
    return {
      ok: true,
      items: rows.map((row) => ({
        id: `access:${row.id}`,
        message: row.message ?? accessNotificationMessage(row.kind),
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

function toExecutionNotification(snapshot: ExecutionSnapshot): NotificationItem | null {
  if (snapshot.pending_prompt_id) {
    return {
      id: `prompt:${snapshot.pending_prompt_id}`,
      message: "確認が必要な通知があります",
      timestamp: new Date(),
      readAt: null,
      source: "execution",
    };
  }
  if (!snapshot.is_working || !snapshot.main_tile) return null;
  return {
    id: `execution:${snapshot.main_tile.id}`,
    message: snapshot.is_on_break
      ? "休憩フェーズが実行中です"
      : `${snapshot.main_tile.title}を実行中です`,
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

function accessNotificationMessage(kind: number): string {
  switch (kind) {
    case 1:
      return "共有オファーがあります";
    case 2:
      return "アクセスリクエストがあります";
    case 3:
    case 4:
      return "アクセス権が更新されました";
    case 5:
    case 6:
    case 7:
    case 8:
      return "アクセス通知があります";
    default:
      return "通知があります";
  }
}
