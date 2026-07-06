"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { cn } from "@/lib/utils/cn";

interface NotificationsDropdownProps {
  open: boolean;
  onClose: () => void;
}

export function NotificationsDropdown({ open, onClose }: NotificationsDropdownProps) {
  const { notifications, loading, error } = useNotifications();
  const panelRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  return ReactDOM.createPortal(
    <div
      ref={panelRef}
      role="menu"
      className={cn(
        "fixed right-4 top-14 z-[60] w-80 overflow-hidden rounded-xl",
        "bg-surface-elevated border border-border shadow-lg",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
      )}
      data-state="open"
    >
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
            <div key={n.id} className="border-b border-surface-2 px-4 py-3 last:border-b-0">
              <div className="text-xs text-foreground">{n.message}</div>
              <div className="mt-1 font-mono text-[10px] text-foreground-subtle">
                {n.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>,
    document.body,
  );
}
