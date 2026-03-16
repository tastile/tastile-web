// src/lib/core/reducer/tile-reducer.test.ts
import { describe, it, expect } from 'vitest'
import { applyTileStarted, applyTileCompleted } from './tile-reducer'
import { Tile, TileLifecycle, StartSource } from '../../domain/tile'
import { TileId } from '../../domain/ids'

describe('Tile Reducer', () => {
  it('should transition to Started lifecycle', () => {
    const tile = Tile.create(TileId.new(), 'Work')
    applyTileStarted(tile, {
      tile_id: tile.core.id,
      started_at: new Date(),
      source: StartSource.Manual,
    })
    expect(tile.core.lifecycle).toBe(TileLifecycle.Started)
  })

  it('should transition to Done lifecycle', () => {
    const tile = Tile.create(TileId.new(), 'Work')
    tile.core.lifecycle = TileLifecycle.Started
    applyTileCompleted(tile, {
      tile_id: tile.core.id,
      completed_at: new Date(),
    })
    expect(tile.core.lifecycle).toBe(TileLifecycle.Done)
  })
})
