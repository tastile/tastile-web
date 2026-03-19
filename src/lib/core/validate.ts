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
      if (state.execution.activeTileId && state.execution.activeTileId !== command.tile_id) {
        throw new ValidationError('Another tile is already active')
      }
      if (getTileLifecycle(tile) === 'done') {
        throw new ValidationError('Cannot start completed tile')
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
  }
}
