import { describe, it, expect } from 'vitest'
import { reduce } from './index'
import { AppState } from '../state'
import { EventEnvelope } from '../event'
import { Tile, TileLifecycle } from '../../domain/tile'
import { TileId } from '../../domain/ids'
import { Actor } from '../../domain/actor'

describe('Root Reducer', () => {
  it('should add tile to state on TileCreated', () => {
    const state = AppState.initial()
    const tile = Tile.create(TileId.new(), 'New task')
    const event = EventEnvelope.create(
      { type: 'tile_created', tile },
      `tile:${tile.core.id}`,
      Actor.system()
    )
    reduce(state, event.event)
    expect(state.tiles.size).toBe(1)
    expect(state.tiles.get(tile.core.id)?.core.title).toBe('New task')
  })

  it('should update tile lifecycle on TileStarted', () => {
    const state = AppState.initial()
    const tile = Tile.create(TileId.new(), 'Task')
    state.tiles.set(tile.core.id, tile)
    const event = EventEnvelope.create(
      { type: 'tile_started', tile_id: tile.core.id, started_at: new Date(), source: 'manual' as any },
      `tile:${tile.core.id}`,
      Actor.system()
    )
    reduce(state, event.event)
    expect(state.tiles.get(tile.core.id)?.core.lifecycle).toBe(TileLifecycle.Started)
    expect(state.execution.active_tile_id).toBe(tile.core.id)
  })
})
