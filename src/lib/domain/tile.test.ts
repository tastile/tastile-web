// src/lib/domain/tile.test.ts
import { describe, it, expect } from 'vitest'
import { Tile, TileLifecycle, SegmentMode } from './tile'
import { TileId } from './ids'

describe('Tile', () => {
  it('should create new tile in Ready state', () => {
    const id = TileId.new()
    const tile = Tile.create(id, 'Write tests')
    expect(tile.core.id).toBe(id)
    expect(tile.core.title).toBe('Write tests')
    expect(tile.core.lifecycle).toBe(TileLifecycle.Ready)
  })

  it('should calculate worked minutes from segments', () => {
    const id = TileId.new()
    const tile = Tile.create(id, 'Work tile')
    const now = new Date()
    const past = new Date(now.getTime() - 25 * 60 * 1000) // 25 min ago

    tile.work.segments.push({
      id: 'seg-1' as any,
      start_at: past,
      end_at: now,
      mode: SegmentMode.Work,
      source_tile_id: id,
    })

    expect(tile.work.workedMinutes()).toBe(25)
  })
})
