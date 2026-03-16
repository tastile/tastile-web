import { SupabaseClient } from '@supabase/supabase-js'
import { Tile, TileCore } from '../domain/tile'
import { createTileId } from '../domain/ids'

export class TileRepository {
  constructor(private supabase: SupabaseClient) {}

  async listTiles(userId: string): Promise<Tile[]> {
    const { data, error } = await this.supabase
      .from('tiles')
      .select('id, local_tile_id, title, next_action, done_definition')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })

    if (error) {
      throw new Error(`Failed to load tiles: ${error.message}`)
    }

    return (data || []).map(row => this.deserialize(row))
  }

  private deserialize(row: any): Tile {
    const core: TileCore = {
      id: createTileId(row.local_tile_id),
      title: row.title,
      nextAction: row.next_action || null,
      doneDefinition: row.done_definition || null,
    }

    return { core }
  }
}
