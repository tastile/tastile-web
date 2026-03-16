// src/lib/core/state.test.ts
import { describe, it, expect } from 'vitest'
import { AppState } from './state'
import { TileId } from '../domain/ids'
import { Tile } from '../domain/tile'

describe('AppState', () => {
  it('should initialize empty state', () => {
    const state = AppState.initial()
    expect(state.tiles.size).toBe(0)
    expect(state.events).toEqual([])
    expect(state.execution.active_tile_id).toBeNull()
  })

  it('should store tiles in map', () => {
    const state = AppState.initial()
    const tile = Tile.create(TileId.new(), 'Test tile')
    state.tiles.set(tile.core.id, tile)
    expect(state.tiles.size).toBe(1)
    expect(state.tiles.get(tile.core.id)).toBe(tile)
  })
})
