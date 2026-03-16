import { describe, it, expect } from 'vitest'
import { validate, ValidationError } from './validate'
import { AppState } from './state'
import { TileId } from '../domain/ids'
import { Tile, TileLifecycle, StartSource } from '../domain/tile'

describe('Validation', () => {
  it('should reject StartTile for non-existent tile', () => {
    const state = AppState.initial()
    const cmd = { type: 'start_tile' as const, tile_id: TileId.new(), started_at: new Date(), source: StartSource.Manual }
    expect(() => validate(cmd, state)).toThrow(ValidationError)
  })

  it('should allow StartTile for Ready tile', () => {
    const state = AppState.initial()
    const tile = Tile.create(TileId.new(), 'Task')
    state.tiles.set(tile.core.id, tile)
    const cmd = { type: 'start_tile' as const, tile_id: tile.core.id, started_at: new Date(), source: StartSource.Manual }
    expect(() => validate(cmd, state)).not.toThrow()
  })

  it('should reject CompleteTile when no active tile', () => {
    const state = AppState.initial()
    const cmd = { type: 'complete_tile' as const, tile_id: TileId.new(), completed_at: new Date(), next_tile_id: null }
    expect(() => validate(cmd, state)).toThrow(ValidationError)
  })

  it('should reject CreateTile with empty title', () => {
    const state = AppState.initial()
    const cmd = { type: 'create_tile' as const, tile_id: TileId.new(), title: '   ', next_action: null, done_definition: null }
    expect(() => validate(cmd, state)).toThrow(ValidationError)
  })

  it('should reject StartTile for non-Ready tile', () => {
    const state = AppState.initial()
    const tile = Tile.create(TileId.new(), 'Task')
    tile.core.lifecycle = TileLifecycle.Started
    state.tiles.set(tile.core.id, tile)
    const cmd = { type: 'start_tile' as const, tile_id: tile.core.id, started_at: new Date(), source: StartSource.Manual }
    expect(() => validate(cmd, state)).toThrow(ValidationError)
  })
})
