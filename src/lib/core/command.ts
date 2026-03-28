import { Actor } from '../domain/actor'
import { CommandId, RequestId, TileId } from '../domain/ids'
import { StartSource, Tile } from '../domain/tile'

export type DaemonCommandRequest =
  | {
      type: 'create_tile'
      tileId: TileId
      tile: Tile
    }
  | {
      type: 'start_tile'
      tileId: TileId
      startedAt: Date
      source: StartSource
    }
  | {
      type: 'complete_tile'
      tileId: TileId
      completedAt: Date
      nextTileId: TileId | null
    }
  | {
      type: 'defer_tile'
      tileId: TileId
      deferredAt: Date
      nextStartAt: Date | null
    }
  | {
      type: 'delete_tile'
      tileId: TileId
      deletedAt: Date
    }
  | {
      type: 'switch_active_tile'
      fromTileId: TileId
      toTileId: TileId
      switchedAt: Date
      reason: string
      interruptSource: 'fixed_schedule' | 'user_switch' | 'high_priority' | 'system_force'
    }
  | {
      type: 'start_break'
      linkedTileId: TileId | null
      breakMin: number
      reason: string | null
    }
  | {
      type: 'end_break'
      tileId: TileId | null
      endedAt: Date | null
    }
  | {
      type: 'extend_phase'
      tileId: TileId
      deltaMin: number
    }
  | {
      type: 'clear_prompt'
      promptId: string
      reason: string
    }
  | {
      type: 'request_prompt'
      tileId: TileId | null
      requestedAt: Date
      reason: string
    }

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
  | {
      type: 'switch_active_tile'
      from_tile_id: TileId
      to_tile_id: TileId
      switched_at: Date
      reason: string
      interrupt_source: 'fixed_schedule' | 'user_switch' | 'high_priority' | 'system_force'
    }
  | {
      type: 'start_break'
      linked_tile_id: TileId | null
      break_min: number
      reason: string | null
    }
  | {
      type: 'end_break'
      tile_id: TileId | null
      ended_at: Date | null
    }
  | {
      type: 'extend_phase'
      tile_id: TileId
      delta_min: number
    }
  | {
      type: 'clear_prompt'
      prompt_id: string
      reason: string
    }
  | {
      type: 'request_prompt'
      tile_id: TileId | null
      requested_at: Date
      reason: string
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

export function fromDaemonCommandRequest(request: DaemonCommandRequest): Command {
  switch (request.type) {
    case 'create_tile':
      return { type: 'create_tile', tile_id: request.tileId, tile: request.tile }
    case 'start_tile':
      return { type: 'start_tile', tile_id: request.tileId, started_at: request.startedAt, source: request.source }
    case 'complete_tile':
      return {
        type: 'complete_tile',
        tile_id: request.tileId,
        completed_at: request.completedAt,
        next_tile_id: request.nextTileId,
      }
    case 'defer_tile':
      return {
        type: 'defer_tile',
        tile_id: request.tileId,
        deferred_at: request.deferredAt,
        next_start_at: request.nextStartAt,
      }
    case 'delete_tile':
      return { type: 'delete_tile', tile_id: request.tileId, deleted_at: request.deletedAt }
    case 'switch_active_tile':
      return {
        type: 'switch_active_tile',
        from_tile_id: request.fromTileId,
        to_tile_id: request.toTileId,
        switched_at: request.switchedAt,
        reason: request.reason,
        interrupt_source: request.interruptSource,
      }
    case 'start_break':
      return {
        type: 'start_break',
        linked_tile_id: request.linkedTileId,
        break_min: request.breakMin,
        reason: request.reason,
      }
    case 'end_break':
      return { type: 'end_break', tile_id: request.tileId, ended_at: request.endedAt }
    case 'extend_phase':
      return { type: 'extend_phase', tile_id: request.tileId, delta_min: request.deltaMin }
    case 'clear_prompt':
      return { type: 'clear_prompt', prompt_id: request.promptId, reason: request.reason }
    case 'request_prompt':
      return {
        type: 'request_prompt',
        tile_id: request.tileId,
        requested_at: request.requestedAt,
        reason: request.reason,
      }
  }

  const exhaustive: never = request
  throw new Error(`Unhandled daemon command: ${JSON.stringify(exhaustive)}`)
}
