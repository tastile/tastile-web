"use client";

import {
  EXECUTION_PROMPT_PREFIX,
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

  // Deep-link to /app/prompt for execution notifications carrying a
  // pending-decision id (`prompt:<pending_prompt_id>`). Other notifications
  // route to /app/prompt without a focus param — DecisionPromptSheet on the
  // page renders the full list and the user picks.
  //
  // `window.location.assign()` is used in place of `useRouter()` because the
  // call site must work whether or not the component is rendered inside an
  // App Router context (the existing NotificationsMenu test mounts it
  // without one — `useRouter()` throws "invariant expected app router to be
  // mounted"). Using the function form (rather than assignment to `.href`)
  // also keeps `react-hooks/immutability` happy. The reload cost on `/app/*`
  // navigation is acceptable for the once-per-click deep-link.
  function handleNotificationClick(item: NotificationItem) {
    onOpenChange(false);
    if (item.source === "execution" && isExecutionPromptNotification(item.id)) {
      const sessionId = item.id.slice(EXECUTION_PROMPT_PREFIX.length);
      window.location.assign(`/app/prompt?focus=${encodeURIComponent(sessionId)}`);
      return;
    }
    window.location.assign("/app/prompt");
  }

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
              <button
                type="button"
                key={n.id}
                onClick={() => handleNotificationClick(n)}
                data-testid={`notification-${n.id}`}
                className="block w-full cursor-pointer border-b border-surface-2 px-4 py-3 text-left last:border-b-0 hover:bg-surface-1"
              >
                <div className="text-xs text-foreground">{n.message}</div>
                <div className="mt-1 font-mono text-[10px] text-foreground-subtle">
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
