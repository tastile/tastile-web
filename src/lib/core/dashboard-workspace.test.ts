import { describe, expect, it } from 'vitest'
import { Tile } from '@/lib/domain/tile'
import { SegmentId, TileId } from '@/lib/domain/ids'
import { TimelineItemSnapshot } from '@/lib/domain/execution'
import {
  buildTimelineView,
  buildTileChanges,
  groupTilesForWorkspace,
  buildTileListSections,
  nextTileSectionLimit,
  parseCustomRangeBoundary,
} from './dashboard-workspace'

describe('dashboard-workspace core', () => {
  it('builds week and month timeline windows', () => {
    const now = new Date('2026-04-06T10:00:00.000Z')
    const timeline: TimelineItemSnapshot[] = [
      {
        id: 'segment-1',
        tileId: TileId.fromString('tile-1'),
        title: 'Focus',
        type: 'work',
        status: 'scheduled',
        startAt: new Date('2026-04-04T10:00:00.000Z'),
        endAt: new Date('2026-04-04T11:00:00.000Z'),
      },
    ]

    const week = buildTimelineView(timeline, now, { scale: 'week', customStart: null, customEnd: null })
    const month = buildTimelineView(timeline, now, { scale: 'month', customStart: null, customEnd: null })

    expect(week.windowEnd.getTime() - week.windowStart.getTime()).toBe(7 * 24 * 60 * 60 * 1000)
    expect(month.windowEnd.getTime() - month.windowStart.getTime()).toBe(30 * 24 * 60 * 60 * 1000)
    expect(week.blocks.length).toBe(1)
    expect(month.blocks.length).toBe(1)
  })

  it('uses duration minutes to size blocks when end time is missing', () => {
    const now = new Date('2026-04-06T10:00:00.000Z')
    const timeline: TimelineItemSnapshot[] = [
      {
        id: 'short',
        tileId: TileId.fromString('tile-short'),
        title: 'Short',
        type: 'work',
        status: 'scheduled',
        startAt: new Date('2026-04-06T08:00:00.000Z'),
        endAt: null,
        durationMin: 30,
      } as TimelineItemSnapshot,
      {
        id: 'long',
        tileId: TileId.fromString('tile-long'),
        title: 'Long',
        type: 'work',
        status: 'scheduled',
        startAt: new Date('2026-04-06T08:00:00.000Z'),
        endAt: null,
        durationMin: 120,
      } as TimelineItemSnapshot,
    ]

    const view = buildTimelineView(timeline, now, { scale: 'day', customStart: null, customEnd: null })
    const short = view.blocks.find(block => block.id === 'short')
    const long = view.blocks.find(block => block.id === 'long')

    expect(short).toBeTruthy()
    expect(long).toBeTruthy()
    expect(long!.heightPx).toBeGreaterThan(short!.heightPx)
  })

  it('groups tiles by focus ready scheduled recent log from tile data', () => {
    const now = new Date('2026-04-06T10:00:00.000Z')

    const focus = Tile.create(TileId.fromString('tile-focus'), 'Focus task')
    const recent = Tile.create(TileId.fromString('tile-recent'), 'Recent task')
    recent.core.startedAt = new Date('2026-04-06T09:50:00.000Z')
    recent.work.segments.push({
      id: SegmentId.fromString('seg-recent'),
      startAt: new Date('2026-04-05T10:00:00.000Z'),
      endAt: new Date('2026-04-05T11:00:00.000Z'),
      mode: 'work',
      sourceTileId: recent.core.id,
    })

    const scheduled = Tile.create(TileId.fromString('tile-scheduled'), 'Scheduled task')
    scheduled.temporal.dueAt = new Date('2026-04-07T10:00:00.000Z')

    const ready = Tile.create(TileId.fromString('tile-ready'), 'Ready task')

    const log = Tile.create(TileId.fromString('tile-log'), 'Log task')
    log.core.completedAt = new Date('2026-04-05T10:00:00.000Z')

    const groups = groupTilesForWorkspace(
      [focus, recent, scheduled, ready, log],
      focus.core.id,
      now,
    )

    expect(groups.find(group => group.id === 'focus')?.tiles[0].core.id).toBe(focus.core.id)
    expect(groups.find(group => group.id === 'ready')?.tiles[0].core.id).toBe(ready.core.id)
    expect(groups.find(group => group.id === 'recent')?.tiles[0].core.id).toBe(recent.core.id)
    expect(groups.find(group => group.id === 'scheduled')?.tiles[0].core.id).toBe(scheduled.core.id)
    expect(groups.find(group => group.id === 'log')?.tiles[0].core.id).toBe(log.core.id)
  })

  it('builds tile change events from timeline', () => {
    const tileId = TileId.fromString('tile-1')
    const titleById = new Map([[tileId, 'Write docs']])
    const timeline: TimelineItemSnapshot[] = [
      {
        id: 'segment-1',
        tileId,
        title: 'Original',
        type: 'work',
        status: 'done',
        startAt: new Date('2026-04-06T08:00:00.000Z'),
        endAt: new Date('2026-04-06T09:00:00.000Z'),
      },
    ]
    const changes = buildTileChanges(timeline, titleById)
    expect(changes).toHaveLength(2)
    expect(changes[0].eventType).toBe('work_ended')
    expect(changes[1].eventType).toBe('work_started')
    expect(changes[0].tileTitle).toBe('Write docs')
  })

  it('builds project and tag list sections from tile labels', () => {
    const now = new Date('2026-04-06T10:00:00.000Z')
    const withProject = Tile.create(TileId.fromString('tile-project'), 'Project tile')
    withProject.annotation.labels = ['project:core', 'backend']
    const withTagOnly = Tile.create(TileId.fromString('tile-tag'), 'Tagged tile')
    withTagOnly.annotation.labels = ['frontend']
    const plain = Tile.create(TileId.fromString('tile-plain'), 'Plain tile')

    const projectSections = buildTileListSections([withProject, withTagOnly, plain], null, now, 'project')
    const tagSections = buildTileListSections([withProject, withTagOnly, plain], null, now, 'tag')

    expect(projectSections.some(section => section.label === 'core')).toBe(true)
    expect(projectSections.some(section => section.label === 'No Project')).toBe(true)
    expect(tagSections.some(section => section.label === '#backend')).toBe(true)
    expect(tagSections.some(section => section.label === 'Untagged')).toBe(true)
  })

  it('keeps state sections visible even when empty', () => {
    const now = new Date('2026-04-06T10:00:00.000Z')
    const ready = Tile.create(TileId.fromString('tile-ready-only'), 'Only ready')
    const sections = buildTileListSections([ready], null, now, 'state')
    expect(sections.map(section => section.id)).toEqual(['focus', 'ready', 'scheduled', 'recent', 'log'])
    expect(sections.find(section => section.id === 'ready')?.tiles.length).toBe(1)
    expect(sections.find(section => section.id === 'focus')?.tiles.length).toBe(0)
  })

  it('cycles section limits 8 then doubles and resets when exceeding count', () => {
    expect(nextTileSectionLimit(undefined, 40)).toBe(16)
    expect(nextTileSectionLimit(16, 40)).toBe(32)
    expect(nextTileSectionLimit(32, 40)).toBe(8)
    expect(nextTileSectionLimit(8, 6)).toBe(8)
  })

  it('parses custom range date-only boundaries for start and end edges', () => {
    const start = parseCustomRangeBoundary('2026-04-06', 'start')
    const end = parseCustomRangeBoundary('2026-04-06', 'end')

    expect(start).toBeTruthy()
    expect(end).toBeTruthy()
    expect(start?.getFullYear()).toBe(2026)
    expect(start?.getMonth()).toBe(3)
    expect(start?.getDate()).toBe(6)
    expect(start?.getHours()).toBe(0)
    expect(start?.getMinutes()).toBe(0)
    expect(start?.getSeconds()).toBe(0)
    expect(end?.getFullYear()).toBe(2026)
    expect(end?.getMonth()).toBe(3)
    expect(end?.getDate()).toBe(6)
    expect(end?.getHours()).toBe(23)
    expect(end?.getMinutes()).toBe(59)
    expect(end?.getSeconds()).toBe(59)
  })
})
