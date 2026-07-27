// Thin wrapper around the browser Notification API. Falls back to a no-op
// outside secure contexts (production) or when the user has denied permission.
// Tastile uses this in addition to the in-app notifications button — the internal
// prompt card already surfaces state changes, but the system tray is the
// only way the user notices when they have the dashboard in a background
// tab.

export type NotificationKind = "tile_started" | "tile_completed" | "prompt_pending";

export interface NotificationBody {
  kind: NotificationKind;
  title: string;
  body: string;
  // A stable id for the underlying state — pass the tile id or prompt id so
  // the notifications panel can de-duplicate rapid refreshes.
  tag: string;
}

let permissionRequested = false;

export function notificationsSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window)) return false;
  // Notification is only available in secure contexts (HTTPS or localhost).
  // window.isSecureContext is the spec-correct check.
  return window.isSecureContext;
}

export async function requestNotificationPermissionOnce(): Promise<
  NotificationPermission | "unsupported"
> {
  if (!notificationsSupported()) return "unsupported";
  if (permissionRequested) return Notification.permission;
  permissionRequested = true;
  if (Notification.permission === "default") {
    try {
      return await Notification.requestPermission();
    } catch {
      return Notification.permission;
    }
  }
  return Notification.permission;
}

export function showNotification(payload: NotificationBody): void {
  if (!notificationsSupported()) return;
  if (Notification.permission !== "granted") return;
  // Use the tag so a rapid-fire state_changed stream collapses into one
  // notification per tile/prompt instead of spamming the tray.
  try {
    const notification = new Notification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      // Suppress the noisy default sound on every refresh; let the OS chime
      // for the first one of each tag.
      silent: true,
    });
    // Auto-dismiss after 6s — the tray is for awareness, not long-form read.
    setTimeout(() => notification.close(), 6_000);
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch (err) {
    // The browser can throw when called from a non-secure context or when
    // the user is in private-browsing mode. Swallow — the in-app card is
    // still surfaced and the user is not blocked.
    console.warn("showNotification failed", err);
  }
}
