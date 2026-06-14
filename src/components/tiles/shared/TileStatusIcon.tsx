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
  className?: string
}

export function TileStatusIcon({ lifecycle, onClick, disabled = false, size = 20, className }: TileStatusIconProps) {
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
        "flex shrink-0 items-center justify-center rounded-full transition-all relative",
        !disabled && onClick && "hover:ring-2 hover:ring-foreground/20 hover:ring-offset-2 hover:ring-offset-background cursor-pointer",
        disabled && "opacity-50 cursor-not-allowed",
        TILE_STATUS_COLORS[lifecycle],
        className
      )}
      aria-label={`Status: ${lifecycle}`}
    >
      {lifecycle === 'started' && (
        <div className="absolute inset-0 rounded-full bg-current animate-ping opacity-75" />
      )}
      <IconComponent size={size} className="relative z-10" />
    </button>
  )
}
