"use client";

import { useEffect, useMemo, useState } from "react";
import { ActiveExecutionBar } from "@/components/execution/ActiveExecutionBar";
import { TimelineAxis } from "@/components/execution/TimelineAxis";
import { DeferTileDialog } from "@/components/tiles/dialogs/DeferTileDialog";
import { DeleteTileDialog } from "@/components/tiles/dialogs/DeleteTileDialog";
import { LoadingCard } from "@/components/tiles/shared/LoadingCard";
import { TileCardCompact } from "@/components/tiles/TileCardCompact";
import { TileCardExpandable } from "@/components/tiles/TileCardExpandable";
import { Skeleton } from "@/components/ui/Skeleton";
import { buildTimelineView, parseCustomRangeBoundary } from "@/lib/core/dashboard-workspace";
import { Actor } from "@/lib/domain/actor";
import { TileId } from "@/lib/domain/ids";
import { getTileLifecycle } from "@/lib/domain/tile";
import { useExecutionEngineContext } from "@/lib/hooks/execution-engine-context";
import { buildDashboardProjection } from "@/lib/projection/dashboard-projection";
import { useDashboardWorkspaceStore } from "@/lib/stores/dashboard-workspace-store";
import { useDialogStore } from "@/lib/stores/dialog-store";

const MAX_VISIBLE_READY_TILES = 40;

export default function ExecutePage() {
  const { state, loading, execute } = useExecutionEngineContext();
  const { openDeferDialog, openDeleteDialog } = useDialogStore();
  const { timelineScale, customStartIso, customEndIso, setTimelineScale, setCustomRange } =
    useDashboardWorkspaceStore();
  const [nowMs, setNowMs] = useState(() => Date.now());
  const projection = useMemo(
    () => buildDashboardProjection(state, new Date(nowMs)),
    [state, nowMs],
  );
  const timelineView = useMemo(
    () =>
      buildTimelineView(state.timeline, new Date(nowMs), {
        scale: timelineScale,
        customStart: parseCustomRangeBoundary(customStartIso, "start"),
        customEnd: parseCustomRangeBoundary(customEndIso, "end"),
      }),
    [state.timeline, nowMs, timelineScale, customStartIso, customEndIso],
  );
  const readyTiles = useMemo(
    () => Array.from(state.tiles.values()).filter((tile) => getTileLifecycle(tile) !== "done"),
    [state.tiles],
  );
  const visibleReadyTiles = useMemo(
    () => readyTiles.slice(0, MAX_VISIBLE_READY_TILES),
    [readyTiles],
  );
  const omittedReadyTiles = Math.max(0, readyTiles.length - visibleReadyTiles.length);

  const activeTile = state.execution.activeTileId
    ? (state.tiles.get(state.execution.activeTileId) ?? null)
    : null;

  useEffect(() => {
    const interval = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  async function startTile(tileId: TileId) {
    await execute(
      {
        type: "start_tile",
        tile_id: tileId,
        started_at: new Date(),
        source: "manual",
      },
      Actor.human("self"),
    );
  }

  async function completeActive() {
    if (!state.execution.activeTileId) return;
    await execute(
      {
        type: "complete_tile",
        tile_id: state.execution.activeTileId,
        completed_at: new Date(),
        next_tile_id: null,
        scope: "tile",
      },
      Actor.human("self"),
    );
  }

  async function handleDefer(tileId: string) {
    const tile = state.tiles.get(toTileId(tileId));
    if (!tile) return;
    openDeferDialog(tile, "defer");
  }

  async function handleInterrupt(tileId: string) {
    const tile = state.tiles.get(toTileId(tileId));
    if (!tile) return;
    openDeferDialog(tile, "interrupt");
  }

  async function handleDeferConfirm(tileId: string, nextStartAt: Date) {
    await execute(
      {
        type: "defer_tile",
        tile_id: toTileId(tileId),
        deferred_at: new Date(),
        next_start_at: nextStartAt,
      },
      Actor.human("self"),
    );
  }

  async function handleDelete(tileId: string) {
    const tile = state.tiles.get(toTileId(tileId));
    if (!tile) return;
    openDeleteDialog(tile);
  }

  async function handleDeleteConfirm(tileId: string) {
    await execute(
      {
        type: "delete_tile",
        tile_id: toTileId(tileId),
        deleted_at: new Date(),
      },
      Actor.human("self"),
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="rounded-xl bg-surface-1 p-4">
          <Skeleton className="h-24 w-full" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="rounded-xl bg-surface-1 p-4">
            <Skeleton className="mb-3 h-4 w-24" />
            <LoadingCard variant="compact" />
          </div>
          <div className="rounded-xl bg-surface-1 p-4">
            <Skeleton className="mb-3 h-4 w-24" />
            <Skeleton className="h-32 w-full" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Execute</h1>

      <div className="rounded-xl bg-surface-1 p-4">
        <ActiveExecutionBar
          activeTileTitle={activeTile?.core.title ?? null}
          phaseKind={state.execution.phaseKind}
          phaseStartedAt={state.execution.phaseStartedAt}
          phaseEndsAt={state.execution.phaseEndsAt}
          nextActionableStartAt={state.execution.nextActionableStartAt}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl bg-surface-1 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground-muted">
            Next Tile
          </h2>
          <TileCardCompact tile={projection.next.main} onStart={startTile} loading={loading} />
          {projection.next.quick.length > 0 ? (
            <div className="mt-2 space-y-2">
              {projection.next.quick.map((tile) => (
                <TileCardCompact key={tile.core.id} tile={tile} onStart={startTile} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-xl bg-surface-1 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted">
              Timeline
            </h2>
            <select
              value={timelineScale}
              onChange={(event) => setTimelineScale(event.target.value as typeof timelineScale)}
              className="rounded-md bg-surface-elevated px-2 py-1 text-xs text-foreground"
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="custom">Custom</option>
            </select>
            {timelineScale === "custom" ? (
              <>
                <input
                  type="date"
                  value={customStartIso ? customStartIso.slice(0, 10) : ""}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    setCustomRange(value || null, customEndIso);
                  }}
                  className="themed-datetime-input rounded-md bg-surface-elevated px-2 py-1 text-xs text-foreground"
                />
                <input
                  type="date"
                  value={customEndIso ? customEndIso.slice(0, 10) : ""}
                  onChange={(event) => {
                    const value = event.target.value.trim();
                    setCustomRange(customStartIso, value || null);
                  }}
                  className="themed-datetime-input rounded-md bg-surface-elevated px-2 py-1 text-xs text-foreground"
                />
              </>
            ) : null}
          </div>
          <TimelineAxis
            blocks={timelineView.blocks}
            markers={timelineView.markers}
            canvasHeightPx={timelineView.canvasHeightPx}
            nowTopPx={timelineView.nowTopPx}
            maxVisibleBlocks={48}
            maxCanvasHeightPx={960}
          />
        </div>
      </div>

      <div className="rounded-xl bg-surface-1 p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted">
            Ready Tiles
          </h2>
          <button
            type="button"
            onClick={completeActive}
            disabled={!state.execution.activeTileId}
            className="rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-fg disabled:opacity-50"
          >
            Complete Active Tile
          </button>
        </div>
        <div className="space-y-2">
          {omittedReadyTiles > 0 ? (
            <p className="text-xs uppercase tracking-wider text-foreground-muted">
              +{omittedReadyTiles} omitted
            </p>
          ) : null}
          {visibleReadyTiles.map((tile) => (
            <TileCardExpandable
              key={tile.core.id}
              tile={tile}
              defaultExpanded={false}
              onStart={startTile}
              onComplete={completeActive}
              onDefer={handleDefer}
              onInterrupt={handleInterrupt}
              onDelete={handleDelete}
            />
          ))}
          {visibleReadyTiles.length === 0 ? (
            <p className="text-sm text-foreground-muted">
              No ready tiles right now. Click the + button to create one.
            </p>
          ) : null}
        </div>
      </div>

      {/* Dialogs */}
      <DeferTileDialog onConfirm={handleDeferConfirm} />
      <DeleteTileDialog onConfirm={handleDeleteConfirm} />
    </div>
  );
}

function toTileId(tileId: string) {
  return TileId.fromString(tileId);
}
