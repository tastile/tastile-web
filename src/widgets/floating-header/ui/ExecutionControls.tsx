"use client";

/**
 * ExecutionControls -- minimal pause / resume / finish controls
 * for the currently-active placement.
 *
 * This is the minimum surface needed for the user's schedule to
 * actually run through the UI:
 *   - shows the active tile + remaining time
 *   - pause when life happens (sleep, bathroom, surprise call)
 *   - resume when you come back
 *   - finish when the placement is done
 *
 * Uses the v1 wire helpers (pause/resume/finish) plus
 * `/v1/active-tile` polling for live updates.
 */

import { useV1ActiveTile } from "@/shared/hooks/use-v1-active-tile";
import { snapshotFromActiveTile, useV1Execution } from "@/shared/hooks/use-v1-execution";
import { useTranslation } from "@/shared/i18n/use-translation";
import { Button } from "@mantine/core";
import { Pause, Play, Square } from "lucide-react";
import { useEffect, useState } from "react";

function formatRemaining(target: Date, nowMs: number): string {
  const ms = Math.max(0, target.getTime() - nowMs);
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

export function ExecutionControls() {
  const { t } = useTranslation();
  const { snapshot, loading } = useV1ActiveTile();
  const tileSnapshot = snapshot ? snapshotFromActiveTile(snapshot) : null;
  const { state, run } = useV1Execution(tileSnapshot);
  const [nowMs, setNowMs] = useState(() => Date.now());

  // Tick every second only while we have an active placement to render.
  // This used to call setTimeout from inside the render body, which on
  // every commit spawned a new timer with no cleanup — the count grew
  // unboundedly while a placement was active. Routing through useEffect
  // lets React cancel the previous schedule on each tick.
  useEffect(() => {
    if (!tileSnapshot) return;
    // Schedule the first tick via microtask so the initial setState is no
    // longer synchronous inside the effect — the lazy initializer already
    // gave us a real timestamp, so the first render inside the active
    // placement is correct without an in-effect setState.
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      setNowMs(Date.now());
    });
    const id = window.setTimeout(() => setNowMs(Date.now()), 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [tileSnapshot]);

  if (loading && !tileSnapshot) {
    return (
      <div className="text-caption uppercase tracking-wider text-foreground-subtle">
        {t("execution.controls.noExecution")}
      </div>
    );
  }

  if (!tileSnapshot) {
    return (
      <div className="text-caption uppercase tracking-wider text-foreground-subtle">
        {t("execution.controls.noExecution")}
      </div>
    );
  }

  const spanEnd = new Date(tileSnapshot.span_end);
  const remaining = formatRemaining(spanEnd, nowMs);
  const hasExecution = Boolean(tileSnapshot.execution_id);

  const onClick = (action: "pause" | "resume" | "finish") => () => {
    void run(action).then(() => {
      // Force a refetch of /v1/active-tile; the polling hook will pick
      // up the change on its next 15-second tick.
      window.dispatchEvent(new CustomEvent("tastile:execution-changed"));
    });
  };

  return (
    <div className="flex items-center gap-1.5">
      <div className="hidden text-caption font-mono tabular-nums text-foreground-muted lg:block">
        {remaining}
      </div>
      {!hasExecution && (
        <Button
          type="button"
          onClick={() =>
            void run("start")
              .then(() => {
                window.dispatchEvent(new CustomEvent("tastile:execution-changed"));
              })
              .catch((err: unknown) => {
                console.error("v1 start execution failed", err);
              })
          }
          disabled={state.busy !== null}
          className="flex h-7 items-center gap-1 rounded-md bg-primary px-2 text-caption font-semibold text-primary-fg transition-opacity hover:opacity-90 disabled:opacity-50"
          aria-label={t("execution.controls.startAria")}
          data-testid="execution-start"
          variant="subtle"
          size="compact-sm"
        >
          <Play className="size-3" /> {t("execution.controls.start")}
        </Button>
      )}
      {hasExecution && (
        <>
          <Button
            type="button"
            onClick={onClick("pause")}
            disabled={state.busy !== null}
            className="flex h-7 items-center gap-1 rounded-md bg-surface-1 px-2 text-caption font-semibold text-foreground transition-colors hover:bg-surface-2 disabled:opacity-50"
            aria-label={t("execution.controls.pauseAria")}
            variant="subtle"
            size="compact-sm"
          >
            <Pause className="size-3" /> {t("execution.controls.pause")}
          </Button>
          <Button
            type="button"
            onClick={onClick("resume")}
            disabled={state.busy !== null}
            className="flex h-7 items-center gap-1 rounded-md bg-surface-1 px-2 text-caption font-semibold text-foreground transition-colors hover:bg-surface-2 disabled:opacity-50"
            aria-label={t("execution.controls.resumeAria")}
            variant="subtle"
            size="compact-sm"
          >
            <Play className="size-3" /> {t("execution.controls.resume")}
          </Button>
          <Button
            type="button"
            onClick={onClick("finish")}
            disabled={state.busy !== null}
            className="flex h-7 items-center gap-1 rounded-md bg-status-warn px-2 text-caption font-semibold text-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            aria-label={t("execution.controls.finishAria")}
            data-testid="execution-finish"
            variant="subtle"
            size="compact-sm"
          >
            <Square className="size-3" /> {t("execution.controls.finish")}
          </Button>
        </>
      )}
      {state.error && (
        <span className="hidden text-caption text-status-danger lg:inline" title={state.error}>
          {state.error}
        </span>
      )}
    </div>
  );
}
