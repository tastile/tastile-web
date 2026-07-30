"use client";

/**
 * Preferences toggle that lets the user opt the browser into direct
 * cross-origin daemon mode. When ON, the server sets the
 * `tastile_direct_daemon` cookie and `getCoreClient()` switches to
 * cross-origin `fetch(..., { credentials: "include" })`. When OFF,
 * the cookie is cleared and traffic returns to `/api/proxy/*`.
 *
 * The cookie is JS-readable (the route handler does not set `HttpOnly`),
 * so the initial state is read from `document.cookie` synchronously.
 */

import { COOKIE_DIRECT_DAEMON } from "@/lib/cognito/cookie-names";
import { useTranslation } from "@/lib/i18n/use-translation";
import { Switch } from "@mantine/core";
import { useCallback, useState } from "react";

const DIRECT_MODE_ENDPOINT = "/api/account/direct-mode";

/** Reads `tastile_direct_daemon=1` from `document.cookie`. */
function readCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(/;\s*/).some((c) => c === `${COOKIE_DIRECT_DAEMON}=1`);
}

export function DirectDaemonToggle() {
  const { t } = useTranslation();
  // Lazy initializer so the first render already reflects the cookie value —
  // matches the pattern used elsewhere on this page (security lock, etc.).
  const [enabled, setEnabled] = useState<boolean>(() => readCookie());
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<"saved" | "error" | null>(null);

  const update = useCallback(async (next: boolean) => {
    setBusy(true);
    try {
      const response = await fetch(DIRECT_MODE_ENDPOINT, {
        method: next ? "POST" : "DELETE",
        credentials: "same-origin",
      });
      if (!response.ok) {
        setNotice("error");
        return;
      }
      // The Set-Cookie header is the source of truth; the cookie is JS-readable,
      // so reflect it locally without re-parsing. The toggle state must mirror
      // what the server will see on the next request.
      setEnabled(next);
      setNotice("saved");
    } catch {
      setNotice("error");
    }
    setBusy(false);
  }, []);
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold text-foreground">{t("settings.directModeLabel")}</p>
        <p className="mt-1 text-xs text-foreground-muted">{t("settings.directModeDescription")}</p>
        {notice === "saved" ? (
          <p className="mt-2 text-xs text-foreground-muted" data-testid="direct-mode-saved">
            {t("settings.directModeSaved")}
          </p>
        ) : notice === "error" ? (
          <p className="mt-2 text-xs text-danger" role="alert" data-testid="direct-mode-error">
            {t("settings.directModeSaveFailed")}
          </p>
        ) : null}
      </div>
      <Switch
        checked={enabled}
        disabled={busy}
        onChange={(event) => void update(event.currentTarget.checked)}
        aria-label={t("settings.directModeLabel")}
        data-testid="direct-mode-switch"
      />
    </div>
  );
}
