'use client'

import { getTileLifecycle, type Tile } from '@/lib/domain/tile'
import type { TileId } from '@/lib/domain/ids'
import { TileStatusIcon } from './shared/TileStatusIcon'
import { TileActionButtons } from './shared/TileActionButtons'
import { LoadingCard } from './shared/LoadingCard'
import { formatDuration, formatDateTime } from '@/lib/utils/tile-formatters'
import { useTranslation } from '@/lib/i18n/use-translation'
import { TILE_CARD_STYLES } from '@/lib/styles/tile-card-styles'
import { cn } from '@/lib/utils/cn'

interface TileCardDetailedProps {
  tile: Tile | null
  loading?: boolean
  onStart?: (tileId: TileId) => void
  onComplete?: (tileId: TileId) => void
  onDefer?: (tileId: TileId) => void
  onInterrupt?: (tileId: TileId) => void
  onEdit?: (tileId: TileId) => void
  onDelete?: (tileId: TileId) => void
}

export function TileCardDetailed(props: TileCardDetailedProps) {
  const { tile, loading, ...actions } = props
  const { t, locale } = useTranslation()

  if (loading) {
    return <LoadingCard variant="detailed" />
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
  const durationLabel = t('tiles.duration')

  const handleStatusClick = () => {
    if (lifecycle === 'ready' && actions.onStart) {
      actions.onStart(tile.core.id)
    }
  }

  return (
    <div className={cn(
      TILE_CARD_STYLES.base,
      TILE_CARD_STYLES.padding.detailed,
      "space-y-4"
    )}>
      {/* Header */}
      <div className="flex items-start gap-3">
        <TileStatusIcon
          lifecycle={lifecycle}
          onClick={handleStatusClick}
          size={24}
        />

        <div className="flex-1 min-w-0">
          <h3 className={cn(
            "text-base font-semibold text-foreground",
            lifecycle === 'done' && "line-through opacity-60"
          )}>
            {tile.core.title}
          </h3>

          {tile.core.nextAction && (
            <p className="mt-1 text-sm text-foreground-muted">
              {tile.core.nextAction}
            </p>
          )}
        </div>

        <div className="text-sm text-foreground-muted whitespace-nowrap">
          {durationLabel} {durationText}
        </div>
      </div>

      {/* Done Definition */}
      {tile.core.doneDefinition && (
        <div className="rounded-lg bg-surface-2 p-3">
          <p className="text-xs text-foreground-muted">
            <span className="font-medium">{t('tiles.doneDefinition')}:</span>{' '}
            {tile.core.doneDefinition}
          </p>
        </div>
      )}

      {/* Labels */}
      {tile.annotation.labels.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tile.annotation.labels.map(label => {
            const isProject = label.startsWith('project:')
            return (
              <span
                key={label}
                className={cn(
                  "px-2.5 py-1 text-xs rounded-full",
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

      {/* Time Information */}
      <div className="space-y-1 text-xs text-foreground-muted">
        <div>
          <span className="opacity-60">{t('tiles.startAt')}:</span>{' '}
          {startAt ? formatDateTime(startAt, locale) : formatDateTime(null, locale)}
        </div>
        {tile.temporal.fixedEnd ? (
          <div>
            <span className="opacity-60">{t('tiles.endAt')}:</span>{' '}
            {formatDateTime(tile.temporal.fixedEnd, locale)}
          </div>
        ) : null}
      </div>

      {/* Action Buttons */}
      <div className="pt-2 border-t border-surface-2">
        <TileActionButtons
          tile={tile}
          variant="full"
          {...actions}
        />
      </div>
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
