'use client'

import { cn } from '@/lib/utils/cn'

interface TimelineViewProps {
  mode?: 'compact' | 'expanded'
  segments: Array<{
    id: string
    time: string
    type: 'work' | 'break' | 'fixed'
    title: string
    status: 'done' | 'active' | 'scheduled'
  }>
}

export function TimelineView({ mode = 'compact', segments }: TimelineViewProps) {
  return (
    <div className="space-y-0">
      {segments.map((segment) => (
        <TimelineSegment
          key={segment.id}
          segment={segment}
          mode={mode}
        />
      ))}
    </div>
  )
}

interface TimelineSegmentProps {
  segment: {
    time: string
    type: 'work' | 'break' | 'fixed'
    title: string
    status: 'done' | 'active' | 'scheduled'
    duration?: number
  }
  mode: 'compact' | 'expanded'
}

function TimelineSegment({ segment, mode }: TimelineSegmentProps) {
  const { time, type, title, status } = segment

  // Type styles (monochrome)
  const typeStyles = {
    work: 'bg-primary text-primary-fg',
    break: 'bg-surface-2 text-foreground-muted',
    fixed: 'bg-foreground text-background',
  }

  // Status styles
  const statusStyles = {
    done: 'opacity-50',
    active: 'ring-2 ring-primary/30',
    scheduled: 'opacity-40',
  }

  return (
    <div className="flex items-center gap-3 py-2">
      {/* Time */}
      <span className="w-12 text-xs font-medium tabular-nums text-foreground-muted">
        {time}
      </span>

      {/* Bar */}
      <div
        className={cn(
          'h-7 flex-1 rounded-lg px-3 text-xs font-medium flex items-center',
          typeStyles[type],
          statusStyles[status]
        )}
      >
        {mode === 'expanded' ? title : title.substring(0, 15)}
      </div>
    </div>
  )
}
