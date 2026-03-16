// src/lib/core/event.test.ts
import { describe, it, expect } from 'vitest'
import { Event, EventEnvelope, TileCreatedPayload } from './event'
import { TileId, EventId } from '../domain/ids'
import { Tile } from '../domain/tile'
import { Actor } from '../domain/actor'

describe('Event', () => {
  it('should create TileCreated event', () => {
    const tile = Tile.create(TileId.new(), 'Test')
    const payload: TileCreatedPayload = { tile }
    const evt: Event = { type: 'tile_created', ...payload }
    expect(evt.type).toBe('tile_created')
    expect(evt.tile.core.title).toBe('Test')
  })

  it('should wrap event in envelope', () => {
    const tile = Tile.create(TileId.new(), 'Test')
    const envelope = EventEnvelope.create(
      { type: 'tile_created', tile },
      `tile:${tile.core.id}`,
      Actor.system()
    )
    expect(envelope.event_id).toBeDefined()
    expect(envelope.aggregate_id).toContain('tile:')
  })
})
