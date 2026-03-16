import { describe, it, expect } from 'vitest'
import { CommandHandler } from './handler'
import { AppState } from './state'
import { CommandEnvelope } from './command'
import { TileId } from '../domain/ids'
import { Actor } from '../domain/actor'
import { TileLifecycle } from '../domain/tile'

describe('CommandHandler', () => {
  it('should handle CreateTile command', () => {
    const state = AppState.initial()
    const handler = new CommandHandler()
    const tileId = TileId.new()
    const envelope = CommandEnvelope.create(
      { type: 'create_tile', tile_id: tileId, title: 'New task', next_action: null, done_definition: null },
      Actor.human('user-1')
    )
    const events = handler.handle(envelope, state)
    expect(events).toHaveLength(1)
    expect(events[0].event.type).toBe('tile_created')
    expect(state.tiles.size).toBe(1)
    expect(state.tiles.get(tileId)?.core.title).toBe('New task')
  })

  it('should handle StartTile and generate two events', () => {
    const state = AppState.initial()
    const handler = new CommandHandler()
    const tileId = TileId.new()
    // First create the tile
    const createEnvelope = CommandEnvelope.create(
      { type: 'create_tile', tile_id: tileId, title: 'Task', next_action: null, done_definition: null },
      Actor.system()
    )
    handler.handle(createEnvelope, state)
    // Then start it
    const startEnvelope = CommandEnvelope.create(
      { type: 'start_tile', tile_id: tileId, started_at: null, source: 'manual' as any },
      Actor.human('user-1')
    )
    const events = handler.handle(startEnvelope, state)
    expect(events).toHaveLength(2) // TileStarted + SegmentStarted
    expect(events[0].event.type).toBe('tile_started')
    expect(events[1].event.type).toBe('segment_started')
    expect(state.tiles.get(tileId)?.core.lifecycle).toBe(TileLifecycle.Started)
    expect(state.execution.active_tile_id).toBe(tileId)
  })

  it('should throw ValidationError for invalid command', () => {
    const state = AppState.initial()
    const handler = new CommandHandler()
    const envelope = CommandEnvelope.create(
      { type: 'start_tile', tile_id: TileId.new(), started_at: null, source: 'manual' as any },
      Actor.human('user-1')
    )
    expect(() => handler.handle(envelope, state)).toThrow()
  })
})
