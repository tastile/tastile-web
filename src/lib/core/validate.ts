import { getTileLifecycle } from '../domain/tile'
import { Command } from './command'
import { AppState } from './state'

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export function validate(command: Command, state: AppState): void {
  switch (command.type) {
    case 'create_tile':
      if (!command.tile.core.title.trim()) {
        throw new ValidationError('Title cannot be empty')
      }
      if (command.tile.core.id !== command.tile_id) {
        throw new ValidationError('tile_id must match tile.core.id')
      }
      return
    case 'start_tile': {
      const tile = state.tiles.get(command.tile_id)
      if (!tile) throw new ValidationError(`Tile not found: ${command.tile_id}`)
      if (getTileLifecycle(tile) === 'done') {
        throw new ValidationError('Cannot start completed tile')
      }
      if (tile.work.segments.some(seg => !seg.endAt)) {
        throw new ValidationError('Tile already started')
      }
      return
    }
    case 'complete_tile': {
      const tile = state.tiles.get(command.tile_id)
      if (!tile) throw new ValidationError(`Tile not found: ${command.tile_id}`)
      if (state.execution.activeTileId !== command.tile_id) {
        throw new ValidationError('Can only complete active tile')
      }
      return
    }
    case 'defer_tile': {
      const tile = state.tiles.get(command.tile_id)
      if (!tile) throw new ValidationError(`Tile not found: ${command.tile_id}`)
      return
    }
    case 'delete_tile': {
      const tile = state.tiles.get(command.tile_id)
      if (!tile) throw new ValidationError(`Tile not found: ${command.tile_id}`)
      return
    }
    case 'start_break': {
      const hasBreakInProgress = Array.from(state.tiles.values()).some(
        tile =>
          tile.annotation.semanticRole === 'break' && tile.core.startedAt !== null && tile.core.completedAt === null
      )
      if (hasBreakInProgress) {
        throw new ValidationError('Break already in progress')
      }
      return
    }
    case 'switch_active_tile': {
      if (command.from_tile_id === command.to_tile_id) {
        throw new ValidationError('Cannot switch to same tile')
      }
      const fromTile = state.tiles.get(command.from_tile_id)
      if (!fromTile) throw new ValidationError(`Tile not found: ${command.from_tile_id}`)
      const toTile = state.tiles.get(command.to_tile_id)
      if (!toTile) throw new ValidationError(`Tile not found: ${command.to_tile_id}`)
      return
    }
    case 'end_break': {
      if (command.tile_id) {
        const tile = state.tiles.get(command.tile_id)
        if (!tile) throw new ValidationError(`Tile not found: ${command.tile_id}`)
        if (
          tile.annotation.semanticRole !== 'break' ||
          tile.core.startedAt === null ||
          tile.core.completedAt !== null
        ) {
          throw new ValidationError('Break not in progress')
        }
      }
      return
    }
    case 'extend_phase': {
      if (command.delta_min <= 0) {
        throw new ValidationError('Extend delta must be > 0')
      }
      const tile = state.tiles.get(command.tile_id)
      if (!tile) throw new ValidationError(`Tile not found: ${command.tile_id}`)
      if (tile.core.startedAt === null || tile.core.completedAt !== null) {
        throw new ValidationError('Tile not in progress')
      }
      return
    }
    case 'clear_prompt':
      return
    case 'request_prompt':
      return
  }
}
