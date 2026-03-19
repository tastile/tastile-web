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

  private deserialize(row: {
    local_tile_id: string
    title: string
    next_action: string | null
    done_definition: string | null
  }): Tile {
    const core: TileCore = {
      id: createTileId(row.local_tile_id),
      title: row.title,
      nextAction: row.next_action || null,
      doneDefinition: row.done_definition || null,
      startedAt: null,
      completedAt: null,
    }

    return {
      core,
      work: { segments: [] },
      temporal: {
        releaseAt: null,
        dueAt: null,
        fixedStart: null,
        fixedEnd: null,
        activeStart: null,
        activeEnd: null,
      },
      objective: {
        objectiveMode: 'finish_once',
        targetWorkMin: null,
        targetRestMin: null,
        doneRule: 'manual',
        recurrence: null,
      },
      interruption: {
        interruptPenalty: 3,
        resumePenalty: 3,
        breakSplitsWork: true,
        externalInterruptOnly: false,
      },
      automation: {
        promptOnStart: false,
        promptOnEnd: true,
        autoStartAllowed: false,
        autoEndAllowed: false,
      },
      annotation: {
        semanticRole: 'work',
        labels: [],
        timedLabels: [],
      },
    }
  }
}
