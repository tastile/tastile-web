import { CommandEnvelope, Command } from './command'
import { EventEnvelope, Event } from './event'
import { AppState } from './state'
import { validate } from './validate'
import { reduce } from './reducer'
import { Tile, SegmentMode, StartSource } from '../domain/tile'
import { EventId } from '../domain/ids'

export class CommandHandler {
  handle(envelope: CommandEnvelope, state: AppState): EventEnvelope[] {
    // 1. Validate
    validate(envelope.command, state)

    // 2. Generate events
    const events = this.generateEvents(envelope, state)

    // 3. Apply events to state
    for (const evt of events) {
      reduce(state, evt.event)
      state.events.push(evt)
    }

    return events
  }

  private generateEvents(envelope: CommandEnvelope, _state: AppState): EventEnvelope[] {
    const events: EventEnvelope[] = []
    const now = envelope.issued_at

    switch (envelope.command.type) {
      case 'create_tile': {
        const tile = Tile.create(envelope.command.tile_id, envelope.command.title)
        tile.core.next_action = envelope.command.next_action
        tile.core.done_definition = envelope.command.done_definition
        events.push(this.wrap(envelope, `tile:${envelope.command.tile_id}`, { type: 'tile_created', tile }))
        break
      }

      case 'start_tile':
        events.push(this.wrap(envelope, `tile:${envelope.command.tile_id}`, {
          type: 'tile_started',
          tile_id: envelope.command.tile_id,
          started_at: envelope.command.started_at || now,
          source: envelope.command.source,
        }))
        events.push(this.wrap(envelope, `tile:${envelope.command.tile_id}`, {
          type: 'segment_started',
          tile_id: envelope.command.tile_id,
          mode: SegmentMode.Work,
          started_at: envelope.command.started_at || now,
        }))
        break

      case 'defer_tile':
        events.push(this.wrap(envelope, `tile:${envelope.command.tile_id}`, {
          type: 'tile_deferred',
          tile_id: envelope.command.tile_id,
          deferred_at: now,
          reason: envelope.command.reason,
          defer_until: envelope.command.defer_until,
        }))
        break

      case 'complete_tile': {
        const completedAt = envelope.command.completed_at
        events.push(this.wrap(envelope, `tile:${envelope.command.tile_id}`, {
          type: 'segment_ended',
          tile_id: envelope.command.tile_id,
          mode: SegmentMode.Work,
          ended_at: completedAt,
        }))
        events.push(this.wrap(envelope, `tile:${envelope.command.tile_id}`, {
          type: 'tile_completed',
          tile_id: envelope.command.tile_id,
          completed_at: completedAt,
        }))
        if (envelope.command.next_tile_id) {
          events.push(this.wrap(envelope, `tile:${envelope.command.next_tile_id}`, {
            type: 'tile_started',
            tile_id: envelope.command.next_tile_id,
            started_at: completedAt,
            source: StartSource.Auto,
          }))
          events.push(this.wrap(envelope, `tile:${envelope.command.next_tile_id}`, {
            type: 'segment_started',
            tile_id: envelope.command.next_tile_id,
            mode: SegmentMode.Work,
            started_at: completedAt,
          }))
        }
        break
      }

      case 'extend_phase':
        events.push(this.wrap(envelope, 'execution:singleton', {
          type: 'phase_extended',
          tile_id: envelope.command.tile_id,
          delta_min: envelope.command.delta_min,
          extended_at: now,
        }))
        break

      case 'attach_memo':
        events.push(this.wrap(
          envelope,
          envelope.command.tile_id ? `tile:${envelope.command.tile_id}` : 'memo:global',
          {
            type: 'memo_attached',
            tile_id: envelope.command.tile_id,
            text: envelope.command.text,
            memo_kind: envelope.command.memo_kind,
            attached_at: now,
          }
        ))
        break

      case 'start_break': {
        const endsAt = new Date(now.getTime() + envelope.command.break_min * 60 * 1000)
        events.push(this.wrap(envelope, 'execution:singleton', {
          type: 'break_started',
          linked_tile_id: envelope.command.linked_tile_id,
          started_at: now,
          ends_at: endsAt,
          reason: envelope.command.reason,
        }))
        break
      }

      case 'end_break':
        events.push(this.wrap(envelope, 'execution:singleton', {
          type: 'break_ended',
          ended_at: envelope.command.ended_at,
        }))
        break
    }

    return events
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
