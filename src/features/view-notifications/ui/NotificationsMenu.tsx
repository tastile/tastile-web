"use client";

import {
  type NotificationItem,
  isExecutionPromptNotification,
  useNotifications,
} from "@/shared/hooks/use-notifications";
import { useTranslation } from "@/shared/i18n/use-translation";
import {
  FloatingMenu,
  FloatingMenuContent,
  FloatingMenuLabel,
  FloatingMenuSeparator,
} from "@/shared/ui/floating-menu";

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
  const { t, locale } = useTranslation();
  const { notifications, loading, error } = useNotifications();

  // Core PromptView IDs are not decision-session IDs. Until a PromptView
  // detail/resolution surface exists, prompt notifications stay visible but
  // deliberately non-actionable rather than deep-linking into /app/prompt.
  //
  // `window.location.assign()` is used for the remaining notification
  // navigation because this component is also tested outside an App Router
  // context, where `useRouter()` is unavailable.
  function handleNotificationClick(item: NotificationItem) {
    if (item.source === "execution" && isExecutionPromptNotification(item.id)) {
      return;
    }
    onOpenChange(false);
    window.location.assign("/app/prompt");
  }

  return (
    <FloatingMenu open={open} onOpenChange={onOpenChange} triggerRef={anchorRef}>
      <FloatingMenuContent align="end" sideOffset={8} className="w-80 p-0">
        <FloatingMenuLabel className="px-4 py-3 text-xs font-semibold text-foreground">
          {t("shell.floatingHeader.notifications")}
        </FloatingMenuLabel>
        {loading ? (
          <div className="p-4 text-center text-xs text-foreground-subtle">
            {t("common.loading")}
          </div>
        ) : error ? (
          <div className="p-4 text-center text-xs text-danger">{error.message}</div>
        ) : notifications.length === 0 ? (
          <div className="p-4 text-center text-xs text-foreground-subtle">
            {t("notifications.empty")}
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n) => (
              <button
                type="button"
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                disabled={n.source === "execution" && isExecutionPromptNotification(n.id)}
                data-testid={`notification-${n.id}`}
                className="block w-full cursor-pointer px-4 py-3 text-left hover:bg-surface-1 disabled:cursor-default disabled:hover:bg-transparent"
              >
                <div className="text-xs text-foreground">{n.message}</div>
                <div className="mt-1 font-mono text-caption text-foreground-subtle">
                  {n.timestamp.toLocaleTimeString(locale === "ja" ? "ja-JP" : "en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC",
                  })}
                </div>
              </button>
            ))}
          </div>
        )}
        <FloatingMenuSeparator className="m-0" />
      </FloatingMenuContent>
    </FloatingMenu>
  );
}
