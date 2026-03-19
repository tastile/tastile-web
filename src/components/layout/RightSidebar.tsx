'use client'

import { useTranslation } from '@/lib/i18n/use-translation'
import { TileCardCompact } from '@/components/tiles/TileCardCompact'
import { Tile } from '@/lib/domain/tile'
import { TileId } from '@/lib/domain/ids'

interface RightSidebarProps {
  onClose?: () => void
  nextTile: Tile | null
  nextReason?: string
  onStartSuggested?: (tileId: TileId) => void
  timelineTiles: Tile[]
  loading?: boolean
}

export function RightSidebar({ nextTile, nextReason: _nextReason, onStartSuggested, timelineTiles, loading = false }: RightSidebarProps) {
  const { t } = useTranslation()
  void _nextReason

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
        <div className="space-y-2 overflow-auto">
          {timelineTiles.map(tile => (
            <TileCardCompact key={tile.core.id} tile={tile} onStart={onStartSuggested} loading={loading} />
          ))}
          {timelineTiles.length === 0 && (
            <p className="text-sm text-foreground-muted">{t('tiles.noTiles')}</p>
          )}
        </div>
      </div>
    </aside>
  )
}
