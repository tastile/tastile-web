"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountMenu } from "@/app/app/account-menu";
import { ActiveExecutionBar } from "@/components/execution/ActiveExecutionBar";
import { TastileLogo } from "@/components/TastileLogo";
import type { ExecutionSyncStatus } from "@/lib/domain/execution";
import { useTranslation } from "@/lib/i18n/use-translation";

interface HeaderProps {
  executionState?: {
    activeTileTitle: string | null;
    phaseKind: "work" | "break" | "idle";
    phaseStartedAt: Date | null;
    phaseEndsAt: Date | null;
    nextActionableStartAt?: Date | null;
    syncStatus?: ExecutionSyncStatus | null;
  };
}

export function Header({ executionState }: HeaderProps) {
  const { t } = useTranslation();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [userData, setUserData] = useState<{
    displayName: string;
    email: string;
    plan: string;
  } | null>(null);

  useEffect(() => {
    // The session route intentionally returns only safe metadata
    // ({sub, exp, owner_id}) — no email, name, picture, or Cognito
    // token material. We derive the avatar/display label from `owner_id`
    // when present and from `sub` as a fallback. Anything richer (real
    // profile fields) must come from a dedicated /v1 profile endpoint,
    // not from decoding an id_token in the browser.
    void (async () => {
      const session = await fetchSafeSession();
      if (!session) {
        setAvatarUrl(null);
        setUserData(null);
        return;
      }

      const fallbackName = session.owner_id
        ? session.owner_id.slice(0, 8)
        : session.sub.slice(0, 8);

      setAvatarUrl(null);
      setUserData({
        displayName: fallbackName,
        email: "",
        plan: "free",
      });
    })();
  }, []);

  return (
    <header className="flex h-14 items-center justify-between rounded-xl bg-surface-elevated px-4 lg:h-16">
      {/* Left: App Icon */}
      <div className="flex items-center gap-2.5">
        <TastileLogo size={28} className="text-foreground" />
        <span className="text-base font-semibold tracking-tight text-foreground lg:hidden">
          Tastile
        </span>
      </div>

      {/* Center: Execution Status */}
      <div className="hidden min-w-0 max-w-md flex-1 justify-center lg:flex">
        <div className="w-full max-w-xs rounded-lg bg-surface-1 px-3 py-1.5">
          <ActiveExecutionBar
            mode="header-left"
            activeTileTitle={executionState?.activeTileTitle ?? null}
            phaseKind={executionState?.phaseKind ?? "idle"}
            phaseStartedAt={executionState?.phaseStartedAt ?? null}
            phaseEndsAt={executionState?.phaseEndsAt ?? null}
            nextActionableStartAt={executionState?.nextActionableStartAt ?? null}
          />
        </div>
      </div>

      {/* Mobile: Execution Badge */}
      <div className="lg:hidden">
        <ActiveExecutionBar
          mode="header-left"
          activeTileTitle={executionState?.activeTileTitle ?? null}
          phaseKind={executionState?.phaseKind ?? "idle"}
          phaseStartedAt={executionState?.phaseStartedAt ?? null}
          phaseEndsAt={executionState?.phaseEndsAt ?? null}
          nextActionableStartAt={executionState?.nextActionableStartAt ?? null}
        />
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex h-9 w-9 items-center justify-center rounded-md bg-surface-1 transition-colors hover:bg-surface-2"
          title={t("header.notifications")}
        >
          <Bell className="h-5 w-5" />
        </button>
        {userData ? (
          <AccountMenu
            displayName={userData.displayName}
            avatarUrl={avatarUrl}
            plan={userData.plan}
            email={userData.email}
            menuPlacement="down"
          />
        ) : (
          <div
            role="img"
            className="h-9 w-9 rounded-full bg-surface-2"
            aria-label="User avatar placeholder"
          />
        )}
      </div>
    </header>
  );
}

/**
 * Minimal safe session shape: `{sub, exp, owner_id}`. Mirrors the public
 * response of `/api/auth/session` and intentionally excludes any Cognito
 * token material.
 */
interface SafeSession {
  sub: string;
  exp: number;
  owner_id: string | null;
}

async function fetchSafeSession(): Promise<SafeSession | null> {
  try {
    const res = await fetch("/api/auth/session", { cache: "no-store" });
    if (!res.ok) return null;
    const data = (await res.json()) as Partial<SafeSession>;
    if (typeof data.sub !== "string") return null;
    return {
      sub: data.sub,
      exp: typeof data.exp === "number" ? data.exp : 0,
      owner_id: typeof data.owner_id === "string" ? data.owner_id : null,
    };
  } catch {
    return null;
  }
}
