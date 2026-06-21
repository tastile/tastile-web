"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  Bell,
  Search,
  Menu,
  CalendarDays,
  CheckSquare,
  Layers,
  Repeat,
  Library,
  Settings,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { useActiveTile } from "@/lib/hooks/use-active-tile";
import { TastileLogo } from "@/components/TastileLogo";
import { cn } from "@/lib/utils/cn";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { useTranslation } from "@/lib/i18n/use-translation";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/DropdownMenu";

interface FloatingHeaderProps {
  userName: string;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
}

const NAV_ITEMS = [
  { path: "/dashboard/calendar",   label: "Timeline",   Icon: CalendarDays },
  { path: "/dashboard/tasks",      label: "Tasks",      Icon: CheckSquare  },
  { path: "/dashboard/projects",   label: "Projects",   Icon: Layers       },
  { path: "/dashboard/schedule",   label: "Schedule",   Icon: Repeat       },
  { path: "/dashboard/references", label: "References", Icon: Library      },
  { path: "/dashboard/preferences/general", label: "Preferences", Icon: Settings },
];

export function FloatingHeader({ userName, onOpenSearch, onOpenNotifications }: FloatingHeaderProps) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useTranslation();
  const openQuickCreate = useQuickCreateStore((s) => s.open);
  const { snapshot } = useActiveTile();
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    setNowMs(Date.now());
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const main = snapshot?.main_tile;
  const ends = snapshot?.main_tile_ends_at ? new Date(snapshot.main_tile_ends_at) : null;
  const remainingSec = ends ? Math.max(0, Math.round((ends.getTime() - nowMs) / 1000)) : 0;
  const mm = Math.floor(remainingSec / 60).toString().padStart(2, "0");
  const ss = (remainingSec % 60).toString().padStart(2, "0");

  const isWorking = snapshot?.is_working ?? false;
  const status = isWorking ? "EXECUTING" : "IDLE";

  return (
    <>
      <header
        className="fixed inset-x-0 top-0 z-50 flex h-12 items-center bg-surface-0/70 backdrop-blur-md"
        role="banner"
      >
        {/* 左: ロゴ */}
        <div className="flex w-12 shrink-0 items-center justify-center">
          <Link
            href="/dashboard"
            aria-label="tastile home"
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
                <span aria-hidden className="text-foreground-subtle">·</span>
                <span className="truncate max-w-[200px] text-foreground">{main.title}</span>
                {ends ? (
                  <>
                    <span aria-hidden className="text-foreground-subtle">·</span>
                    <span className="tabular-nums">{mm}:{ss} left</span>
                  </>
                ) : null}
              </>
            ) : null}
          </div>
        </div>

        {/* 右: アクション */}
        <div className="flex items-center gap-1 pr-3">
          <button
            type="button"
            aria-label="Open search"
            onClick={onOpenSearch}
            className="hidden md:inline-flex items-center justify-center rounded-md p-1.5 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
          >
            <Search className="h-4 w-4" />
          </button>

          <button
            type="button"
            aria-label="Open notifications"
            onClick={onOpenNotifications}
            className="hidden md:inline-flex items-center justify-center rounded-md p-1.5 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                aria-label="User menu"
                className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-fg hover:bg-primary-hover ml-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              >
                {userName.charAt(0)}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 mt-1">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none text-foreground">{userName}</p>
                  <p className="text-xs leading-none text-foreground-muted">
                    Status: {isWorking ? "Executing" : "Idle"}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <Link href="/dashboard/preferences/account" className="w-full cursor-pointer">
                  Account Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/dashboard/preferences/general" className="w-full cursor-pointer">
                  Preferences
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="cursor-pointer">
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* モバイルメニューボタン (md未満でのみ表示、右端) */}
          <button
            type="button"
            aria-label="Open navigation menu"
            onClick={() => setMenuOpen(true)}
            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground-subtle hover:bg-surface-2 hover:text-foreground md:hidden ml-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </header>

      <BottomSheet open={menuOpen} onOpenChange={setMenuOpen} title="Menu">
        <div className="flex flex-col gap-4">
          {/* タスク新規作成ボタン — アクセントカラー */}
          <button
            type="button"
            onClick={() => {
              setMenuOpen(false);
              openQuickCreate();
            }}
            className="flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary text-sm font-medium text-primary-fg hover:bg-primary-hover transition-colors shrink-0"
          >
            <Plus className="h-4 w-4" />
            <span>{t("nav.new")}</span>
          </button>

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
              <span>Search</span>
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
              <span>Notifications</span>
            </button>
          </div>

          {/* ナビゲーション項目 */}
          <nav className="flex flex-col gap-1">
            {NAV_ITEMS.map(({ path, label, Icon }) => {
              const active = pathname === path || pathname.startsWith(path + "/");
              return (
                <Link
                  key={path}
                  href={path}
                  onClick={() => setMenuOpen(false)}
                  className={cn(
                    "flex h-10 items-center gap-3 rounded-md px-3 text-sm transition-colors",
                    active
                      ? "bg-surface-2 text-foreground font-medium"
                      : "text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      </BottomSheet>
    </>
  );
}
