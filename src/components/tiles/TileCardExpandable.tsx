'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { SquarePen } from 'lucide-react'
import { getTileLifecycle, type Tile } from '@/lib/domain/tile'
import type { TileId } from '@/lib/domain/ids'
import { TileStatusIcon } from './shared/TileStatusIcon'
import { TileActionButtons } from './shared/TileActionButtons'
import { LoadingCard } from './shared/LoadingCard'
import { formatDateTime, formatDuration } from '@/lib/utils/tile-formatters'
import { useTranslation } from '@/lib/i18n/use-translation'
import { TILE_CARD_STYLES } from '@/lib/styles/tile-card-styles'
import { cn } from '@/lib/utils/cn'

interface TileCardExpandableProps {
  tile: Tile | null
  loading?: boolean
  defaultExpanded?: boolean
  onStart?: (tileId: TileId) => void
  onComplete?: (tileId: TileId) => void
  onDefer?: (tileId: TileId) => void
  onInterrupt?: (tileId: TileId) => void
  onEdit?: (tileId: TileId) => void
  onDelete?: (tileId: TileId) => void
}

export function TileCardExpandable(props: TileCardExpandableProps) {
  const { tile, loading, defaultExpanded = false, ...actions } = props
  const { t, locale } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  if (loading) {
    return <LoadingCard variant="comfortable" />
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
  const durationLabel = t('tiles.duration')

  const handleStatusClick = () => {
    if (actions.onStart) {
      actions.onStart(tile.core.id)
    }
  }

  const handleCardClick = () => {
    setIsExpanded(!isExpanded)
  }

  return (
    <div className={cn(TILE_CARD_STYLES.base)}>
      {/* Header - always visible */}
      <div
        onClick={handleCardClick}
        className={cn(
          "flex items-center gap-3",
          TILE_CARD_STYLES.padding.comfortable,
          "cursor-pointer",
          TILE_CARD_STYLES.hover
        )}
      >
        <TileStatusIcon
          lifecycle={lifecycle}
          onClick={actions.onStart ? handleStatusClick : undefined}
          size={20}
        />

        <div className="flex-1 min-w-0">
          <h4 className={cn(
            "text-sm font-semibold text-foreground",
            lifecycle === 'done' && "line-through opacity-60"
          )}>
            {tile.core.title}
          </h4>
        </div>

        <div className="min-w-[92px] shrink-0 text-right text-xs text-foreground-muted whitespace-nowrap">
          <p className="font-mono">{durationLabel} {durationText}</p>
          <p>{t('tiles.startAt')} {startText}</p>
        </div>

        {actions.onEdit ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              actions.onEdit?.(tile.core.id)
            }}
            className="inline-flex h-8 w-8 items-center justify-center rounded bg-surface-0 text-foreground-muted hover:bg-surface-2 hover:text-foreground"
            aria-label="Edit tile"
            title="Edit tile"
          >
            <SquarePen className="h-4 w-4" />
          </button>
        ) : null}

        <ChevronRight
          className={cn(
            "h-4 w-4 transition-transform text-foreground-muted",
            isExpanded && "rotate-90"
          )}
        />
      </div>

      {/* Expanded details */}
      {isExpanded && (
        <div className={cn(
          "space-y-3",
          TILE_CARD_STYLES.padding.comfortable
        )}>
          {/* Next Action */}
          {tile.core.nextAction && (
            <p className="text-xs text-foreground-muted">
              {tile.core.nextAction}
            </p>
          )}

          {/* Labels */}
          {tile.annotation.labels.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tile.annotation.labels.map(label => {
                const isProject = label.startsWith('project:')
                return (
                  <span
                    key={label}
                    className={cn(
                      "px-2 py-0.5 text-xs rounded-full",
                      isProject
                        ? "bg-primary/10 text-primary font-medium"
                        : "bg-surface-2 text-foreground-muted"
                    )}
                  >
                    {isProject ? label.replace('project:', '') : `#${label}`}
                  </span>
                )
              })}
            </div>
          )}

          {/* Action Buttons */}
          <TileActionButtons
            tile={tile}
            variant="full"
            {...actions}
          />
        </div>
      )}
    </div>
  )
}

function resolveDurationText(tile: Tile, locale: 'ja' | 'en'): string {
  if (typeof tile.objective.targetWorkMin === 'number' && tile.objective.targetWorkMin > 0) {
    return formatDuration(tile.objective.targetWorkMin, locale)
  }
  if (typeof tile.objective.targetRestMin === 'number' && tile.objective.targetRestMin > 0) {
    return formatDuration(tile.objective.targetRestMin, locale)
  }
  const totalWorked = tile.work.segments.reduce((sum, segment) => {
    if (!segment.endAt) return sum
    const diff = Math.max(0, Math.round((segment.endAt.getTime() - segment.startAt.getTime()) / 60000))
    return sum + diff
  }, 0)
  if (totalWorked > 0) return formatDuration(totalWorked, locale)
  return formatDuration(null, locale)
}
