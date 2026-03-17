import { Actor } from '../domain/actor'
import { CommandId, EventId, RequestId, SegmentId, TileId } from '../domain/ids'
import { SegmentMode, Tile } from '../domain/tile'

export type Event =
  | {
      type: 'tile_created'
      tile: Tile
    }
  | {
      type: 'tile_started'
      tile_id: TileId
      started_at: Date
    }
  | {
      type: 'tile_completed'
      tile_id: TileId
      completed_at: Date
    }
  | {
      type: 'tile_deferred'
      tile_id: TileId
      deferred_at: Date
      next_start_at: Date | null
    }
  | {
      type: 'tile_deleted'
      tile_id: TileId
      deleted_at: Date
    }
  | {
      type: 'segment_started'
      segment_id: SegmentId
      tile_id: TileId
      mode: SegmentMode
      started_at: Date
    }
  | {
      type: 'segment_ended'
      segment_id: SegmentId
      tile_id: TileId
      mode: SegmentMode
      ended_at: Date
    }

export interface EventEnvelope {
  event_id: EventId
  aggregate_id: string
  occurred_at: Date
  actor: Actor
  caused_by_command_id: CommandId | null
  request_id: RequestId | null
  event: Event
}

export const EventEnvelope = {
  create(event: Event, aggregateId: string, actor: Actor, causedBy: CommandId | null = null): EventEnvelope {
    return {
      event_id: EventId.new(),
      aggregate_id: aggregateId,
      occurred_at: new Date(),
      actor,
      caused_by_command_id: causedBy,
      request_id: null,
      event,
    }
  },
}

