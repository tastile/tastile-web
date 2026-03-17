'use client'

import { useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { getTileLifecycle, type Tile } from '@/lib/domain/tile'
import type { TileId } from '@/lib/domain/ids'
import { TileStatusIcon } from './shared/TileStatusIcon'
import { TileActionButtons } from './shared/TileActionButtons'
import { LoadingCard } from './shared/LoadingCard'
import { formatDuration } from '@/lib/utils/tile-formatters'
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
  const { locale } = useTranslation()
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)

  if (loading) {
    return <LoadingCard variant="comfortable" />
  }

  if (!tile) {
    return null
  }

  const lifecycle = getTileLifecycle(tile)

  const handleStatusClick = () => {
    if (lifecycle === 'ready' && actions.onStart) {
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
          onClick={lifecycle === 'ready' ? handleStatusClick : undefined}
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

        <div className="text-xs text-foreground-muted whitespace-nowrap">
          {formatDuration(tile.objective.targetWorkMin, locale)}
        </div>

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
          "border-t border-surface-2 space-y-3",
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
