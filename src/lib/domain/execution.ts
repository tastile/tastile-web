import { TileId } from './ids'

export type PhaseKind = 'work' | 'break' | 'idle'
export type PromptKind = 'start_tile' | 'end_tile' | 'end_break'
export type PromptSeverity = 'soft' | 'elevated' | 'critical'
export type PromptAction = 'start_tile' | 'complete_tile' | 'extend_phase' | 'defer_tile' | 'end_break' | 'dismiss'

export interface PendingPrompt {
  promptId: string
  tileId: TileId | null
  kind: PromptKind
  severity: PromptSeverity
  title?: string | null
  body?: string | null
  why?: string | null
  suggestedMinutes: number | null
  reasons: string[]
  actions: PromptAction[]
  scheduledAt: Date
  reason: string
  expiresAt?: Date | null
  stale?: boolean
}

export interface Execution {
  activeTileId: TileId | null
  phaseKind: PhaseKind
  phaseStartedAt: Date | null
  phaseEndsAt: Date | null
  pendingPrompt: PendingPrompt | null
}

export type PromptQueueStatus = 'pending' | 'acknowledged' | 'completed' | 'dismissed'
export type TimelineItemType = 'work' | 'break' | 'fixed'
export type TimelineItemStatus = 'done' | 'active' | 'scheduled'

export interface InProgressTileSnapshot {
  tileId: TileId
  title: string
  phaseKind: PhaseKind
  startedAt: Date
  phaseEndsAt: Date | null
}

export interface PromptQueueItemSnapshot extends PendingPrompt {
  status: PromptQueueStatus
}

export interface TimelineItemSnapshot {
  id: string
  tileId: TileId | null
  title: string
  type: TimelineItemType
  status: TimelineItemStatus
  startAt: Date
  endAt: Date | null
}

export interface ExecutionSnapshot {
  inProgressTiles: InProgressTileSnapshot[]
  promptQueue: PromptQueueItemSnapshot[]
  timeline: TimelineItemSnapshot[]
}

export const Execution = {
  initial: (): Execution => ({
    activeTileId: null,
    phaseKind: 'idle',
    phaseStartedAt: null,
    phaseEndsAt: null,
    pendingPrompt: null,
  }),
}
