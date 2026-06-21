"use client";

import { useEffect, useState } from "react";
import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { useActiveTile } from "@/lib/hooks/use-active-tile";
import { TastileLogo } from "@/components/TastileLogo";

interface FloatingHeaderProps {
  userName: string;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
}

export function FloatingHeader({ userName, onOpenSearch, onOpenNotifications }: FloatingHeaderProps) {
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
          className="rounded-md p-1.5 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
        >
          <Search className="h-4 w-4" />
        </button>

        <button
          type="button"
          aria-label="Open notifications"
          onClick={onOpenNotifications}
          className="rounded-md p-1.5 text-foreground-subtle hover:bg-surface-2 hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
        </button>

        <Link
          href="/dashboard/account"
          aria-label="Account settings"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-fg hover:bg-primary-hover ml-1"
        >
          {userName.charAt(0)}
        </Link>
      </div>
    </header>
  );
}
