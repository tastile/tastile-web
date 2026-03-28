import { AppState } from '@/lib/core/state'
import { Tile, getTileLifecycle } from '@/lib/domain/tile'
import { TileId } from '@/lib/domain/ids'

export interface DashboardProjection {
  next: {
    main: Tile | null
    quick: Tile[]
  }
  tiles: {
    ordered: Tile[]
    ready: Tile[]
    started: Tile[]
    done: Tile[]
  }
  history: {
    events: Array<{
      id: string
      eventType: string
      tileTitle: string
      createdAt: Date
    }>
  }
  timeline: {
    windowStart: Date
    windowEnd: Date
    markers: Array<{
      label: string
      topPx: number
    }>
    canvasHeightPx: number
    nowTopPx: number | null
    blocks: Array<{
      id: string
      title: string
      type: 'work' | 'break' | 'fixed'
      status: 'done' | 'active' | 'scheduled'
      topPx: number
      heightPx: number
      lane: number
      totalLanes: number
      startLabel: string
      endLabel: string
      durationLabel: string
      dateLabel: string
      timeLabel: string
      startAt: Date
      endAt: Date
    }>
  }
}

const PIXELS_PER_HOUR = 120
const MIN_BLOCK_HEIGHT = 24

export interface PhaseMetrics {
  remainingSeconds: number
  totalSeconds: number
  progressPercent: number
  countdownLabel: string
}

export function buildDashboardProjection(state: AppState, now: Date): DashboardProjection {
  const ordered = Array.from(state.tiles.values()).sort((a, b) => {
    const rank = (tile: Tile) => {
      const lifecycle = getTileLifecycle(tile)
      if (lifecycle === 'ready') return 0
      if (lifecycle === 'started') return 1
      return 2
    }
    const diff = rank(a) - rank(b)
    if (diff !== 0) return diff
    return a.core.title.localeCompare(b.core.title, 'en', { sensitivity: 'base' })
  })
  const ready = ordered.filter(tile => getTileLifecycle(tile) === 'ready')
  const started = ordered.filter(tile => getTileLifecycle(tile) === 'started')
  const done = ordered.filter(tile => getTileLifecycle(tile) === 'done')
  const main = ready[0] ?? started[0] ?? null
  const quick = ready.slice(1, 6)
  const titleById = new Map<TileId, string>()
  for (const tile of state.tiles.values()) {
    titleById.set(tile.core.id, tile.core.title)
  }

  const windowStart = startOfDay(now)
  const windowEnd = new Date(windowStart.getTime() + 24 * 60 * 60 * 1000)
  const pxPerMinute = PIXELS_PER_HOUR / 60
  const canvasHeightPx = 24 * PIXELS_PER_HOUR

  const blocks = state.timeline
    .map(item => {
      const segmentEnd = item.endAt ?? now
      const clippedStart = new Date(Math.max(item.startAt.getTime(), windowStart.getTime()))
      const clippedEnd = new Date(Math.min(segmentEnd.getTime(), windowEnd.getTime()))
      if (clippedEnd.getTime() <= clippedStart.getTime()) return null

      const topPx = minutesBetween(windowStart, clippedStart) * pxPerMinute
      const heightPx = Math.max(MIN_BLOCK_HEIGHT, minutesBetween(clippedStart, clippedEnd) * pxPerMinute)

      return {
        id: item.id,
        title: item.title,
        type: item.type,
        status: item.status,
        topPx,
        heightPx,
        lane: 0,
        totalLanes: 1,
        startLabel: formatTime(clippedStart),
        endLabel: formatTime(clippedEnd),
        durationLabel: formatDuration(clippedStart, clippedEnd),
        dateLabel: formatDate(clippedStart),
        timeLabel: formatTime(clippedStart),
        startAt: clippedStart,
        endAt: clippedEnd,
      }
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .sort((a, b) => a.topPx - b.topPx)

  assignLanes(blocks)
  const markers = buildHourMarkers(windowStart, windowEnd, pxPerMinute)

  const nowTopPx = now >= windowStart && now <= windowEnd ? minutesBetween(windowStart, now) * pxPerMinute : null
  const historyEvents = state.timeline
    .flatMap(item => {
      const title = item.tileId ? (titleById.get(item.tileId) ?? item.title) : item.title
      const starts = {
        id: `${item.id}-start`,
        eventType: `${item.type}_started`,
        tileTitle: title,
        createdAt: item.startAt,
      }
      if (!item.endAt) return [starts]
      const ends = {
        id: `${item.id}-end`,
        eventType: `${item.type}_ended`,
        tileTitle: title,
        createdAt: item.endAt,
      }
      return [starts, ends]
    })
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

  return {
    next: { main, quick },
    tiles: {
      ordered,
      ready,
      started,
      done,
    },
    history: {
      events: historyEvents,
    },
    timeline: {
      windowStart,
      windowEnd,
      markers,
      canvasHeightPx,
      nowTopPx,
      blocks,
    },
  }
}

function assignLanes(blocks: Array<{ topPx: number; heightPx: number; lane: number; totalLanes: number }>) {
  const active: Array<{ bottom: number; lane: number }> = []
  for (const block of blocks) {
    const top = block.topPx
    const bottom = block.topPx + block.heightPx
    for (let i = active.length - 1; i >= 0; i -= 1) {
      if (active[i].bottom <= top) {
        active.splice(i, 1)
      }
    }
    const used = new Set(active.map(item => item.lane))
    let lane = 0
    while (used.has(lane)) lane += 1
    block.lane = lane
    active.push({ bottom, lane })
    const total = Math.max(1, ...active.map(item => item.lane + 1))
    block.totalLanes = total
    for (const b of blocks) {
      if (Math.abs(b.topPx - block.topPx) < block.heightPx) {
        b.totalLanes = Math.max(b.totalLanes, total)
      }
    }
  }
}

export function computePhaseMetrics(phaseStartedAt: Date | null, phaseEndsAt: Date | null, now: Date): PhaseMetrics | null {
  if (!phaseStartedAt || !phaseEndsAt) return null
  const totalSeconds = Math.max(1, Math.floor((phaseEndsAt.getTime() - phaseStartedAt.getTime()) / 1000))
  const elapsed = Math.max(0, Math.floor((now.getTime() - phaseStartedAt.getTime()) / 1000))
  const remainingSeconds = Math.max(0, totalSeconds - elapsed)
  const progressPercent = Math.round((Math.max(0, Math.min(1, elapsed / totalSeconds)) * 1000)) / 10
  return {
    remainingSeconds,
    totalSeconds,
    progressPercent,
    countdownLabel: formatCountdown(remainingSeconds),
  }
}

function startOfDay(now: Date): Date {
  const out = new Date(now)
  out.setHours(0, 0, 0, 0)
  return out
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, (end.getTime() - start.getTime()) / 60000)
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDate(d: Date): string {
  return d.toLocaleDateString([], { month: '2-digit', day: '2-digit' })
}

function formatDuration(start: Date, end: Date): string {
  const totalMin = Math.max(1, Math.round((end.getTime() - start.getTime()) / 60000))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '00:00'
  const hh = Math.floor(seconds / 3600)
  const mm = Math.floor((seconds % 3600) / 60)
  const ss = seconds % 60
  if (hh > 0) {
    return `${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
  }
  return `${mm.toString().padStart(2, '0')}:${ss.toString().padStart(2, '0')}`
}

function buildHourMarkers(windowStart: Date, windowEnd: Date, pxPerMinute: number): Array<{ label: string; topPx: number }> {
  const markers: Array<{ label: string; topPx: number }> = []
  const cursor = new Date(windowStart)
  while (cursor <= windowEnd) {
    markers.push({
      label: formatTime(cursor),
      topPx: minutesBetween(windowStart, cursor) * pxPerMinute,
    })
    cursor.setHours(cursor.getHours() + 1, 0, 0, 0)
  }
  return markers
}
