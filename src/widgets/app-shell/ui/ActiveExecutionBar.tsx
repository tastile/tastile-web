"use client";

import type { PhaseKind } from "@/execution/model/types";
import { useExecutionEngineContext } from "@/shared/hooks/execution-engine-context";
import { useTranslation } from "@/shared/i18n/use-translation";
import { Actor } from "@/tile/model/actor";
import { TileStatusIcon } from "@/tile/ui/TileStatusIcon";
import { useEffect, useRef, useState } from "react";

// TODO(new-shell): wire to new component

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
  const requestPromptPending = useRef(false);
  const { state, execute } = useExecutionEngineContext();
  const { t } = useTranslation();

  // Gate the 1s tick on having an active tile title — without this guard
  // the bar re-renders every second forever, even when the bar is
  // showing the "not started" placeholder and `nowMs` is unused.
  useEffect(() => {
    if (!activeTileTitle) return;
    const interval = setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => clearInterval(interval);
  }, [activeTileTitle]);

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
            <span className="truncate text-xs text-foreground-muted">
              {t("execution.notStartedLabel")}
            </span>
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
          <span className="truncate text-xs text-foreground-muted">
            {t("execution.runningLabel")} {activeTileTitle}
          </span>
        </div>
      );
    }
    return (
      <div className="flex w-full min-w-0 max-w-2xl items-center gap-4 py-4">
        <TileStatusIcon lifecycle="started" size={20} className="shrink-0" />
        <span className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
          {t("execution.runningLabel")}: {activeTileTitle}
        </span>
        <span className="text-3xl font-mono font-semibold tabular-nums text-foreground shrink-0">
          {runningLabel}
        </span>
      </div>
    );
  }

  const metrics = computePhaseMetricsPlaceholder(phaseStartedAt, phaseEndsAt, new Date(nowMs));
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
          <span className="truncate text-xs text-foreground-muted">
            {t("execution.notStartedLabel")}
          </span>
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

  const phaseLabel =
    phaseKind === "break" ? t("execution.breakLabel") : t("execution.runningLabel");
  const canRequestPrompt = Boolean(state.execution.activeTileId) && !state.execution.pendingPrompt;

  if (mode === "header-left") {
    return (
      <div className="flex min-w-0 items-center gap-2">
        <span className="text-caption font-semibold uppercase tracking-wider text-foreground-muted shrink-0">
          {t("execution.remainingLabel")}
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
          if (!canRequestPrompt || requestPromptPending.current) return;
          requestPromptPending.current = true;
          void execute(
            {
              type: "request_prompt",
              tile_id: state.execution.activeTileId,
              requested_at: new Date(),
              reason: "status_icon",
            },
            Actor.human("self"),
          ).finally(() => {
            requestPromptPending.current = false;
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

// TODO(new-shell): wire to new component
function computePhaseMetricsPlaceholder(
  phaseStartedAt: Date,
  phaseEndsAt: Date,
  now: Date,
): { countdownLabel: string; progressPercent: number } | null {
  const remaining = Math.max(0, Math.floor((phaseEndsAt.getTime() - now.getTime()) / 1000));
  const total = Math.max(1, Math.floor((phaseEndsAt.getTime() - phaseStartedAt.getTime()) / 1000));
  const elapsed = Math.max(0, total - remaining);
  return {
    countdownLabel: formatElapsed(remaining),
    progressPercent: Math.min(100, (elapsed / total) * 100),
  };
}
