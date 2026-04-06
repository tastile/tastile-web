'use client'

import { useExecutionEngineContext } from '@/lib/hooks/execution-engine-context'
import { TileCardExpandable } from '@/components/tiles/TileCardExpandable'
import { TileCardCompact } from '@/components/tiles/TileCardCompact'
import { TileStatusIcon } from '@/components/tiles/shared/TileStatusIcon'
import { Actor } from '@/lib/domain/actor'
import { TileId } from '@/lib/domain/ids'
import { getTileLifecycle, Tile } from '@/lib/domain/tile'
import { useDialogStore } from '@/lib/stores/dialog-store'
import { DeleteTileDialog } from '@/components/tiles/dialogs/DeleteTileDialog'
import { LoadingCard } from '@/components/tiles/shared/LoadingCard'
import { Skeleton } from '@/components/ui/Skeleton'
import { useEffect, useMemo, useState } from 'react'
import { buildDashboardProjection } from '@/lib/projection/dashboard-projection'
import {
  buildTileChanges,
  buildTimelineView,
  buildTileListSections,
  nextTileSectionLimit,
} from '@/lib/core/dashboard-workspace'
import { TimelineAxis } from '@/components/execution/TimelineAxis'
import { useDashboardWorkspaceStore } from '@/lib/stores/dashboard-workspace-store'
import { useSearchParams } from 'next/navigation'
import { formatDuration } from '@/lib/utils/tile-formatters'
import { useTranslation } from '@/lib/i18n/use-translation'
import { Locale } from '@/lib/stores/locale-store'
import { SquarePen } from 'lucide-react'

const MAX_VISIBLE_TILES = 60
const MAX_VISIBLE_CHANGES = 120

export default function TilesPage() {
  const { state, loading, execute } = useExecutionEngineContext()
  const { openDeleteDialog } = useDialogStore()
  const { locale } = useTranslation()
  const [sectionLimitById, setSectionLimitById] = useState<Record<string, number>>({})
  const projection = useMemo(() => buildDashboardProjection(state, new Date()), [state])
  const searchParams = useSearchParams()
  const {
    timelineScale,
    customStartIso,
    customEndIso,
    setTimelineScale,
    setCustomRange,
    activeTilesTab,
    setActiveTilesTab,
    listGroupingMode,
    setListGroupingMode,
    listViewMode,
    setListViewMode,
  } = useDashboardWorkspaceStore()
  const groupedTiles = useMemo(() => {
    return buildTileListSections(projection.tiles.ordered, state.execution.activeTileId, new Date(), listGroupingMode)
  }, [projection.tiles.ordered, state.execution.activeTileId, listGroupingMode])
  const timelineView = useMemo(
    () =>
      buildTimelineView(state.timeline, new Date(), {
        scale: timelineScale,
        customStart: customStartIso ? new Date(customStartIso) : null,
        customEnd: customEndIso ? new Date(customEndIso) : null,
      }),
    [state.timeline, timelineScale, customStartIso, customEndIso]
  )
  const titleById = useMemo(
    () => new Map(projection.tiles.ordered.map(tile => [tile.core.id, tile.core.title] as const)),
    [projection.tiles.ordered]
  )
  const changes = useMemo(() => buildTileChanges(state.timeline, titleById).slice(0, MAX_VISIBLE_CHANGES), [state.timeline, titleById])
  const sectionSummary = useMemo(() => {
    const openCount = groupedTiles.reduce((sum, group) => sum + (group.id === 'log' ? 0 : group.tiles.length), 0)
    const estimatedMinutes = groupedTiles.reduce(
      (sum, group) => sum + group.tiles.reduce((sub, tile) => sub + (tile.objective.targetWorkMin ?? 0), 0),
      0
    )
    return { openCount, estimatedMinutes }
  }, [groupedTiles])

  useEffect(() => {
    const requestedTab = searchParams.get('tab')
    if (requestedTab === 'changes' || requestedTab === 'timeline' || requestedTab === 'list') {
      setActiveTilesTab(requestedTab)
    }
  }, [searchParams, setActiveTilesTab])

  function toTileId(tileId: string) {
    return TileId.fromString(tileId)
  }

  async function handlePromptSuggested(tileId: string) {
    await execute(
      { type: 'request_prompt', tile_id: toTileId(tileId), requested_at: new Date(), reason: 'status_icon' },
      Actor.human('self')
    )
  }

  async function handleDelete(tileId: string) {
    const tile = state.tiles.get(toTileId(tileId))
    if (!tile) return
    openDeleteDialog(tile)
  }

  async function handleDeleteConfirm(tileId: string) {
    await execute(
      { type: 'delete_tile', tile_id: toTileId(tileId), deleted_at: new Date() },
      Actor.human('self')
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <LoadingCard key={i} variant="comfortable" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Tiles Workspace</h1>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-surface-1 p-1">
          {(['list', 'timeline', 'changes'] as const).map(tab => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTilesTab(tab)}
              className={`rounded-md px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                activeTilesTab === tab ? 'bg-surface-2 text-foreground' : 'text-foreground-muted hover:bg-surface-2'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTilesTab === 'list' ? (
        <div className="space-y-4">
          <section className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-border bg-surface-1 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-muted">Main</p>
              {projection.next.main ? (
                <DesktopStyleTileRow
                  tile={projection.next.main}
                  locale={locale}
                  onPrompt={handlePromptSuggested}
                  onOpenEdit={() => setListViewMode('detailed')}
                />
              ) : (
                <p className="text-sm text-foreground-muted">No active main task</p>
              )}
            </div>
            <div className="rounded-xl border border-border bg-surface-1 p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-foreground-muted">Sub</p>
              <div className="space-y-2">
                {projection.next.quick.slice(0, 3).map(tile => (
                  <DesktopStyleTileRow
                    key={tile.core.id}
                    tile={tile}
                    locale={locale}
                    onPrompt={handlePromptSuggested}
                    onOpenEdit={() => setListViewMode('detailed')}
                  />
                ))}
                {projection.next.quick.length === 0 ? <p className="text-sm text-foreground-muted">No sub tasks</p> : null}
              </div>
            </div>
          </section>

          <section className="space-y-3 rounded-xl border border-border bg-surface-1 px-4 py-3">
            <div className="flex flex-wrap items-center gap-4 text-xs uppercase tracking-wider text-foreground-muted">
              <span>Open Tiles {sectionSummary.openCount}</span>
              <span>Estimated {sectionSummary.estimatedMinutes}m</span>
              <span>Sections {groupedTiles.length}</span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="min-w-[220px] flex-1">
                <input
                  defaultValue=""
                  readOnly
                  placeholder="検索 (UIのみ)"
                  className="w-full rounded-md border border-border bg-surface-0 px-3 py-2 text-sm text-foreground placeholder:text-foreground-muted"
                />
              </div>
              <div className="flex items-center gap-1 rounded-md border border-border bg-surface-0 p-1">
                {([
                  ['state', 'By State'],
                  ['project', 'By Project'],
                  ['tag', 'By Tag'],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setListGroupingMode(mode)}
                    className={`rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                      listGroupingMode === mode ? 'bg-surface-2 text-foreground' : 'text-foreground-muted hover:bg-surface-2'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-1 rounded-md border border-border bg-surface-0 p-1">
                {([
                  ['compact', 'Compact'],
                  ['comfortable', 'Comfortable'],
                  ['detailed', 'Detailed'],
                ] as const).map(([mode, label]) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setListViewMode(mode)}
                    className={`rounded px-2 py-1 text-[11px] font-semibold uppercase tracking-wider ${
                      listViewMode === mode ? 'bg-surface-2 text-foreground' : 'text-foreground-muted hover:bg-surface-2'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </section>
          {groupedTiles.map(group => {
            const sectionLimit = Math.min(sectionLimitById[group.id] ?? 8, MAX_VISIBLE_TILES)
            const visibleTiles = group.tiles.slice(0, sectionLimit)
            const omittedTiles = Math.max(0, group.tiles.length - visibleTiles.length)
            return (
              <section key={group.id} className="rounded-xl border border-border bg-surface-1 p-4">
                <div className="mb-2 flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() =>
                      setSectionLimitById(prev => ({
                        ...prev,
                        [group.id]: nextTileSectionLimit(prev[group.id], group.tiles.length),
                      }))
                    }
                    className="text-sm font-semibold uppercase tracking-wider text-foreground-muted hover:text-foreground"
                  >
                    {group.label} ({group.tiles.length})
                  </button>
                  <span className="text-xs font-mono text-foreground-muted">
                    {group.tiles.reduce((sum, tile) => sum + (tile.objective.targetWorkMin ?? 0), 0)}m
                  </span>
                </div>
                <div className="space-y-2">
                  {omittedTiles > 0 ? <p className="text-xs uppercase tracking-wider text-foreground-muted">他{omittedTiles}件 ▼</p> : null}
                  {visibleTiles.map(tile => (
                    <div key={tile.core.id} className="rounded-lg border border-border/60 bg-surface-0 p-2">
                      {listViewMode === 'compact' ? (
                        <TileCardCompact
                          tile={tile}
                          onStart={handlePromptSuggested}
                          onEdit={(id) => console.log('Open edit panel', id)}
                        />
                      ) : null}
                      {listViewMode === 'comfortable' ? (
                        <DesktopStyleTileRow
                          tile={tile}
                          locale={locale}
                          onPrompt={handlePromptSuggested}
                          onOpenEdit={() => setListViewMode('detailed')}
                        />
                      ) : null}
                      {listViewMode === 'detailed' ? (
                        <TileCardExpandable
                          tile={tile}
                          onStart={handlePromptSuggested}
                          onEdit={(id) => console.log('Open edit panel', id)}
                          onDelete={handleDelete}
                        />
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      ) : null}

      {activeTilesTab === 'timeline' ? (
        <section className="rounded-xl border border-border bg-surface-1 p-4">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-foreground-muted">Timeline</h2>
            <select
              value={timelineScale}
              onChange={event => setTimelineScale(event.target.value as typeof timelineScale)}
              className="rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs text-foreground"
            >
              <option value="day">Day</option>
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="custom">Custom</option>
            </select>
            {timelineScale === 'custom' ? (
              <>
                <input
                  type="date"
                  value={customStartIso ? customStartIso.slice(0, 10) : ''}
                  onChange={(event) => {
                    const value = event.target.value.trim()
                    const startIso = value ? new Date(`${value}T00:00:00`).toISOString() : null
                    setCustomRange(startIso, customEndIso)
                  }}
                  className="rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs text-foreground"
                />
                <input
                  type="date"
                  value={customEndIso ? customEndIso.slice(0, 10) : ''}
                  onChange={(event) => {
                    const value = event.target.value.trim()
                    const endIso = value ? new Date(`${value}T23:59:59`).toISOString() : null
                    setCustomRange(customStartIso, endIso)
                  }}
                  className="rounded-md border border-border bg-surface-elevated px-2 py-1 text-xs text-foreground"
                />
              </>
            ) : null}
          </div>
          <TimelineAxis
            blocks={timelineView.blocks}
            markers={timelineView.markers}
            canvasHeightPx={timelineView.canvasHeightPx}
            nowTopPx={timelineView.nowTopPx}
            maxVisibleBlocks={80}
            maxCanvasHeightPx={1200}
          />
        </section>
      ) : null}

      {activeTilesTab === 'changes' ? (
        <section className="rounded-xl border border-border bg-surface-1 p-4">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-foreground-muted">Recent Changes</h2>
          <div className="space-y-2">
            {changes.map(event => (
              <div key={event.id} className="flex items-center gap-3 rounded-lg border border-border/70 bg-surface-0 px-3 py-2">
                <span className={`h-2 w-2 rounded-full ${event.eventType.endsWith('_ended') ? 'bg-emerald-500' : 'bg-primary'}`} />
                <span className="text-sm text-foreground">{event.tileTitle}</span>
                <span className="text-xs uppercase tracking-wider text-foreground-muted">{event.eventType}</span>
                <span className="ml-auto text-xs text-foreground-muted">
                  {event.createdAt.toLocaleDateString()} {event.createdAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            ))}
            {changes.length === 0 ? <p className="text-sm text-foreground-muted">No tile changes yet</p> : null}
          </div>
        </section>
      ) : null}

      {projection.tiles.ordered.length === 0 ? <p className="text-sm text-foreground-muted">No tiles yet. Click the + button to create one.</p> : null}

      <DeleteTileDialog onConfirm={handleDeleteConfirm} />
    </div>
  )
}

function DesktopStyleTileRow({
  tile,
  locale,
  onPrompt,
  onOpenEdit,
}: {
  tile: Tile
  locale: Locale
  onPrompt: (tileId: string) => Promise<void>
  onOpenEdit: () => void
}) {
  const lifecycle = getTileLifecycle(tile)
  const startAt =
    tile.core.startedAt ??
    tile.temporal.fixedStart ??
    tile.temporal.activeStart ??
    tile.temporal.releaseAt ??
    tile.work.segments.find(segment => segment.startAt)?.startAt ??
    null
  const durationText = resolveDurationText(tile, locale)
  const startText = startAt
    ? startAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : tile.temporal.fixedStart
      ? tile.temporal.fixedStart.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : 'unscheduled'

  return (
    <div className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-3 rounded-md border border-border bg-surface-1 px-3 py-2">
      <TileStatusIcon lifecycle={lifecycle} size={18} onClick={() => void onPrompt(tile.core.id)} />
      <div className="min-w-0">
        <p className={`truncate text-sm ${lifecycle === 'done' ? 'text-foreground-muted line-through' : 'text-foreground'}`}>
          {tile.core.title}
        </p>
        {tile.core.nextAction ? <p className="truncate text-xs text-foreground-muted">{tile.core.nextAction}</p> : null}
      </div>
      <div className="text-right text-xs text-foreground-muted">
        <p className="font-mono">所要 {durationText}</p>
        <p>開始 {startText}</p>
      </div>
      <div className="flex items-center">
        <button
          type="button"
          onClick={onOpenEdit}
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-surface-0 text-foreground-muted hover:bg-surface-2 hover:text-foreground"
          aria-label="Edit tile"
          title="Edit tile"
        >
          <SquarePen className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function resolveDurationText(tile: Tile, locale: Locale): string {
  if (typeof tile.objective.targetWorkMin === 'number' && tile.objective.targetWorkMin > 0) {
    return formatDuration(tile.objective.targetWorkMin, locale)
  }
  const totalWorked = tile.work.segments.reduce((sum, segment) => {
    if (!segment.endAt) return sum
    const diff = Math.max(0, Math.round((segment.endAt.getTime() - segment.startAt.getTime()) / 60000))
    return sum + diff
  }, 0)
  if (totalWorked > 0) return formatDuration(totalWorked, locale)
  return 'unspecified'
}
