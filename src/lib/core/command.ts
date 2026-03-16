import { TileId, CommandId, RequestId } from '../domain/ids'
import { Actor } from '../domain/actor'
import { StartSource } from '../domain/tile'

// --- Payload Interfaces ---

export interface CreateTilePayload {
  tile_id: TileId
  title: string
  next_action: string | null
  done_definition: string | null
}

export interface StartTilePayload {
  tile_id: TileId
  started_at: Date
  source: StartSource
}

export interface DeferTilePayload {
  tile_id: TileId
  reason: string | null
  defer_until: Date | null
}

export interface CompleteTilePayload {
  tile_id: TileId
  completed_at: Date
  next_tile_id: TileId | null
}

export interface ExtendPhasePayload {
  tile_id: TileId
  delta_min: number
  reason: string | null
}

export interface AttachMemoPayload {
  tile_id: TileId
  text: string
  memo_kind: 'note' | 'outcome' | 'learning'
}

export interface StartBreakPayload {
  linked_tile_id: TileId | null
  break_min: number
  reason: string | null
}

export interface EndBreakPayload {
  ended_at: Date
}

// --- Command Tagged Union ---

export type Command =
  | ({ type: 'create_tile' } & CreateTilePayload)
  | ({ type: 'start_tile' } & StartTilePayload)
  | ({ type: 'defer_tile' } & DeferTilePayload)
  | ({ type: 'complete_tile' } & CompleteTilePayload)
  | ({ type: 'extend_phase' } & ExtendPhasePayload)
  | ({ type: 'attach_memo' } & AttachMemoPayload)
  | ({ type: 'start_break' } & StartBreakPayload)
  | ({ type: 'end_break' } & EndBreakPayload)

// --- Command Envelope ---

export interface CommandEnvelope {
  command_id: CommandId
  actor: Actor
  issued_at: Date
  request_id: RequestId | null
  command: Command
}

export const CommandEnvelope = {
  create(command: Command, actor: Actor, request_id: RequestId | null = null): CommandEnvelope {
    return {
      command_id: CommandId.new(),
      actor,
      issued_at: new Date(),
      request_id,
      command,
    }
  },
}
