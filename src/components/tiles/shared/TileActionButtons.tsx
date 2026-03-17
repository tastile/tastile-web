'use client'

import { useTranslation } from '@/lib/i18n/use-translation'
import { getTileLifecycle, type Tile } from '@/lib/domain/tile'
import type { TileId } from '@/lib/domain/ids'
import { BUTTON_STYLES } from '@/lib/styles/button-styles'
import { cn } from '@/lib/utils/cn'

interface TileActionButtonsProps {
  tile: Tile
  variant: 'compact' | 'full'
  onStart?: (tileId: TileId) => void
  onComplete?: (tileId: TileId) => void
  onDefer?: (tileId: TileId) => void
  onInterrupt?: (tileId: TileId) => void
  onEdit?: (tileId: TileId) => void
  onDelete?: (tileId: TileId) => void
}

export function TileActionButtons({ tile, variant, ...actions }: TileActionButtonsProps) {
  const { t } = useTranslation()
  const lifecycle = getTileLifecycle(tile)

  const ButtonBase = ({
    onClick,
    children,
    primary = false
  }: {
    onClick: () => void
    children: React.ReactNode
    primary?: boolean
  }) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={cn(
        "rounded-lg px-3 py-1.5 text-xs font-semibold",
        primary ? BUTTON_STYLES.primary : BUTTON_STYLES.secondary
      )}
    >
      {children}
    </button>
  )

  if (lifecycle === 'ready') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {actions.onStart && (
          <ButtonBase onClick={() => actions.onStart!(tile.core.id)} primary>
            {t('tiles.actions.start')}
          </ButtonBase>
        )}
        {variant === 'full' && (
          <>
            {actions.onDefer && (
              <ButtonBase onClick={() => actions.onDefer!(tile.core.id)}>
                {t('tiles.actions.defer')}
              </ButtonBase>
            )}
            {actions.onEdit && (
              <ButtonBase onClick={() => actions.onEdit!(tile.core.id)}>
                {t('tiles.actions.edit')}
              </ButtonBase>
            )}
            {actions.onDelete && (
              <ButtonBase onClick={() => actions.onDelete!(tile.core.id)}>
                {t('tiles.actions.delete')}
              </ButtonBase>
            )}
          </>
        )}
      </div>
    )
  }

  if (lifecycle === 'started') {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        {actions.onComplete && (
          <ButtonBase onClick={() => actions.onComplete!(tile.core.id)} primary>
            {t('tiles.actions.complete')}
          </ButtonBase>
        )}
        {variant === 'full' && (
          <>
            {actions.onInterrupt && (
              <ButtonBase onClick={() => actions.onInterrupt!(tile.core.id)}>
                {t('tiles.actions.interrupt')}
              </ButtonBase>
            )}
            {actions.onEdit && (
              <ButtonBase onClick={() => actions.onEdit!(tile.core.id)}>
                {t('tiles.actions.edit')}
              </ButtonBase>
            )}
            {actions.onDelete && (
              <ButtonBase onClick={() => actions.onDelete!(tile.core.id)}>
                {t('tiles.actions.delete')}
              </ButtonBase>
            )}
          </>
        )}
      </div>
    )
  }

  // done state
  if (variant === 'full' && actions.onDelete) {
    return (
      <div className="flex items-center gap-2">
        <ButtonBase onClick={() => actions.onDelete!(tile.core.id)}>
          {t('tiles.actions.delete')}
        </ButtonBase>
      </div>
    )
  }

  return null
}
