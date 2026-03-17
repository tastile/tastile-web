import { EventId, SegmentId, TileId } from '../domain/ids'
import { CommandEnvelope } from './command'
import { Event, EventEnvelope } from './event'
import { reduce } from './reducer'
import { AppState } from './state'
import { validate } from './validate'

export class CommandHandler {
  handle(envelope: CommandEnvelope, state: AppState): EventEnvelope[] {
    validate(envelope.command, state)
    const events = this.generate(envelope, state)

    for (const evt of events) {
      reduce(state, evt.event)
      state.events.push(evt)
    }

    return events
  }

  private generate(envelope: CommandEnvelope, state: AppState): EventEnvelope[] {
    const command = envelope.command
    const events: EventEnvelope[] = []

      switch (command.type) {
      case 'create_tile': {
        events.push(this.wrap(envelope, `tile:${command.tile_id}`, { type: 'tile_created', tile: command.tile }))
        return events
      }

      case 'start_tile': {
        const segmentId = SegmentId.new()
        events.push(
          this.wrap(envelope, `tile:${command.tile_id}`, {
            type: 'tile_started',
            tile_id: command.tile_id,
            started_at: command.started_at,
          })
        )
        events.push(
          this.wrap(envelope, `tile:${command.tile_id}`, {
            type: 'segment_started',
            segment_id: segmentId,
            tile_id: command.tile_id,
            mode: 'work',
            started_at: command.started_at,
          })
        )
        return events
      }

      case 'complete_tile': {
        const tile = state.tiles.get(command.tile_id)
        const openSegment = tile ? [...tile.work.segments].reverse().find(s => !s.endAt) : null
        if (openSegment) {
          events.push(
            this.wrap(envelope, `tile:${command.tile_id}`, {
              type: 'segment_ended',
              segment_id: openSegment.id,
              tile_id: command.tile_id,
              mode: 'work',
              ended_at: command.completed_at,
            })
          )
        }
        events.push(
          this.wrap(envelope, `tile:${command.tile_id}`, {
            type: 'tile_completed',
            tile_id: command.tile_id,
            completed_at: command.completed_at,
          })
        )
        return events
      }

      case 'defer_tile': {
        events.push(
          this.wrap(envelope, `tile:${command.tile_id}`, {
            type: 'tile_deferred',
            tile_id: command.tile_id,
            deferred_at: command.deferred_at,
            next_start_at: command.next_start_at,
          })
        )
        return events
      }

      case 'delete_tile': {
        events.push(
          this.wrap(envelope, `tile:${command.tile_id}`, {
            type: 'tile_deleted',
            tile_id: command.tile_id,
            deleted_at: command.deleted_at,
          })
        )
        return events
      }
    }
  }

  private wrap(envelope: CommandEnvelope, aggregateId: string, event: Event): EventEnvelope {
    return {
      event_id: EventId.new(),
      aggregate_id: aggregateId,
      occurred_at: envelope.issued_at,
      actor: envelope.actor,
      caused_by_command_id: envelope.command_id,
      request_id: envelope.request_id,
      event,
    }
  }
}

export function cloneState(state: AppState): AppState {
  return {
    tiles: new Map(
      Array.from(state.tiles.entries()).map(([id, tile]) => [
        id as TileId,
        {
          core: { ...tile.core },
          work: {
            segments: tile.work.segments.map(seg => ({ ...seg })),
          },
          temporal: { ...tile.temporal },
          objective: { ...tile.objective },
          interruption: { ...tile.interruption },
          automation: { ...tile.automation },
          annotation: {
            ...tile.annotation,
            labels: [...tile.annotation.labels],
            timedLabels: tile.annotation.timedLabels.map(label => ({ ...label })),
          },
        },
      ])
    ),
    execution: { ...state.execution },
    events: [...state.events],
  }
}
