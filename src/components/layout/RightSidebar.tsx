'use client'

import { useTranslation } from '@/lib/i18n/use-translation'
import { Tile, getTileLifecycle } from '@/lib/domain/tile'
import { TileId } from '@/lib/domain/ids'
import { TileStatusIcon } from '@/components/tiles/shared/TileStatusIcon'
import { TimelineAxis } from '@/components/execution/TimelineAxis'

interface RightSidebarProps {
  onClose?: () => void
  nextTile: Tile | null
  nextQuickTiles?: Tile[]
  nextReason?: string
  onPromptSuggested?: (tileId: TileId) => void
  timelineItems: Array<{
    id: string
    time: string
    date: string
    type: 'work' | 'break' | 'fixed'
    title: string
    status: 'done' | 'active' | 'scheduled'
    topPx?: number
    heightPx?: number
    lane?: number
    totalLanes?: number
    startAt?: Date
    endAt?: Date
  }>
  timelineCanvasHeightPx?: number
  timelineNowTopPx?: number | null
  timelineMarkers?: Array<{ label: string; topPx: number }>
  timelineMaxVisibleBlocks?: number
  timelineMaxCanvasHeightPx?: number
}

export function RightSidebar({
  nextTile,
  nextQuickTiles = [],
  nextReason: _nextReason,
  onPromptSuggested,
  timelineItems,
  timelineCanvasHeightPx = 0,
  timelineNowTopPx = null,
  timelineMarkers = [],
  timelineMaxVisibleBlocks = 18,
  timelineMaxCanvasHeightPx = 640,
}: RightSidebarProps) {
  const { t } = useTranslation()
  void _nextReason

  return (
    <aside className="relative flex w-72 min-w-0 flex-col gap-3 bg-surface-0">
      {/* Next Up Card */}
      <div className="rounded-2xl bg-surface-elevated p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          {t('sidebar.nextUp')}
        </h3>
        {nextTile ? (
          <div className="space-y-2">
            <div className="rounded-lg bg-surface-1 p-3">
              <div className="flex min-w-0 items-center gap-2">
                <TileStatusIcon
                  lifecycle={getTileLifecycle(nextTile)}
                  onClick={() => onPromptSuggested?.(nextTile.core.id)}
                  size={16}
                />
                <div className="min-w-0 max-w-full truncate text-sm font-semibold text-foreground">{nextTile.core.title}</div>
              </div>
            </div>
            {nextQuickTiles.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto">
                {nextQuickTiles.map(tile => (
                  <div
                    key={tile.core.id}
                    className="min-w-[128px] max-w-[168px] rounded-md bg-surface-1 px-2 py-1 text-left"
                  >
                    <div className="flex min-w-0 items-center gap-1">
                      <TileStatusIcon lifecycle={getTileLifecycle(tile)} onClick={() => onPromptSuggested?.(tile.core.id)} size={12} />
                      <div className="min-w-0 max-w-full truncate text-xs font-semibold text-foreground">{tile.core.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-foreground-muted">{t('tiles.noTiles')}</p>
        )}
      </div>

      {/* Timeline Card */}
      <div className="flex-1 overflow-hidden rounded-2xl bg-surface-elevated p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          {t('sidebar.timeline')}
        </h3>
        <TimelineAxis
          compact
          blocks={timelineItems.map(item => ({
            id: item.id,
            title: item.title,
            type: item.type,
            status: item.status,
            topPx: item.topPx ?? 0,
            heightPx: item.heightPx ?? 24,
            lane: item.lane ?? 0,
            totalLanes: item.totalLanes ?? 1,
            startLabel: item.time,
            endLabel: item.time,
            durationLabel: '',
            dateLabel: item.date,
            timeLabel: item.time,
            startAt: item.startAt ?? new Date(),
            endAt: item.endAt ?? new Date(),
          }))}
          markers={timelineMarkers}
          canvasHeightPx={timelineCanvasHeightPx}
          nowTopPx={timelineNowTopPx}
          maxVisibleBlocks={timelineMaxVisibleBlocks}
          maxCanvasHeightPx={timelineMaxCanvasHeightPx}
        />
      </div>
    </aside>
  )
}
