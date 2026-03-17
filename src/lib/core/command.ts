import { Actor } from '../domain/actor'
import { CommandId, RequestId, TileId } from '../domain/ids'
import { StartSource, Tile } from '../domain/tile'

export type Command =
  | {
      type: 'create_tile'
      tile_id: TileId
      tile: Tile
    }
  | {
      type: 'start_tile'
      tile_id: TileId
      started_at: Date
      source: StartSource
    }
  | {
      type: 'complete_tile'
      tile_id: TileId
      completed_at: Date
      next_tile_id: TileId | null
    }
  | {
      type: 'defer_tile'
      tile_id: TileId
      deferred_at: Date
      next_start_at: Date | null
    }
  | {
      type: 'delete_tile'
      tile_id: TileId
      deleted_at: Date
    }

export interface CommandEnvelope {
  command_id: CommandId
  actor: Actor
  issued_at: Date
  request_id: RequestId | null
  command: Command
}

export const CommandEnvelope = {
  create(command: Command, actor: Actor, requestId: RequestId | null = null): CommandEnvelope {
    return {
      command_id: CommandId.new(),
      actor,
      issued_at: new Date(),
      request_id: requestId,
      command,
    }
  },
}
