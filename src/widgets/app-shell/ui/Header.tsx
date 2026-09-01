"use client";

import type { SyncStatus } from "@/execution/model/types";
import { pickDisplayLabel } from "@/shared/auth/display-label";
import { useTranslation } from "@/shared/i18n/use-translation";
import {
  profileQueryOptions,
  safeSessionQueryOptions,
} from "@/shared/query/auth-query-options";
import { TastileLogo } from "@/shared/ui/TastileLogo";
import { ActionIcon } from "@mantine/core";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { AccountMenu } from "./AccountMenu";
import { ActiveExecutionBar } from "./ActiveExecutionBar";

interface HeaderProps {
  executionState?: {
    activeTileTitle: string | null;
    phaseKind: "work" | "break" | "idle";
    phaseStartedAt: Date | null;
    phaseEndsAt: Date | null;
    nextActionableStartAt?: Date | null;
    syncStatus?: SyncStatus | null;
  };
}

export function Header({ executionState }: HeaderProps) {
  const { t } = useTranslation();
  const sessionQuery = useQuery(safeSessionQueryOptions);
  const profileQuery = useQuery({
    ...profileQueryOptions,
    enabled: Boolean(sessionQuery.data),
  });
  const identity = (() => {
    const session = sessionQuery.data;
    if (!session) return null;
    const profile = profileQuery.data;
    return {
      avatarUrl: profile?.avatarUrl ?? null,
      displayName: pickDisplayLabel({
        displayName: profile?.displayName ?? null,
        email: profile?.email ?? null,
        ownerId: session.owner_id,
        sub: session.sub,
      }),
      email: profile?.email ?? "",
      plan: "free",
    };
  })();

  return (
    <header className="flex h-14 items-center justify-between rounded-xl bg-surface-1 px-4 lg:h-16">
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
            nextActionableStartAt={
              executionState?.nextActionableStartAt ?? null
            }
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
        <ActionIcon
          variant="subtle"
          size="lg"
          className="rounded-md bg-surface-1 transition-colors hover:bg-surface-2"
          aria-label={t("header.notifications")}
          title={t("header.notifications")}
        >
          <Bell className="size-5" aria-hidden="true" />
        </ActionIcon>
        {identity ? (
          <AccountMenu
            displayName={identity.displayName}
            avatarUrl={identity.avatarUrl}
            plan={identity.plan}
            email={identity.email}
            menuPlacement="down"
          />
        ) : (
          <div
            role="img"
            className="size-9 rounded-full bg-surface-2"
            aria-label={t("account.menu.avatarPlaceholder")}
          />
        )}
      </div>
    </header>
  );
}
