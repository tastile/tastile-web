"use client";

import { Bell } from "lucide-react";
import {
  FloatingMenu,
  FloatingMenuContent,
  FloatingMenuLabel,
  FloatingMenuSeparator,
  FloatingMenuTrigger,
} from "@/components/ui/floating-menu";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { useTranslation } from "@/lib/i18n/use-translation";

interface NotificationsMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NotificationsMenu({ open, onOpenChange }: NotificationsMenuProps) {
  const { t } = useTranslation();
  const { notifications, loading, error } = useNotifications();

  return (
    <FloatingMenu open={open} onOpenChange={onOpenChange}>
      <FloatingMenuTrigger asChild>
        <button
          type="button"
          aria-label={t("shell.floatingHeader.openNotifications")}
          className="hidden md:inline-flex items-center justify-center rounded-md p-1.5 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
        </button>
      </FloatingMenuTrigger>
      <FloatingMenuContent align="end" sideOffset={8} className="w-80 p-0">
        <FloatingMenuLabel className="border-b border-surface-2 px-4 py-3 text-xs font-semibold text-foreground">
          Notifications
        </FloatingMenuLabel>
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
        <FloatingMenuSeparator className="m-0" />
      </FloatingMenuContent>
    </FloatingMenu>
  );
}
