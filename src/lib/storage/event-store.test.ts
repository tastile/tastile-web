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
    if (!envelope) {
      throw new Error('Expected non-null envelope')
    }

    expect(envelope.event_id).toBe('event-123')
    expect(envelope.event.type).toBe('tile_created')
    expect(envelope.actor.type).toBe('system')
  })

  it('should deserialize legacy tile_created payloads without timedLabels and segments', () => {
    const supabase = createMockSupabase()
    const store = new EventStore(supabase, userId)
    const tile = Tile.create(TileId.new(), 'Legacy')
    const legacyTile = {
      ...tile,
      work: {} as unknown,
      annotation: { semanticRole: 'work', labels: ['legacy'] } as unknown,
    }
    const row = {
      id: 'row-legacy',
      user_id: userId,
      event_id: 'event-legacy',
      aggregate_id: `tile:${tile.core.id}`,
      event_type: 'tile_created',
      event_payload: { type: 'tile_created', tile: legacyTile } as never,
      payload_json: null,
      occurred_at: new Date().toISOString(),
      actor_type: 'system',
      actor_id: 'system',
      caused_by_command_id: null,
      request_id: null,
      sequence_number: 2,
    } as never

    const envelope = store.deserialize(row)
    if (!envelope) {
      throw new Error('Expected non-null envelope')
    }
    if (envelope.event.type !== 'tile_created') {
      throw new Error('Expected tile_created event')
    }

    expect(envelope.event.tile.annotation.timedLabels).toEqual([])
    expect(envelope.event.tile.work.segments).toEqual([])
  })

  it('should skip unknown event payloads without throwing', () => {
    const supabase = createMockSupabase()
    const store = new EventStore(supabase, userId)
    const row = {
      id: 'row-unknown',
      user_id: userId,
      event_id: 'event-unknown',
      aggregate_id: 'tile:unknown',
      event_type: 'unknown',
      event_payload: { type: 'memo_attached', memo: 'x' } as unknown,
      payload_json: null,
      occurred_at: new Date().toISOString(),
      actor_type: 'system',
      actor_id: 'system',
      caused_by_command_id: null,
      request_id: null,
      sequence_number: 3,
    }

    const envelope = store.deserialize(row as never)
    expect(envelope).toBeNull()
  })

  it('should deserialize break_started and break_ended payload dates', () => {
    const supabase = createMockSupabase()
    const store = new EventStore(supabase, userId)
    const startedAt = new Date().toISOString()
    const endedAt = new Date(Date.now() + 5 * 60 * 1000).toISOString()

    const started = store.deserialize({
      id: 'row-break-start',
      user_id: userId,
      event_id: 'event-break-start',
      aggregate_id: 'execution:singleton',
      event_type: 'break_started',
      event_payload: {
        type: 'break_started',
        linked_tile_id: null,
        started_at: startedAt,
        ends_at: endedAt,
        reason: null,
      } as never,
      payload_json: null,
      occurred_at: startedAt,
      actor_type: 'system',
      actor_id: 'system',
      caused_by_command_id: null,
      request_id: null,
      sequence_number: 10,
    } as never)
    if (!started || started.event.type !== 'break_started') throw new Error('Expected break_started')
    expect(started.event.started_at).toBeInstanceOf(Date)
    expect(started.event.ends_at).toBeInstanceOf(Date)

    const ended = store.deserialize({
      id: 'row-break-end',
      user_id: userId,
      event_id: 'event-break-end',
      aggregate_id: 'execution:singleton',
      event_type: 'break_ended',
      event_payload: {
        type: 'break_ended',
        ended_at: endedAt,
      } as never,
      payload_json: null,
      occurred_at: endedAt,
      actor_type: 'system',
      actor_id: 'system',
      caused_by_command_id: null,
      request_id: null,
      sequence_number: 11,
    } as never)
    if (!ended || ended.event.type !== 'break_ended') throw new Error('Expected break_ended')
    expect(ended.event.ended_at).toBeInstanceOf(Date)
  })
})
