import { buildTileChanges, buildTimelineView } from "@/lib/core/dashboard-workspace";
import type { AppState } from "@/lib/core/state";
import type { TileId } from "@/lib/domain/ids";
import { getTileLifecycle, type Tile } from "@/lib/domain/tile";

export interface DashboardProjection {
  next: {
    main: Tile | null;
    quick: Tile[];
  };
  tiles: {
    ordered: Tile[];
    ready: Tile[];
    started: Tile[];
    done: Tile[];
  };
  history: {
    events: Array<{
      id: string;
      eventType: string;
      tileTitle: string;
      createdAt: Date;
    }>;
  };
  timeline: {
    windowStart: Date;
    windowEnd: Date;
    markers: Array<{
      label: string;
      topPx: number;
    }>;
    canvasHeightPx: number;
    nowTopPx: number | null;
    blocks: Array<{
      id: string;
      title: string;
      type: "work" | "break" | "fixed";
      status: "done" | "active" | "scheduled";
      topPx: number;
      heightPx: number;
      lane: number;
      totalLanes: number;
      startLabel: string;
      endLabel: string;
      durationLabel: string;
      dateLabel: string;
      timeLabel: string;
      startAt: Date;
      endAt: Date;
    }>;
  };
}

export interface PhaseMetrics {
  remainingSeconds: number;
  totalSeconds: number;
  progressPercent: number;
  countdownLabel: string;
}

export function buildDashboardProjection(state: AppState, now: Date): DashboardProjection {
  const ordered = Array.from(state.tiles.values()).sort((a, b) => {
    const rank = (tile: Tile) => {
      const lifecycle = getTileLifecycle(tile);
      if (lifecycle === "ready") return 0;
      if (lifecycle === "started") return 1;
      return 2;
    };
    const diff = rank(a) - rank(b);
    if (diff !== 0) return diff;
    return a.core.title.localeCompare(b.core.title, "en", {
      sensitivity: "base",
    });
  });
  const ready = ordered.filter((tile) => getTileLifecycle(tile) === "ready");
  const started = ordered.filter((tile) => getTileLifecycle(tile) === "started");
  const done = ordered.filter((tile) => getTileLifecycle(tile) === "done");
  const main = ready[0] ?? started[0] ?? null;
  const quick = ready.slice(1, 6);
  const titleById = new Map<TileId, string>();
  for (const tile of state.tiles.values()) {
    titleById.set(tile.core.id, tile.core.title);
  }

  const timeline = buildTimelineView(state.timeline, now, {
    scale: "day",
    customStart: null,
    customEnd: null,
  });
  const historyEvents = buildTileChanges(state.timeline, titleById);

  return {
    next: { main, quick },
    tiles: {
      ordered,
      ready,
      started,
      done,
    },
    history: {
      events: historyEvents.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        tileTitle: event.tileTitle,
        createdAt: event.createdAt,
      })),
    },
    timeline,
  };
}

export function computePhaseMetrics(
  phaseStartedAt: Date | null,
  phaseEndsAt: Date | null,
  now: Date,
): PhaseMetrics | null {
  if (!phaseStartedAt || !phaseEndsAt) return null;
  const totalSeconds = Math.max(
    1,
    Math.floor((phaseEndsAt.getTime() - phaseStartedAt.getTime()) / 1000),
  );
  const elapsed = Math.max(0, Math.floor((now.getTime() - phaseStartedAt.getTime()) / 1000));
  const remainingSeconds = Math.max(0, totalSeconds - elapsed);
  const progressPercent = Math.round(Math.max(0, Math.min(1, elapsed / totalSeconds)) * 1000) / 10;
  return {
    remainingSeconds,
    totalSeconds,
    progressPercent,
    countdownLabel: formatCountdown(remainingSeconds),
  };
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return "00:00";
  const hh = Math.floor(seconds / 3600);
  const mm = Math.floor((seconds % 3600) / 60);
  const ss = seconds % 60;
  if (hh > 0) {
    return `${hh.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
  }
  return `${mm.toString().padStart(2, "0")}:${ss.toString().padStart(2, "0")}`;
}
