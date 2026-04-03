import { SupabaseClient } from '@supabase/supabase-js'
import type { Tile } from '../domain/tile'

interface TileRow {
  tile_id: string
  title: string
  semantic_role: string
  tile_json: unknown
  closed_at: string | null
}

export class EventStore {
  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {}

  async replaceAllTiles(tiles: Tile[]): Promise<void> {
    if (tiles.length === 0) return
    const rows = tiles.map(tile => ({
      tile_id: tile.core.id,
      user_id: this.userId,
      title: tile.core.title,
      semantic_role: tile.annotation.semanticRole,
      tile_json: serializeTile(tile),
      closed_at: getTileClosedAt(tile),
    }))

    const { error } = await this.supabase
      .from('tiles')
      .upsert(rows, { onConflict: 'tile_id' })

    if (error) {
      throw new Error(`Failed to upsert tiles: ${error.message}`)
    }
  }

  async loadAllTiles(): Promise<Tile[]> {
    const { data, error } = await this.supabase
      .from('tiles')
      .select('tile_id,title,semantic_role,tile_json,closed_at')
      .eq('user_id', this.userId)
      .order('updated_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to load tiles: ${error.message}`)
    }

    return (data || []).map((row: TileRow) => deserializeTile(row.tile_json))
  }
}

function serializeTile(tile: Tile): unknown {
  return JSON.parse(JSON.stringify(tile))
}

function deserializeTile(raw: unknown): Tile {
  const tile = structuredClone(raw) as Tile
  if (tile?.core?.startedAt) tile.core.startedAt = new Date(tile.core.startedAt)
  if (tile?.core?.completedAt) tile.core.completedAt = new Date(tile.core.completedAt)
  if (tile?.temporal?.releaseAt) tile.temporal.releaseAt = new Date(tile.temporal.releaseAt)
  if (tile?.temporal?.dueAt) tile.temporal.dueAt = new Date(tile.temporal.dueAt)
  if (tile?.temporal?.fixedStart) tile.temporal.fixedStart = new Date(tile.temporal.fixedStart)
  if (tile?.temporal?.fixedEnd) tile.temporal.fixedEnd = new Date(tile.temporal.fixedEnd)
  if (tile?.temporal?.activeStart) tile.temporal.activeStart = new Date(tile.temporal.activeStart)
  if (tile?.temporal?.activeEnd) tile.temporal.activeEnd = new Date(tile.temporal.activeEnd)
  if (Array.isArray(tile?.work?.segments)) {
    tile.work.segments = tile.work.segments.map(segment => ({
      ...segment,
      startAt: new Date(segment.startAt),
      endAt: segment.endAt ? new Date(segment.endAt) : null,
      expectedEndAt: segment.expectedEndAt ? new Date(segment.expectedEndAt) : null,
    }))
  }
  if (Array.isArray(tile?.annotation?.timedLabels)) {
    tile.annotation.timedLabels = tile.annotation.timedLabels.map(label => ({
      ...label,
      startAt: label.startAt ? new Date(label.startAt) : null,
      endAt: label.endAt ? new Date(label.endAt) : null,
    }))
  }
  return tile
}

function getTileClosedAt(tile: Tile): string | null {
  const segments = tile.work?.segments ?? []
  if (segments.length === 0) return null
  const latestClosed = segments
    .map(segment => segment.endAt)
    .filter((value): value is Date => value instanceof Date)
    .sort((left, right) => right.getTime() - left.getTime())[0]
  return latestClosed ? latestClosed.toISOString() : null
}
