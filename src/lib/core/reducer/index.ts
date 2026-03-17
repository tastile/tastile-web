import { Execution } from '../../domain/execution'
import { Segment, getTileLifecycle } from '../../domain/tile'
import { AppState } from '../state'
import { Event } from '../event'

export function reduce(state: AppState, event: Event): void {
  switch (event.type) {
    case 'tile_created':
      state.tiles.set(event.tile.core.id, event.tile)
      return
    case 'tile_started': {
      const tile = state.tiles.get(event.tile_id)
      if (!tile) return
      tile.core.startedAt = event.started_at
      tile.core.completedAt = null
      state.execution.activeTileId = event.tile_id
      state.execution.phaseKind = 'work'
      state.execution.phaseStartedAt = event.started_at
      state.execution.phaseEndsAt = new Date(event.started_at.getTime() + 25 * 60 * 1000)
      return
    }
    case 'tile_completed': {
      const tile = state.tiles.get(event.tile_id)
      if (!tile) return
      tile.core.completedAt = event.completed_at
      if (state.execution.activeTileId === event.tile_id) {
        state.execution = Execution.initial()
      }
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
      return
    }
    case 'segment_ended': {
      const tile = state.tiles.get(event.tile_id)
      if (!tile) return
      const seg = tile.work.segments.find(s => s.id === event.segment_id)
      if (seg) seg.endAt = event.ended_at
      return
    }
    case 'tile_deferred':
      reduceTileDeferred(state, event)
      return
    case 'tile_deleted':
      reduceTileDeleted(state, event)
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

export function buildTimelineView(state: AppState): Array<{
  id: string
  time: string
  type: 'work' | 'break' | 'fixed'
  title: string
  status: 'done' | 'active' | 'scheduled'
}> {
  const items = Array.from(state.tiles.values()).flatMap(tile =>
    tile.work.segments.map(seg => ({
      id: String(seg.id),
      at: seg.startAt,
      type: seg.mode === 'work' ? 'work' as const : 'break' as const,
      title: tile.core.title,
      status: seg.endAt ? 'done' as const : (getTileLifecycle(tile) === 'started' ? 'active' as const : 'scheduled' as const),
    }))
  )

  return items
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map(item => ({
      id: item.id,
      time: item.at.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      type: item.type,
      title: item.title,
      status: item.status,
    }))
}
