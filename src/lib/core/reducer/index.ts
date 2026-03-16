import { AppState } from '../state'
import { Event } from '../event'
import { SegmentId } from '../../domain/ids'
import * as tileReducer from './tile-reducer'
import * as executionReducer from './execution-reducer'

export function reduce(state: AppState, event: Event): void {
  switch (event.type) {
    case 'tile_created':
      state.tiles.set(event.tile.core.id, event.tile)
      break

    case 'tile_started': {
      const tile = state.tiles.get(event.tile_id)
      if (tile) {
        tileReducer.applyTileStarted(tile, event)
      }
      executionReducer.applyTileStarted(state.execution, event)
      break
    }

    case 'tile_deferred': {
      const tile = state.tiles.get(event.tile_id)
      if (tile) {
        tileReducer.applyTileDeferred(tile, event)
      }
      break
    }

    case 'tile_completed': {
      const tile = state.tiles.get(event.tile_id)
      if (tile) {
        tileReducer.applyTileCompleted(tile, event)
      }
      executionReducer.applyTileCompleted(state.execution, event)
      break
    }

    case 'segment_started': {
      const tile = state.tiles.get(event.tile_id)
      if (tile) {
        tile.work.segments.push({
          id: SegmentId.new(),
          start_at: event.started_at,
          end_at: null,
          mode: event.mode,
          source_tile_id: event.tile_id,
        })
      }
      break
    }

    case 'segment_ended': {
      const tile = state.tiles.get(event.tile_id)
      if (tile) {
        const segment = tile.work.segments.slice().reverse().find(s => !s.end_at && s.mode === event.mode)
        if (segment) {
          segment.end_at = event.ended_at
        }
      }
      break
    }

    case 'phase_extended':
      executionReducer.applyPhaseExtended(state.execution, event)
      break

    case 'break_started':
      executionReducer.applyBreakStarted(state.execution, event)
      break

    case 'break_ended':
      executionReducer.applyBreakEnded(state.execution, event)
      break

    case 'memo_attached': {
      if (event.tile_id) {
        const tile = state.tiles.get(event.tile_id)
        if (tile) {
          tileReducer.applyMemoAttached(tile, event)
        }
      }
      break
    }
  }
}
