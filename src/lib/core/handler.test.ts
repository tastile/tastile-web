import { describe, expect, it } from 'vitest'
import { CommandEnvelope } from './command'
import { CommandHandler } from './handler'
import { AppState } from './state'
import { TileId } from '../domain/ids'
import { Actor } from '../domain/actor'
import { getTileLifecycle, Tile } from '../domain/tile'

describe('CommandHandler', () => {
  it('creates a tile and stores it in state through reducer application', () => {
    const state = AppState.initial()
    const handler = new CommandHandler()
    const tileId = TileId.new()
    const tile = Tile.create(tileId, 'Write release notes')
    tile.core.nextAction = 'Draft changelog'

    const events = handler.handle(
      CommandEnvelope.create(
        {
          type: 'create_tile',
          tile_id: tileId,
          tile,
        },
        Actor.human('user-1')
      ),
      state
    )

    expect(events).toHaveLength(1)
    expect(events[0].event.type).toBe('tile_created')
    expect(state.tiles.get(tileId)?.core.title).toBe('Write release notes')
    expect(state.tiles.get(tileId)?.core.nextAction).toBe('Draft changelog')
  })

  it('completes an active tile and returns execution to idle', () => {
    const state = AppState.initial()
    const handler = new CommandHandler()
    const tileId = TileId.new()
    const actor = Actor.human('user-1')
    const now = new Date('2026-03-16T09:00:00.000Z')
    const tile = Tile.create(tileId, 'Ship dashboard')

    handler.handle(
      CommandEnvelope.create(
        {
          type: 'create_tile',
          tile_id: tileId,
          tile,
        },
        actor
      ),
      state
    )

    handler.handle(
      CommandEnvelope.create(
        {
          type: 'start_tile',
          tile_id: tileId,
          started_at: now,
          source: 'manual',
        },
        actor
      ),
      state
    )

    const completionEvents = handler.handle(
      CommandEnvelope.create(
        {
          type: 'complete_tile',
          tile_id: tileId,
          completed_at: new Date('2026-03-16T09:25:00.000Z'),
          next_tile_id: null,
        },
        actor
      ),
      state
    )

    expect(completionEvents.map(e => e.event.type)).toEqual(['segment_ended', 'tile_completed'])
    expect(getTileLifecycle(state.tiles.get(tileId)!)).toBe('done')
    expect(state.execution.activeTileId).toBeNull()
  })
})
