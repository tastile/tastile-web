'use client'

import { Circle, CircleDot, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { TileLifecycle } from '@/lib/domain/tile'
import { TILE_STATUS_COLORS } from '@/lib/styles/tile-card-styles'

interface TileStatusIconProps {
  lifecycle: TileLifecycle
  onClick?: () => void
  disabled?: boolean
  size?: number
}

export function TileStatusIcon({ lifecycle, onClick, disabled = false, size = 20 }: TileStatusIconProps) {
  const IconComponent = lifecycle === 'ready'
    ? Circle
    : lifecycle === 'started'
    ? CircleDot
    : CheckCircle2

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (!disabled && onClick) {
      onClick()
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || !onClick}
      className={cn(
        "flex shrink-0 items-center justify-center rounded-lg transition-colors",
        !disabled && onClick && "hover:bg-surface-2",
        disabled && "opacity-50 cursor-not-allowed",
        TILE_STATUS_COLORS[lifecycle]
      )}
      aria-label={`Status: ${lifecycle}`}
    >
      <IconComponent size={size} />
    </button>
  )
}
