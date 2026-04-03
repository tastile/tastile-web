import { describe, it, expect, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import { EventStore } from './event-store'
import { Tile } from '../domain/tile'
import { TileId } from '../domain/ids'

function createMockSupabase(selectData: unknown[] = []) {
  const upsert = vi.fn().mockResolvedValue({ error: null })
  const order = vi.fn().mockResolvedValue({ data: selectData, error: null })
  const eq = vi.fn().mockReturnValue({ order })
  const select = vi.fn().mockReturnValue({ eq })
  const from = vi.fn().mockReturnValue({ upsert, select })
  return { client: { from } as unknown as SupabaseClient, upsert, from }
}

describe('EventStore tile snapshot sync', () => {
  it('upserts tiles into remote snapshot table', async () => {
    const { client, upsert, from } = createMockSupabase()
    const store = new EventStore(client, 'user-1')
    const tile = Tile.create(TileId.new(), 'Test tile')

    await store.replaceAllTiles([tile])

    expect(from).toHaveBeenCalledWith('tiles')
    expect(upsert).toHaveBeenCalledTimes(1)
  })

  it('loads and deserializes remote tiles', async () => {
    const tile = Tile.create(TileId.new(), 'Remote tile')
    tile.core.startedAt = new Date('2026-04-03T10:00:00.000Z')
    const { client } = createMockSupabase([
      {
        tile_id: tile.core.id,
        title: tile.core.title,
        semantic_role: tile.annotation.semanticRole,
        tile_json: JSON.parse(JSON.stringify(tile)),
        closed_at: null,
      },
    ])
    const store = new EventStore(client, 'user-1')

    const rows = await store.loadAllTiles()

    expect(rows).toHaveLength(1)
    expect(rows[0].core.title).toBe('Remote tile')
    expect(rows[0].core.startedAt).toBeInstanceOf(Date)
  })
})
