"use client";

import { Bell } from "lucide-react";
import { useEffect, useState } from "react";
import { AccountMenu } from "@/app/app/account-menu";
import { ActiveExecutionBar } from "@/components/execution/ActiveExecutionBar";
import { TastileLogo } from "@/components/TastileLogo";
import { getIdTokenClaims } from "@/lib/daemon/id-token-client";
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
    void (async () => {
      const claims = await getIdTokenClaims();
      if (!claims) {
        setAvatarUrl(null);
        setUserData(null);
        return;
      }

      const fallbackName = claims.email?.split("@")[0] ?? claims.sub.slice(0, 8);

      setAvatarUrl(claims.picture ?? null);
      setUserData({
        displayName: claims.name ?? fallbackName,
        email: claims.email ?? "",
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
