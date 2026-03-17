'use client'

import { useTranslation } from '@/lib/i18n/use-translation'
import { TileCardCompact } from '@/components/tiles/TileCardCompact'
import { TimelineView } from '@/components/timeline/TimelineView'
import { Tile } from '@/lib/domain/tile'
import { TileId } from '@/lib/domain/ids'

interface RightSidebarProps {
  onClose?: () => void
  nextTile: Tile | null
  nextReason?: string
  onStartSuggested?: (tileId: TileId) => void
  timelineSegments: Array<{
    id: string
    time: string
    type: 'work' | 'break' | 'fixed'
    title: string
    status: 'done' | 'active' | 'scheduled'
  }>
  loading?: boolean
}

export function RightSidebar({ nextTile, nextReason, onStartSuggested, timelineSegments, loading = false }: RightSidebarProps) {
  const { t } = useTranslation()

  return (
    <aside className="relative flex w-72 flex-col gap-3 bg-surface-0">
      {/* Next Up Card */}
      <div className="rounded-2xl bg-surface-elevated p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          {t('sidebar.nextUp')}
        </h3>
        <TileCardCompact tile={nextTile} onStart={onStartSuggested} loading={loading} />
      </div>

      {/* Timeline Card */}
      <div className="flex-1 overflow-hidden rounded-2xl bg-surface-elevated p-4">
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-foreground-muted">
          {t('sidebar.timeline')}
        </h3>
        <div className="overflow-auto">
          <TimelineView mode="compact" segments={timelineSegments} />
        </div>
      </div>
    </aside>
  )
}
