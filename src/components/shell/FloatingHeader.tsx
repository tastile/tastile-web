"use client";

import { useEffect, useState } from "react";
import { Bell, Search } from "lucide-react";
import { useActiveTile } from "@/lib/hooks/use-active-tile";

interface FloatingHeaderProps {
  userName: string;
  onOpenSearch: () => void;
  onOpenNotifications: () => void;
}

export function FloatingHeader({ userName, onOpenSearch, onOpenNotifications }: FloatingHeaderProps) {
  const { snapshot } = useActiveTile();
  const [nowMs, setNowMs] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  const main = snapshot?.main_tile;
  const ends = snapshot?.main_tile_ends_at ? new Date(snapshot.main_tile_ends_at) : null;
  const remainingSec = ends ? Math.max(0, Math.round((ends.getTime() - nowMs) / 1000)) : 0;
  const mm = Math.floor(remainingSec / 60).toString().padStart(2, "0");
  const ss = (remainingSec % 60).toString().padStart(2, "0");

  const status = snapshot?.is_idle ? "IDLE" : snapshot?.is_working ? "EXECUTING" : "IDLE";

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 flex h-12 items-center gap-3 bg-surface-0/70 px-4 backdrop-blur-md"
      role="banner"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2 font-mono text-[11px] text-foreground-muted">
        <span aria-hidden className="text-foreground-subtle">●</span>
        <span className="font-semibold">{status}</span>
        {main ? (
          <>
            <span aria-hidden className="text-foreground-subtle">·</span>
            <span className="truncate text-foreground">{main.title}</span>
            {ends ? (
              <>
                <span aria-hidden className="text-foreground-subtle">·</span>
                <span className="tabular-nums">{mm}:{ss} left</span>
              </>
            ) : null}
          </>
        ) : null}
      </div>

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

      <button
        type="button"
        aria-label="Open avatar menu"
        className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-fg"
      >
        {userName.charAt(0)}
      </button>
    </header>
  );
}
