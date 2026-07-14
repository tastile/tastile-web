"use client";

import {
  Bell,
  CalendarDays,
  CheckSquare,
  Layers,
  LogOut,
  Menu,
  Repeat,
  Search,
  Settings,
  User,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { TastileLogo } from "@/components/TastileLogo";
import { BottomSheet } from "@/components/ui/BottomSheet";
import {
  FloatingMenu,
  FloatingMenuContent,
  FloatingMenuItem,
  FloatingMenuLabel,
  FloatingMenuSeparator,
  FloatingMenuTrigger,
} from "@/components/ui/floating-menu";
import { useActiveTile } from "@/lib/hooks/use-active-tile";
import { V1ExecutionControls } from "@/components/execution/V1ExecutionControls";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";

interface FloatingHeaderProps {
  userName: string;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
  // Ref attached to the Bell button so the notifications panel
  // (mounted elsewhere in the dashboard layout) can anchor to it.
  notificationsButtonRef?: React.RefObject<HTMLButtonElement | null>;
}

const NAV_ITEMS = [
  { path: "/dashboard/timeline", labelKey: "nav.timeline", Icon: CalendarDays },
  { path: "/dashboard/tasks", labelKey: "nav.tasks", Icon: CheckSquare },
  { path: "/dashboard/projects", labelKey: "nav.projects", Icon: Layers },
  { path: "/dashboard/schedule", labelKey: "nav.schedule", Icon: Repeat },
  { path: "/dashboard/preferences/general", labelKey: "nav.preferences", Icon: Settings },
];

export function FloatingHeader({
  userName,
  onOpenSearch,
  onOpenNotifications,
  notificationsButtonRef,
}: FloatingHeaderProps) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { snapshot } = useActiveTile();
  const [nowMs, setNowMs] = useState(0);

  // Only tick once per second while the countdown is actually visible
  // (working state with an end time). Without this guard the header
  // re-renders every second on every page, producing sustained CPU load.
  const ends = snapshot?.main_tile_ends_at ? new Date(snapshot.main_tile_ends_at) : null;
  const ticking = Boolean(snapshot?.is_working && ends);

  useEffect(() => {
    setNowMs(Date.now());
    if (!ticking) return;
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [ticking]);

  const main = snapshot?.main_tile;
  const remainingSec = ends ? Math.max(0, Math.round((ends.getTime() - nowMs) / 1000)) : 0;
  const mm = Math.floor(remainingSec / 60)
    .toString()
    .padStart(2, "0");
  const ss = (remainingSec % 60).toString().padStart(2, "0");

  const isWorking = snapshot?.is_working ?? false;
  const status = isWorking ? t("shell.floatingHeader.executing") : t("shell.floatingHeader.idle");

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 flex h-12 items-center bg-surface-0 border-b border-border">
        {/* 左: ロゴ */}
        <div className="flex w-12 shrink-0 items-center justify-center">
          <Link
            href="/dashboard"
            aria-label={t("shell.floatingHeader.homeAria")}
            className="flex h-8 w-8 items-center justify-center rounded-md hover:bg-surface-2 transition-colors"
          >
            <TastileLogo size={20} className="text-foreground" />
          </Link>
        </div>

        {/* 中央: 実行ステータス */}
        <div className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-2 font-mono text-[11px] text-foreground-muted">
            <span
              aria-hidden
              className={isWorking ? "text-primary animate-pulse" : "text-foreground-subtle"}
            >
              ●
            </span>
            <span className="font-semibold">{status}</span>
            {main ? (
              <>
                <span aria-hidden className="text-foreground-subtle">
                  ·
                </span>
                <span className="truncate max-w-[200px] text-foreground">{main.title}</span>
                {ends ? (
                  <>
                    <span aria-hidden className="text-foreground-subtle">
                      ·
                    </span>
                    <span className="tabular-nums">
                      {mm}:{ss} {t("shell.floatingHeader.left")}
                    </span>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {/* 右: アクション */}
        <div className="flex items-center gap-1 pr-3">
          <V1ExecutionControls />

          <button
            type="button"
            aria-label={t("shell.floatingHeader.openSearch")}
            onClick={onOpenSearch}
            className="hidden md:inline-flex items-center justify-center rounded-md p-1.5 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            ref={notificationsButtonRef}
            type="button"
            aria-label={t("shell.floatingHeader.openNotifications")}
            onClick={onOpenNotifications}
            className="hidden md:inline-flex items-center justify-center rounded-md p-1.5 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
          </button>

          <FloatingMenu>
            <FloatingMenuTrigger asChild>
              <button
                type="button"
                aria-label={t("shell.floatingHeader.userMenu")}
                className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-fg hover:bg-primary-hover ml-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {userName.charAt(0)}
              </button>
            </FloatingMenuTrigger>
            <FloatingMenuContent align="end" className="w-56 mt-1">
              <FloatingMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-foreground">{userName}</p>
                  <p className="text-xs leading-none text-foreground-muted">
                    {t("shell.floatingHeader.statusLabel")}:{" "}
                    {isWorking
                      ? t("shell.floatingHeader.statusExecuting")
                      : t("shell.floatingHeader.statusIdle")}
                  </p>
                </div>
              </FloatingMenuLabel>
              <FloatingMenuSeparator />
              <FloatingMenuItem asChild>
                <Link
                  href="/dashboard/preferences/account"
                  className="w-full cursor-pointer flex items-center gap-2"
                >
                  <User className="h-4 w-4 shrink-0" />
                  {t("shell.floatingHeader.accountSettings")}
                </Link>
              </FloatingMenuItem>
              <FloatingMenuItem asChild>
                <Link
                  href="/dashboard/preferences/general"
                  className="w-full cursor-pointer flex items-center gap-2"
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  {t("nav.preferences")}
                </Link>
              </FloatingMenuItem>
              <FloatingMenuSeparator />
              <FloatingMenuItem className="cursor-pointer flex items-center gap-2">
                <LogOut className="h-4 w-4 shrink-0" />
                {t("shell.floatingHeader.logOut")}
              </FloatingMenuItem>
            </FloatingMenuContent>
          </FloatingMenu>

          {/* モバイルメニューボタン (md未満でのみ表示、右端) */}
          <button
            type="button"
            aria-label={t("shell.floatingHeader.openNavMenu")}
            onClick={() => setMenuOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-subtle hover:bg-surface-2 hover:text-foreground md:hidden ml-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <BottomSheet
        open={menuOpen}
        onOpenChange={setMenuOpen}
        title={t("shell.floatingHeader.menu")}
      >
        <div className="flex flex-col gap-4">
          {/* クイックアクション (Search / Notifications) */}
          <div className="grid grid-cols-2 gap-2 border-b border-border pb-4 shrink-0">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpenSearch();
              }}
              className="flex h-10 items-center justify-center gap-2 rounded-md bg-surface-2 text-sm font-medium text-foreground-subtle hover:bg-surface-hover hover:text-foreground transition-colors"
            >
              <Search className="h-4 w-4" />
              <span>{t("shell.floatingHeader.search")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onOpenNotifications();
              }}
              className="flex h-10 items-center justify-center gap-2 rounded-md bg-surface-2 text-sm font-medium text-foreground-subtle hover:bg-surface-hover hover:text-foreground transition-colors"
            >
              <Bell className="h-4 w-4" />
              <span>{t("shell.floatingHeader.notifications")}</span>
            </button>
          </div>

          {/* ナビゲーション項目 */}
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ path, labelKey, Icon }) => {
              const active = pathname === path || pathname.startsWith(`${path}/`);
              return (
                <Link
                  key={path}
                  href={path}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                    active
                      ? "bg-surface-2 text-foreground font-medium"
                      : "text-foreground-subtle hover:bg-surface-2 hover:text-foreground",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{t(labelKey)}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </BottomSheet>
    </>
  );
}
