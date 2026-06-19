"use client";

import { useEffect, useState } from "react";
import { TileStatusIcon } from "@/components/tiles/shared/TileStatusIcon";
import { Actor } from "@/lib/domain/actor";
import type { PhaseKind } from "@/lib/domain/execution";
import { useExecutionEngineContext } from "@/lib/hooks/execution-engine-context";
import { computePhaseMetrics } from "@/lib/projection/dashboard-projection";

interface ActiveExecutionBarProps {
  activeTileTitle: string | null;
  phaseKind: PhaseKind;
  phaseStartedAt: Date | null;
  phaseEndsAt: Date | null;
  nextActionableStartAt?: Date | null;
  mode?: "default" | "header-left";
}

export function ActiveExecutionBar({
  activeTileTitle,
  phaseKind,
  phaseStartedAt,
  phaseEndsAt,
  nextActionableStartAt = null,
  mode = "default",
}: ActiveExecutionBarProps) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [requestPromptPending, setRequestPromptPending] = useState(false);
  const { state, execute } = useExecutionEngineContext();

  useEffect(() => {
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  if (!activeTileTitle || !phaseStartedAt || !phaseEndsAt) {
    if (!activeTileTitle || (!phaseStartedAt && !phaseEndsAt)) {
      const fallbackLabel = resolveCountdownLabel(
        phaseEndsAt,
        nextActionableStartAt,
        new Date(nowMs),
      );
      if (mode === "header-left") {
        return (
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-2xl font-mono font-semibold tabular-nums text-foreground shrink-0">
              {fallbackLabel}
            </span>
            <span className="truncate text-xs text-foreground-muted">未実行</span>
          </div>
        );
      }
      return (
        <div className="flex w-full min-w-0 max-w-2xl items-center justify-end py-4">
          <span className="text-3xl font-mono font-semibold tabular-nums text-foreground">
            {fallbackLabel}
          </span>
        </div>
      );
    }
    const now = new Date(nowMs).getTime();
    const runningLabel = phaseEndsAt
      ? formatElapsed(Math.max(0, Math.floor((phaseEndsAt.getTime() - now) / 1000)))
      : formatElapsed(Math.max(0, Math.floor((now - (phaseStartedAt?.getTime() ?? now)) / 1000)));
    if (mode === "header-left") {
      return (
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-2xl font-mono font-semibold tabular-nums text-foreground shrink-0">
            {runningLabel}
          </span>
          <span className="truncate text-xs text-foreground-muted">実行中 {activeTileTitle}</span>
        </div>
      );
    }
    return (
      <div className="flex w-full min-w-0 max-w-2xl items-center gap-4 py-4">
        <TileStatusIcon lifecycle="started" size={20} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
          実行中: {activeTileTitle}
        </span>
        <span className="text-3xl font-mono font-semibold tabular-nums text-foreground shrink-0">
          {runningLabel}
        </span>
      </div>
    );
  }

  const metrics = computePhaseMetrics(phaseStartedAt, phaseEndsAt, new Date(nowMs));
  if (!metrics) {
    const fallbackLabel = resolveCountdownLabel(
      phaseEndsAt,
      nextActionableStartAt,
      new Date(nowMs),
    );
    if (mode === "header-left") {
      return (
        <div className="flex min-w-0 items-center gap-2">
          <span className="text-2xl font-mono font-semibold tabular-nums text-foreground shrink-0">
            {fallbackLabel}
          </span>
          <span className="truncate text-xs text-foreground-muted">未実行</span>
        </div>
      );
    }
    return (
      <div className="flex w-full min-w-0 max-w-2xl items-center justify-end py-4">
        <span className="text-3xl font-mono font-semibold tabular-nums text-foreground">
          {fallbackLabel}
        </span>
      </div>
    );
  }

  const phaseLabel = phaseKind === "break" ? "休憩中" : "実行中";
  const canRequestPrompt = Boolean(state.execution.activeTileId) && !state.execution.pendingPrompt;

  if (mode === "header-left") {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted shrink-0">
          残り
        </span>
        <span className="text-2xl font-mono font-semibold tabular-nums text-foreground shrink-0">
          {metrics.countdownLabel}
        </span>
        <span className="truncate text-xs text-foreground-muted">
          {phaseLabel} {activeTileTitle}
        </span>
      </div>
    );
  }

  return (
    <div className="flex w-full min-w-0 max-w-2xl items-center gap-4 py-4">
      <TileStatusIcon
        lifecycle="started"
        size={20}
        className="shrink-0"
        onClick={() => {
          if (!canRequestPrompt || requestPromptPending) return;
          setRequestPromptPending(true);
          void execute(
            {
              type: "request_prompt",
              tile_id: state.execution.activeTileId,
              requested_at: new Date(),
              reason: "status_icon",
            },
            Actor.human("self"),
          ).finally(() => {
            setRequestPromptPending(false);
          });
        }}
      />

      <span className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
        {phaseLabel}: {activeTileTitle}
      </span>
      <span className="text-3xl font-mono font-semibold tabular-nums text-foreground shrink-0">
        {metrics.countdownLabel}
      </span>
    </div>
  );
}

function formatElapsed(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  if (hh > 0) {
    return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
  }
  return `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}

function resolveCountdownLabel(
  phaseEndsAt: Date | null,
  nextActionableStartAt: Date | null,
  now: Date,
): string {
  const target = phaseEndsAt ?? nextActionableStartAt;
  if (!target) return "00:00";
  return formatElapsed(Math.max(0, Math.floor((target.getTime() - now.getTime()) / 1000)));
}
