'use client'

import { cn } from '@/lib/utils/cn'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Loading content"
      className={cn(
        "animate-pulse rounded-lg bg-surface-2",
        className
      )}
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}
