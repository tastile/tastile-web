"use client";

import { useMemo } from "react";
import { useExecutionEngineContext } from "@/lib/hooks/execution-engine-context";

interface Notification {
  id: string;
  message: string;
  timestamp: Date;
}

export function NotificationsDropdown({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state } = useExecutionEngineContext();
  const notifications = useMemo<Notification[]>(() => {
    const items: Notification[] = [];
    const prompt = state.execution.pendingPrompt;
    if (prompt) {
      items.push({
        id: `prompt:${prompt.promptId}`,
        message: prompt.title ?? "確認が必要です",
        timestamp: prompt.scheduledAt,
      });
    }
    if (state.execution.activeTileId) {
      const tile = state.tiles.get(state.execution.activeTileId);
      items.push({
        id: `active:${state.execution.activeTileId.toString()}`,
        message:
          state.execution.phaseKind === "break"
            ? "休憩フェーズが実行中です"
            : `${tile?.core.title ?? "タイル"}を実行中です`,
        timestamp: state.execution.phaseStartedAt ?? new Date(),
      });
    }
    for (const envelope of state.events.slice(-8).reverse()) {
      const eventType = envelope.event.type;
      if (
        eventType !== "tile_started" &&
        eventType !== "tile_completed" &&
        eventType !== "prompt_scheduled"
      ) {
        continue;
      }
      items.push({
        id: envelope.event_id.toString(),
        message: eventMessage(eventType),
        timestamp: envelope.occurred_at,
      });
    }
    return items;
  }, [state]);

  if (!open) return null;

  return (
    <button
      type="button"
      aria-label="Close notifications"
      className="fixed inset-0 z-[60] cursor-default"
      onClick={onClose}
    >
      <div className="absolute right-4 top-14 w-80 rounded-xl bg-surface-1 shadow-lg text-left">
        <div className="border-b border-surface-2 px-4 py-3 text-xs font-semibold text-foreground">
          Notifications
        </div>
        {notifications.length === 0 ? (
          <div className="p-4 text-center text-xs text-foreground-subtle">No notifications yet</div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <div key={n.id} className="border-b border-surface-2 px-4 py-3">
                <div className="text-xs text-foreground">{n.message}</div>
                <div className="mt-1 font-mono text-[10px] text-foreground-subtle">
                  {n.timestamp.toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function eventMessage(type: string): string {
  switch (type) {
    case "tile_started":
      return "タイルの実行が開始されました";
    case "tile_completed":
      return "タイルが完了しました";
    case "prompt_scheduled":
      return "確認が必要な通知があります";
    default:
      return "通知があります";
  }
}
