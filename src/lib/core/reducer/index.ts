import { PendingPrompt } from '../../domain/execution'
import { Segment } from '../../domain/tile'
import { AppState } from '../state'
import { Event } from '../event'

export function reduce(state: AppState, event: Event): void {
  switch (event.type) {
    case 'tile_created':
      state.tiles.set(event.tile.core.id, event.tile)
      recalculateDerivedExecution(state, new Date())
      return
    case 'tile_started': {
      const tile = state.tiles.get(event.tile_id)
      if (!tile) return
      tile.core.startedAt = event.started_at
      tile.core.completedAt = null
      recalculateDerivedExecution(state, new Date())
      return
    }
    case 'tile_completed': {
      const tile = state.tiles.get(event.tile_id)
      if (!tile) return
      tile.core.completedAt = event.completed_at
      recalculateDerivedExecution(state, new Date())
      return
    }
    case 'segment_started': {
      const tile = state.tiles.get(event.tile_id)
      if (!tile) return
      const seg: Segment = {
        id: event.segment_id,
        startAt: event.started_at,
        endAt: null,
        mode: event.mode,
        sourceTileId: event.tile_id,
      }
      tile.work.segments.push(seg)
      recalculateDerivedExecution(state, new Date())
      return
    }
    case 'segment_ended': {
      const tile = state.tiles.get(event.tile_id)
      if (!tile) return
      const seg = tile.work.segments.find(s => s.id === event.segment_id)
      if (seg) seg.endAt = event.ended_at
      recalculateDerivedExecution(state, new Date())
      return
    }
    case 'tile_deferred':
      reduceTileDeferred(state, event)
      recalculateDerivedExecution(state, new Date())
      return
    case 'tile_deleted':
      reduceTileDeleted(state, event)
      recalculateDerivedExecution(state, new Date())
      return
    case 'break_started':
      recalculateDerivedExecution(state, new Date())
      return
    case 'break_ended':
      recalculateDerivedExecution(state, new Date())
      return
    case 'prompt_scheduled':
      state.execution.pendingPrompt = {
        promptId: event.prompt_id,
        tileId: event.tile_id,
        kind: event.kind,
        severity: event.severity,
        suggestedMinutes: event.suggested_minutes,
        reasons: event.reasons,
        actions: event.actions,
        scheduledAt: event.scheduled_at,
        reason: event.reason,
      }
      return
    case 'prompt_cleared':
      if (state.execution.pendingPrompt?.promptId === event.prompt_id) {
        state.execution.pendingPrompt = null
      }
      return
    case 'tile_interrupted':
      recalculateDerivedExecution(state, new Date())
      return
  }
}

function reduceTileDeferred(state: AppState, event: Extract<Event, { type: 'tile_deferred' }>): void {
  const tile = state.tiles.get(event.tile_id)
  if (!tile) return

  // Update temporal.fixedStart with next_start_at
  if (event.next_start_at) {
    tile.temporal.fixedStart = event.next_start_at
  }

  // If tile was started, mark as not started (deferred while in progress)
  if (tile.core.startedAt !== null) {
    tile.core.startedAt = null
  }
}

function reduceTileDeleted(state: AppState, event: Extract<Event, { type: 'tile_deleted' }>): void {
  // Remove tile from state
  state.tiles.delete(event.tile_id)

  // If this was the active tile, clear execution state
  if (state.execution.activeTileId === event.tile_id) {
    state.execution.activeTileId = null
    state.execution.phaseKind = 'idle'
    state.execution.phaseStartedAt = null
    state.execution.phaseEndsAt = null
  }
}

export function recalculateDerivedExecution(state: AppState, now: Date): void {
  const active = selectActiveSegment(state)
  if (!active) {
    state.execution.activeTileId = null
    state.execution.phaseKind = 'idle'
    state.execution.phaseStartedAt = null
    state.execution.phaseEndsAt = null
    state.execution.pendingPrompt = deriveIdlePrompt(state, now)
    return
  }

  state.execution.activeTileId = active.tile.core.id
  state.execution.phaseKind = active.segment.mode === 'break' ? 'break' : 'work'
  state.execution.phaseStartedAt = active.segment.startAt
  state.execution.phaseEndsAt = derivePhaseEndsAt(active.tile, active.segment)

  state.execution.pendingPrompt = deriveActivePrompt(state, now)
}

type StateTile = AppState['tiles'] extends Map<unknown, infer T> ? T : never

function selectActiveSegment(state: AppState): { tile: StateTile; segment: Segment } | null {
  const inProgress: Array<{ tile: StateTile; segment: Segment }> = []
  for (const tile of state.tiles.values()) {
    if (!tile.core.startedAt || tile.core.completedAt) continue
    const openSegment = [...tile.work.segments].reverse().find(seg => !seg.endAt)
    if (!openSegment) continue
    inProgress.push({ tile, segment: openSegment })
  }
  if (inProgress.length === 0) return null

  const breaks = inProgress.filter(item => item.segment.mode === 'break')
  const candidates = breaks.length > 0 ? breaks : inProgress
  candidates.sort((a, b) => b.segment.startAt.getTime() - a.segment.startAt.getTime())
  return candidates[0]
}

function derivePhaseEndsAt(tile: StateTile, segment: Segment): Date | null {
  if (segment.mode === 'break') {
    const restMin = tile.objective.targetRestMin ?? 5
    return new Date(segment.startAt.getTime() + restMin * 60 * 1000)
  }

  const targetMin = tile.objective.targetWorkMin ?? 25
  let workMin = 0
  for (const seg of tile.work.segments) {
    if (seg.mode !== 'work' || !seg.endAt) continue
    workMin += Math.max(0, Math.floor((seg.endAt.getTime() - seg.startAt.getTime()) / 60000))
  }
  const remainingMin = tile.interruption.breakSplitsWork ? Math.max(0, targetMin - workMin) : targetMin
  return new Date(segment.startAt.getTime() + remainingMin * 60 * 1000)
}

function deriveActivePrompt(state: AppState, now: Date): PendingPrompt | null {
  const endsAt = state.execution.phaseEndsAt
  const activeTileId = state.execution.activeTileId
  if (!endsAt || !activeTileId) return null
  if (endsAt.getTime() > now.getTime()) return null

  if (state.execution.phaseKind === 'break') {
    return {
      promptId: `auto-end-break-${activeTileId}`,
      tileId: activeTileId,
      kind: 'end_break' as const,
      severity: 'elevated' as const,
      suggestedMinutes: null,
      reasons: ['break_phase_expired'],
      actions: ['end_break', 'dismiss'],
      scheduledAt: now,
      reason: 'Break phase expired',
    }
  }

  return {
    promptId: `auto-end-tile-${activeTileId}`,
    tileId: activeTileId,
    kind: 'end_tile' as const,
    severity: 'critical' as const,
    suggestedMinutes: null,
    reasons: ['work_phase_expired'],
    actions: ['complete_tile', 'extend_phase', 'defer_tile', 'dismiss'],
    scheduledAt: now,
    reason: 'Work phase expired',
  }
}

function deriveIdlePrompt(state: AppState, now: Date): PendingPrompt | null {
  const candidates = Array.from(state.tiles.values())
    .filter(tile => tile.core.completedAt === null && tile.annotation.semanticRole !== 'break')
    .sort((a, b) => {
      const aStarted = a.core.startedAt?.getTime() ?? 0
      const bStarted = b.core.startedAt?.getTime() ?? 0
      if (bStarted !== aStarted) return bStarted - aStarted
      const aFixed = a.temporal.fixedStart?.getTime() ?? Number.POSITIVE_INFINITY
      const bFixed = b.temporal.fixedStart?.getTime() ?? Number.POSITIVE_INFINITY
      return aFixed - bFixed
    })
  if (candidates.length === 0) return null
  const tile = candidates[0]
  return {
    promptId: `auto-start-${tile.core.id}`,
    tileId: tile.core.id,
    kind: 'start_tile' as const,
    severity: 'soft' as const,
    suggestedMinutes: tile.objective.targetWorkMin ?? 30,
    reasons: ['resume_in_flight'],
    actions: ['start_tile', 'defer_tile', 'dismiss'],
    scheduledAt: now,
    reason: 'Resume in-flight tile',
  }
}

export function buildTimelineView(state: AppState): Array<{
  id: string
  time: string
  date: string
  type: 'work' | 'break' | 'fixed'
  title: string
  status: 'done' | 'active' | 'scheduled'
}> {
  return state.timeline.map(item => ({
    id: item.id,
    date: item.startAt.toLocaleDateString([], { month: '2-digit', day: '2-digit' }),
    time: item.startAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    type: item.type,
    title: item.title,
    status: item.status,
  }))
}
