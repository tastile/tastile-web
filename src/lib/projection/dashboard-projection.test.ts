import { describe, expect, it } from 'vitest'
import { AppState } from '@/lib/core/state'
import { Tile } from '@/lib/domain/tile'
import { TileId } from '@/lib/domain/ids'
import { buildDashboardProjection, computePhaseMetrics } from './dashboard-projection'

describe('buildDashboardProjection', () => {
  it('selects next main + 5 from ready tiles', () => {
    const state = AppState.initial()
    const started = Tile.create(TileId.fromString('tile-started'), 'Started')
    started.core.startedAt = new Date('2026-03-26T08:00:00.000Z')
    state.tiles.set(started.core.id, started)

    const done = Tile.create(TileId.fromString('tile-done'), 'Done')
    done.core.completedAt = new Date('2026-03-26T08:10:00.000Z')
    state.tiles.set(done.core.id, done)

    for (const title of ['Delta', 'Alpha', 'Echo', 'Charlie', 'Bravo', 'Foxtrot', 'Golf']) {
      const tile = Tile.create(TileId.fromString(`tile-${title.toLowerCase()}`), title)
      state.tiles.set(tile.core.id, tile)
    }

    const view = buildDashboardProjection(state, new Date('2026-03-26T09:00:00.000Z'))
    expect(view.next.main?.core.title).toBe('Alpha')
    expect(view.next.quick.map(tile => tile.core.title)).toEqual(['Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'])
  })

  it('builds absolute timeline blocks with visual heights', () => {
    const state = AppState.initial()
    state.timeline = [
      {
        id: 't1',
        tileId: TileId.fromString('tile-1'),
        title: 'Morning work',
        type: 'work',
        status: 'done',
        startAt: new Date('2026-03-26T09:00:00.000Z'),
        endAt: new Date('2026-03-26T10:00:00.000Z'),
      },
      {
        id: 't2',
        tileId: TileId.fromString('tile-2'),
        title: 'Break',
        type: 'break',
        status: 'active',
        startAt: new Date('2026-03-26T10:00:00.000Z'),
        endAt: new Date('2026-03-26T10:15:00.000Z'),
      },
    ]

    const view = buildDashboardProjection(state, new Date('2026-03-26T10:05:00.000Z'))
    expect(view.timeline.blocks).toHaveLength(2)
    expect(view.timeline.blocks[0].heightPx).toBeGreaterThan(view.timeline.blocks[1].heightPx)
    expect(view.timeline.nowTopPx).toBeGreaterThan(0)
    expect(view.timeline.canvasHeightPx).toBeGreaterThan(0)
    expect(view.timeline.blocks[0].startAt instanceof Date).toBe(true)
    expect(view.timeline.blocks[0].endAt instanceof Date).toBe(true)
  })

  it('formats countdown as HH:MM:SS when remaining is over one hour', () => {
    const metrics = computePhaseMetrics(
      new Date('2026-03-26T09:00:00.000Z'),
      new Date('2026-03-26T10:30:00.000Z'),
      new Date('2026-03-26T09:15:00.000Z')
    )
    expect(metrics?.countdownLabel).toBe('01:15:00')
    expect(metrics?.progressPercent).toBeCloseTo(16.7, 1)
  })

  it('assigns shared total lanes for blocks that overlap near the end of a long block', () => {
    const state = AppState.initial()
    state.timeline = [
      {
        id: 'long',
        tileId: TileId.fromString('tile-long'),
        title: 'Long focus',
        type: 'work',
        status: 'scheduled',
        startAt: new Date('2026-03-26T09:00:00.000Z'),
        endAt: new Date('2026-03-26T10:40:00.000Z'),
      },
      {
        id: 'late',
        tileId: TileId.fromString('tile-late'),
        title: 'Late overlap',
        type: 'fixed',
        status: 'scheduled',
        startAt: new Date('2026-03-26T10:30:00.000Z'),
        endAt: new Date('2026-03-26T10:50:00.000Z'),
      },
    ]

    const view = buildDashboardProjection(state, new Date('2026-03-26T09:15:00.000Z'))
    const long = view.timeline.blocks.find(block => block.id === 'long')
    const late = view.timeline.blocks.find(block => block.id === 'late')

    expect(long?.totalLanes).toBe(2)
    expect(late?.totalLanes).toBe(2)
    expect(long?.lane).toBe(0)
    expect(late?.lane).toBe(1)
  })
})
