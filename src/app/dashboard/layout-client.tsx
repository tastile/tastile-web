"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RightSidebar } from "@/components/layout/RightSidebar";
import { SecurityLockGate } from "@/components/security/SecurityLockGate";
import { QuickTileCreate } from "@/components/tiles/QuickTileCreate";
import { Actor } from "@/lib/domain/actor";
import type { TileId } from "@/lib/domain/ids";
import {
  ExecutionEngineProvider,
  useExecutionEngineContext,
} from "@/lib/hooks/execution-engine-context";
// TODO(new-shell): wire to new component
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";

const TIMELINE_MAX_VISIBLE_BLOCKS = 18;
const TIMELINE_MAX_CANVAS_HEIGHT_PX = 640;

export function DashboardLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ExecutionEngineProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </ExecutionEngineProvider>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const { open } = useQuickCreateStore();
  const { state, execute } = useExecutionEngineContext();
  const [nowMs, setNowMs] = useState<number | null>(null);

  const projection = useMemo(
    () => (nowMs === null ? null : buildDashboardProjectionPlaceholder(state, new Date(nowMs))),
    [state, nowMs],
  );
  const timelineBlocks = useMemo(() => projection?.timeline.blocks ?? [], [projection]);
  const activeTimelineTitle = useMemo(
    () => timelineBlocks.find((block) => block.status === "active")?.title ?? null,
    [timelineBlocks],
  );

  // Keyboard shortcut: Cmd+N
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        open();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  useEffect(() => {
    const seedTimer = window.setTimeout(() => setNowMs(Date.now()), 0);
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => {
      window.clearTimeout(seedTimer);
      window.clearInterval(interval);
    };
  }, []);

  async function handlePromptSuggested(tileId: TileId) {
    await execute(
      {
        type: "request_prompt",
        tile_id: tileId,
        requested_at: new Date(),
        reason: "status_icon",
      },
      Actor.human("self"),
    );
  }

  return (
    <SecurityLockGate>
      <AppShell
        quickCreatePanel={<QuickTileCreate />}
        rightSidebar={
          <RightSidebar
            nextTile={projection?.next.main ?? null}
            nextQuickTiles={projection?.next.quick ?? []}
            onPromptSuggested={handlePromptSuggested}
            timelineItems={timelineBlocks.map((block) => ({
              id: block.id,
              date: block.dateLabel,
              time: block.timeLabel,
              type: block.type,
              title: block.title,
              status: block.status,
              topPx: block.topPx,
              heightPx: block.heightPx,
              lane: block.lane,
              totalLanes: block.totalLanes,
              startAt: block.startAt,
              endAt: block.endAt,
            }))}
            timelineCanvasHeightPx={projection?.timeline.canvasHeightPx ?? 0}
            timelineNowTopPx={projection?.timeline.nowTopPx ?? null}
            timelineMarkers={projection?.timeline.markers ?? []}
            timelineMaxVisibleBlocks={TIMELINE_MAX_VISIBLE_BLOCKS}
            timelineMaxCanvasHeightPx={TIMELINE_MAX_CANVAS_HEIGHT_PX}
            timelineWindowStart={projection?.timeline.windowStart ?? null}
            timelineWindowEnd={projection?.timeline.windowEnd ?? null}
          />
        }
        executionState={{
          activeTileTitle: state.execution.activeTileId
            ? (state.tiles.get(state.execution.activeTileId)?.core.title ?? activeTimelineTitle)
            : activeTimelineTitle,
          phaseKind: state.execution.phaseKind,
          phaseStartedAt: state.execution.phaseStartedAt,
          phaseEndsAt: state.execution.phaseEndsAt,
          nextActionableStartAt: state.execution.nextActionableStartAt ?? null,
          pendingPrompt: state.execution.pendingPrompt,
          syncStatus: state.execution.syncStatus ?? null,
        }}
      >
        {children}
      </AppShell>
    </SecurityLockGate>
  );
}

// TODO(new-shell): wire to new component
type DashboardProjectionPlaceholder = {
  next: { main: import("@/lib/domain/tile").Tile | null; quick: import("@/lib/domain/tile").Tile[] };
  tiles: {
    ordered: import("@/lib/domain/tile").Tile[];
    ready: import("@/lib/domain/tile").Tile[];
    started: import("@/lib/domain/tile").Tile[];
    done: import("@/lib/domain/tile").Tile[];
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
    markers: Array<{ label: string; topPx: number }>;
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
};

function buildDashboardProjectionPlaceholder(
  state: import("@/lib/core/state").AppState,
  now: Date,
): DashboardProjectionPlaceholder {
  return {
    next: { main: null, quick: [] },
    tiles: {
      ordered: Array.from(state.tiles.values()),
      ready: [],
      started: [],
      done: [],
    },
    history: { events: [] },
    timeline: {
      windowStart: now,
      windowEnd: now,
      markers: [],
      canvasHeightPx: 0,
      nowTopPx: null,
      blocks: [],
    },
  };
}
