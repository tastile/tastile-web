// src/lib/core/event.ts
import { TileId, EventId, CommandId } from '../domain/ids'
import { Actor } from '../domain/actor'
import { Tile, StartSource, SegmentMode } from '../domain/tile'

export interface TileCreatedPayload {
  tile: Tile
}

export interface TileStartedPayload {
  tile_id: TileId
  started_at: Date
  source: StartSource
}

export interface TileDeferredPayload {
  tile_id: TileId
  deferred_at: Date
  reason: string | null
  defer_until: Date | null
}

export interface TileCompletedPayload {
  tile_id: TileId
  completed_at: Date
}

export interface SegmentStartedPayload {
  tile_id: TileId
  mode: SegmentMode
  started_at: Date
}

export interface SegmentEndedPayload {
  tile_id: TileId
  mode: SegmentMode
  ended_at: Date
}

export interface PhaseExtendedPayload {
  tile_id: TileId
  delta_min: number
  extended_at: Date
}

export interface BreakStartedPayload {
  linked_tile_id: TileId | null
  started_at: Date
  ends_at: Date
  reason: string | null
}

export interface BreakEndedPayload {
  ended_at: Date
}

export interface MemoAttachedPayload {
  tile_id: TileId | null
  text: string
  memo_kind: string | null
  attached_at: Date
}

export type Event =
  | ({ type: 'tile_created' } & TileCreatedPayload)
  | ({ type: 'tile_started' } & TileStartedPayload)
  | ({ type: 'tile_deferred' } & TileDeferredPayload)
  | ({ type: 'tile_completed' } & TileCompletedPayload)
  | ({ type: 'segment_started' } & SegmentStartedPayload)
  | ({ type: 'segment_ended' } & SegmentEndedPayload)
  | ({ type: 'phase_extended' } & PhaseExtendedPayload)
  | ({ type: 'break_started' } & BreakStartedPayload)
  | ({ type: 'break_ended' } & BreakEndedPayload)
  | ({ type: 'memo_attached' } & MemoAttachedPayload)

export interface EventEnvelope {
  event_id: EventId
  aggregate_id: string
  occurred_at: Date
  actor: Actor
  caused_by_command_id: CommandId | null
  request_id: string | null
  event: Event
}

export const EventEnvelope = {
  create: (
    event: Event,
    aggregateId: string,
    actor: Actor,
    causedBy: CommandId | null = null
  ): EventEnvelope => ({
    event_id: EventId.new(),
    aggregate_id: aggregateId,
    occurred_at: new Date(),
    actor,
    caused_by_command_id: causedBy,
    request_id: null,
    event,
  }),
}
