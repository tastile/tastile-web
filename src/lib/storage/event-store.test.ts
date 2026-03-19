import { describe, it, expect, vi } from 'vitest'
import { EventStore } from './event-store'
import { EventEnvelope } from '../core/event'
import { Tile } from '../domain/tile'
import { TileId } from '../domain/ids'
import { Actor } from '../domain/actor'
import type { SupabaseClient } from '@supabase/supabase-js'

type MockInsertResult = { error: { message: string } | null }
type MockSelectResult = { data: unknown[]; error: { message: string } | null }

// Mock Supabase client
function createMockSupabase(
  insertResult: MockInsertResult = { error: null },
  selectResult: MockSelectResult = { data: [], error: null }
) {
  const fromMock = vi.fn().mockReturnValue({
    insert: vi.fn().mockResolvedValue(insertResult),
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue(selectResult),
        single: vi.fn().mockResolvedValue({ data: null }),
      }),
    }),
  })
  return { from: fromMock } as unknown as SupabaseClient
}

describe('EventStore', () => {
  const userId = 'test-user-id'

  it('should append event to Supabase', async () => {
    const supabase = createMockSupabase()
    const store = new EventStore(supabase, userId)
    const tile = Tile.create(TileId.new(), 'Test')
    const envelope = EventEnvelope.create({ type: 'tile_created', tile }, `tile:${tile.core.id}`, Actor.system())

    await store.append(envelope)

    expect(supabase.from).toHaveBeenCalledWith('events')
  })

  it('should load events for user', async () => {
    const supabase = createMockSupabase(undefined, { data: [], error: null })
    const store = new EventStore(supabase, userId)

    const events = await store.loadAll()

    expect(Array.isArray(events)).toBe(true)
    expect(events).toHaveLength(0)
  })

  it('should throw on Supabase error during append', async () => {
    const supabase = createMockSupabase({ error: { message: 'DB error' } })
    const store = new EventStore(supabase, userId)
    const tile = Tile.create(TileId.new(), 'Test')
    const envelope = EventEnvelope.create({ type: 'tile_created', tile }, `tile:${tile.core.id}`, Actor.system())

    await expect(store.append(envelope)).rejects.toThrow('Failed to append event')
  })

  it('should deserialize row to EventEnvelope', () => {
    const supabase = createMockSupabase()
    const store = new EventStore(supabase, userId)
    const tile = Tile.create(TileId.new(), 'Test')
    const row = {
      id: 'row-id',
      user_id: userId,
      event_id: 'event-123',
      aggregate_id: `tile:${tile.core.id}`,
      event_type: 'tile_created',
      event_payload: { type: 'tile_created', tile } as const,
      payload_json: null,
      occurred_at: new Date().toISOString(),
      actor_type: 'system',
      actor_id: 'system',
      caused_by_command_id: null,
      request_id: null,
      sequence_number: 1,
    }

    const envelope = store.deserialize(row)

    expect(envelope.event_id).toBe('event-123')
    expect(envelope.event.type).toBe('tile_created')
    expect(envelope.actor.type).toBe('system')
  })
})
