"use client";

import {
  FloatingMenu,
  FloatingMenuContent,
  FloatingMenuLabel,
  FloatingMenuSeparator,
} from "@/components/ui/floating-menu";
import { useNotifications } from "@/lib/hooks/use-notifications";
import { useTranslation } from "@/lib/i18n/use-translation";

interface NotificationsMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // The Bell button element (lives in FloatingHeader). Required for
  // the panel to anchor at the correct position; without it
  // FloatingMenuContent's positioning effect bails out and the
  // panel renders invisible (data-state stays "closed").
  anchorRef?: React.RefObject<HTMLElement | null>;
}

// Panel-only companion to the Bell button in FloatingHeader.
// The trigger used to live inside this component (Radix-style
// compound), but the dashboard layout mounts this as a sibling
// overlay next to SearchOverlay. With the trigger rendered
// in-place at the bottom of the layout DOM tree it ended up
// pushed off-screen by the `flex-1` main row, making the bell
// invisible. The trigger now lives in FloatingHeader; we accept
// its ref here so FloatingMenuContent can anchor to it.
export function NotificationsMenu({ open, onOpenChange, anchorRef }: NotificationsMenuProps) {
  const { t } = useTranslation();
  const { notifications, loading, error } = useNotifications();

  return (
    <FloatingMenu open={open} onOpenChange={onOpenChange} triggerRef={anchorRef}>
      <FloatingMenuContent align="end" sideOffset={8} className="w-80 p-0">
        <FloatingMenuLabel className="border-b border-surface-2 px-4 py-3 text-xs font-semibold text-foreground">
          {t("shell.floatingHeader.notifications")}
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
