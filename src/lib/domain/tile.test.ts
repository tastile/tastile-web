// src/lib/domain/tile.test.ts
import { describe, it, expect } from 'vitest'
import { Tile, TileLifecycle, SegmentMode } from './tile'
import { TileId, SegmentId } from './ids'

describe('Tile', () => {
  it('should create new tile in Ready state', () => {
    const id = TileId.new()
    const tile = Tile.create(id, 'Write tests')
    expect(tile.core.id).toBe(id)
    expect(tile.core.title).toBe('Write tests')
    expect(tile.core.lifecycle).toBe(TileLifecycle.Ready)
  })

  it('should calculate worked minutes from single segment', () => {
    const id = TileId.new()
    const tile = Tile.create(id, 'Work tile')
    const now = new Date()
    const past = new Date(now.getTime() - 25 * 60 * 1000) // 25 min ago

    tile.work.segments.push({
      id: SegmentId.new(),
      start_at: past,
      end_at: now,
      mode: SegmentMode.Work,
      source_tile_id: id,
    })

    expect(Tile.workedMinutes(tile.work.segments)).toBe(25)
  })

  it('should calculate worked minutes from multiple segments', () => {
    const id = TileId.new()
    const tile = Tile.create(id, 'Work tile')
    const now = new Date()
    const past1 = new Date(now.getTime() - 50 * 60 * 1000) // 50 min ago
    const past2 = new Date(now.getTime() - 25 * 60 * 1000) // 25 min ago

    tile.work.segments.push(
      {
        id: SegmentId.new(),
        start_at: past1,
        end_at: past2,
        mode: SegmentMode.Work,
        source_tile_id: id,
      },
      {
        id: SegmentId.new(),
        start_at: past2,
        end_at: now,
        mode: SegmentMode.Work,
        source_tile_id: id,
      }
    )

    expect(Tile.workedMinutes(tile.work.segments)).toBe(50)
  })

  it('should ignore active segments when calculating worked minutes', () => {
    const id = TileId.new()
    const tile = Tile.create(id, 'Work tile')
    const now = new Date()
    const past1 = new Date(now.getTime() - 30 * 60 * 1000) // 30 min ago
    const past2 = new Date(now.getTime() - 10 * 60 * 1000) // 10 min ago

    tile.work.segments.push(
      {
        id: SegmentId.new(),
        start_at: past1,
        end_at: past2,
        mode: SegmentMode.Work,
        source_tile_id: id,
      },
      {
        id: SegmentId.new(),
        start_at: past2,
        end_at: null, // Active segment
        mode: SegmentMode.Work,
        source_tile_id: id,
      }
    )

    expect(Tile.workedMinutes(tile.work.segments)).toBe(20)
  })

  it('should ignore break segments when calculating worked minutes', () => {
    const id = TileId.new()
    const tile = Tile.create(id, 'Work tile')
    const now = new Date()
    const past1 = new Date(now.getTime() - 35 * 60 * 1000) // 35 min ago
    const past2 = new Date(now.getTime() - 15 * 60 * 1000) // 15 min ago
    const past3 = new Date(now.getTime() - 10 * 60 * 1000) // 10 min ago

    tile.work.segments.push(
      {
        id: SegmentId.new(),
        start_at: past1,
        end_at: past2,
        mode: SegmentMode.Work,
        source_tile_id: id,
      },
      {
        id: SegmentId.new(),
        start_at: past2,
        end_at: past3,
        mode: SegmentMode.Break,
        source_tile_id: id,
      },
      {
        id: SegmentId.new(),
        start_at: past3,
        end_at: now,
        mode: SegmentMode.Work,
        source_tile_id: id,
      }
    )

    // Only work segments: 20 min + 10 min = 30 min
    expect(Tile.workedMinutes(tile.work.segments)).toBe(30)
  })
})
