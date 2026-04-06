'use client'

import { getTileLifecycle, type Tile } from '@/lib/domain/tile'
import type { TileId } from '@/lib/domain/ids'
import { TileStatusIcon } from './shared/TileStatusIcon'
import { LoadingCard } from './shared/LoadingCard'
import { formatDateTime, formatDuration } from '@/lib/utils/tile-formatters'
import { useTranslation } from '@/lib/i18n/use-translation'
import { TILE_CARD_STYLES } from '@/lib/styles/tile-card-styles'
import { cn } from '@/lib/utils/cn'
import { SquarePen } from 'lucide-react'

interface TileCardCompactProps {
  tile: Tile | null
  loading?: boolean
  onStart?: (tileId: TileId) => void
  onClick?: (tile: Tile) => void
  onEdit?: (tileId: TileId) => void
}

export function TileCardCompact({ tile, loading, onStart, onClick, onEdit }: TileCardCompactProps) {
  const { t, locale } = useTranslation()

  if (loading) {
    return <LoadingCard variant="compact" />
  }

  if (!tile) {
    return null
  }

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
    : formatDateTime(null, locale)
  const durationLabel = locale === 'ja' ? '所要' : 'Duration'

  const handleStatusClick = () => {
    if (onStart) {
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
        onClick={onStart ? handleStatusClick : undefined}
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

      <div className="min-w-[92px] shrink-0 text-right text-xs text-foreground-muted whitespace-nowrap">
        <p className="font-mono">{durationLabel} {durationText}</p>
        <p>{t('tiles.startAt')} {startText}</p>
      </div>

      {onEdit ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onEdit(tile.core.id)
          }}
          className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-surface-0 text-foreground-muted hover:bg-surface-2 hover:text-foreground"
          aria-label="Edit tile"
          title="Edit tile"
        >
          <SquarePen className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  )
}

function resolveDurationText(tile: Tile, locale: 'ja' | 'en'): string {
  if (typeof tile.objective.targetWorkMin === 'number' && tile.objective.targetWorkMin > 0) {
    return formatDuration(tile.objective.targetWorkMin, locale)
  }
  const totalWorked = tile.work.segments.reduce((sum, segment) => {
    if (!segment.endAt) return sum
    const diff = Math.max(0, Math.round((segment.endAt.getTime() - segment.startAt.getTime()) / 60000))
    return sum + diff
  }, 0)
  if (totalWorked > 0) return formatDuration(totalWorked, locale)
  return formatDuration(null, locale)
}
