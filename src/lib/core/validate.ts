import { Command } from './command'
import { AppState } from './state'
import { TileLifecycle } from '../domain/tile'

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export function validate(command: Command, state: AppState): void {
  switch (command.type) {
    case 'create_tile':
      if (!command.title.trim()) {
        throw new ValidationError('Title cannot be empty')
      }
      break

    case 'start_tile': {
      const tile = state.tiles.get(command.tile_id)
      if (!tile) {
        throw new ValidationError(`Tile ${command.tile_id} not found`)
      }
      if (tile.core.lifecycle !== TileLifecycle.Ready) {
        throw new ValidationError(`Tile must be Ready to start`)
      }
      break
    }

    case 'defer_tile': {
      const tile = state.tiles.get(command.tile_id)
      if (!tile) {
        throw new ValidationError(`Tile ${command.tile_id} not found`)
      }
      break
    }

    case 'complete_tile': {
      const tile = state.tiles.get(command.tile_id)
      if (!tile) {
        throw new ValidationError(`Tile ${command.tile_id} not found`)
      }
      if (state.execution.active_tile_id !== command.tile_id) {
        throw new ValidationError(`Can only complete active tile`)
      }
      if (command.next_tile_id) {
        const nextTile = state.tiles.get(command.next_tile_id)
        if (!nextTile) {
          throw new ValidationError(`Next tile ${command.next_tile_id} not found`)
        }
      }
      break
    }

    case 'extend_phase':
      if (!state.execution.active_tile_id) {
        throw new ValidationError('No active tile to extend')
      }
      break

    case 'attach_memo':
      // Memos are always valid
      break

    case 'start_break':
      if (command.break_min <= 0) {
        throw new ValidationError('Break duration must be positive')
      }
      break

    case 'end_break':
      // Always valid
      break
  }
}
