'use client'

import { getTileLifecycle, type Tile } from '@/lib/domain/tile'
import type { TileId } from '@/lib/domain/ids'
import { TileStatusIcon } from './shared/TileStatusIcon'
import { LoadingCard } from './shared/LoadingCard'
import { formatDuration } from '@/lib/utils/tile-formatters'
import { useTranslation } from '@/lib/i18n/use-translation'
import { TILE_CARD_STYLES } from '@/lib/styles/tile-card-styles'
import { cn } from '@/lib/utils/cn'

interface TileCardCompactProps {
  tile: Tile | null
  loading?: boolean
  onStart?: (tileId: TileId) => void
  onClick?: (tile: Tile) => void
}

export function TileCardCompact({ tile, loading, onStart, onClick }: TileCardCompactProps) {
  const { locale } = useTranslation()

  if (loading) {
    return <LoadingCard variant="compact" />
  }

  if (!tile) {
    return null
  }

  const lifecycle = getTileLifecycle(tile)

  const handleStatusClick = () => {
    if (lifecycle === 'ready' && onStart) {
      onStart(tile.core.id)
    }
  }

  const handleCardClick = () => {
    if (onClick) {
      onClick(tile)
    }
  }

  return (
    <div
      onClick={handleCardClick}
      className={cn(
        "flex items-center gap-3",
        TILE_CARD_STYLES.base,
        TILE_CARD_STYLES.padding.compact,
        onClick && TILE_CARD_STYLES.hover,
        onClick && "cursor-pointer"
      )}
    >
      <TileStatusIcon
        lifecycle={lifecycle}
        onClick={lifecycle === 'ready' ? handleStatusClick : undefined}
        size={20}
      />

      <div className="flex-1 min-w-0">
        <h4 className={cn(
          "text-sm font-medium text-foreground truncate",
          lifecycle === 'done' && "line-through opacity-60"
        )}>
          {tile.core.title}
        </h4>
      </div>

      <div className="text-xs text-foreground-muted whitespace-nowrap">
        {formatDuration(tile.objective.targetWorkMin, locale)}
      </div>
    </div>
  )
}
