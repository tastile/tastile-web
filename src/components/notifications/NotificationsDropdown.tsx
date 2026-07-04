"use client";

import { useNotifications } from "@/lib/hooks/use-notifications";

export function NotificationsDropdown({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { notifications, loading, error } = useNotifications();

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
        {loading ? (
          <div className="p-4 text-center text-xs text-foreground-subtle">Loading...</div>
        ) : error ? (
          <div className="p-4 text-center text-xs text-danger">{error.message}</div>
        ) : notifications.length === 0 ? (
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
