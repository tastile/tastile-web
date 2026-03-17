import { SupabaseClient } from '@supabase/supabase-js'
import { EventEnvelope, Event } from '../core/event'
import { EventId, CommandId, RequestId } from '../domain/ids'
import { Actor } from '../domain/actor'

// Database row shape for the events table
interface EventRow {
  id: string
  user_id: string
  event_id: string
  aggregate_id: string
  event_type: string
  event_payload: Event | null
  payload_json: Event | null
  occurred_at: string
  actor_type: string
  actor_id: string
  caused_by_command_id: string | null
  request_id: string | null
  sequence_number: number
}

export class EventStore {
  constructor(
    private supabase: SupabaseClient,
    private userId: string
  ) {}

  async append(envelope: EventEnvelope): Promise<void> {
    const { error } = await this.supabase.from('events').insert({
      user_id: this.userId,
      event_id: envelope.event_id,
      aggregate_id: envelope.aggregate_id,
      occurred_at: envelope.occurred_at.toISOString(),
      actor_type: envelope.actor.type,
      actor_id: envelope.actor.id,
      caused_by_command_id: envelope.caused_by_command_id,
      request_id: envelope.request_id,
      event_type: envelope.event.type,
      event_payload: envelope.event,
      payload_json: envelope.event, // backward compat with initial schema
      sequence_number: Date.now(), // monotonic ordering approximation
    })

    if (error) {
      throw new Error(`Failed to append event: ${error.message}`)
    }
  }

  async loadAll(): Promise<EventEnvelope[]> {
    const { data, error } = await this.supabase
      .from('events')
      .select('*')
      .eq('user_id', this.userId)
      .order('occurred_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to load events: ${error.message}`)
    }

    return (data || []).map((row: EventRow) => this.deserialize(row))
  }

  async loadSince(sinceEventId: EventId): Promise<EventEnvelope[]> {
    const { data: sinceEvent } = await this.supabase
      .from('events')
      .select('occurred_at')
      .eq('event_id', sinceEventId)
      .single()

    if (!sinceEvent) {
      return []
    }

    const { data, error } = await this.supabase
      .from('events')
      .select('*')
      .eq('user_id', this.userId)
      .gt('occurred_at', sinceEvent.occurred_at)
      .order('occurred_at', { ascending: true })

    if (error) {
      throw new Error(`Failed to load events since ${sinceEventId}: ${error.message}`)
    }

    return (data || []).map((row: EventRow) => this.deserialize(row))
  }

  deserialize(row: EventRow): EventEnvelope {
    // Support both new event_payload and old payload_json column
    const eventPayload = row.event_payload ?? row.payload_json
    if (!eventPayload) {
      throw new Error(`Event row ${row.event_id} has no payload`)
    }

    return {
      event_id: row.event_id as EventId,
      aggregate_id: row.aggregate_id,
      occurred_at: new Date(row.occurred_at),
      actor: {
        type: row.actor_type,
        id: row.actor_id,
      } as Actor,
      caused_by_command_id: row.caused_by_command_id as CommandId | null,
      request_id: row.request_id as RequestId | null,
      event: normalizeEvent(eventPayload),
    }
  }
}

function normalizeEvent(event: Event): Event {
  switch (event.type) {
    case 'tile_started':
      return { ...event, started_at: new Date(event.started_at) }
    case 'tile_completed':
      return { ...event, completed_at: new Date(event.completed_at) }
    case 'tile_deferred':
      return {
        ...event,
        deferred_at: new Date(event.deferred_at),
        next_start_at: event.next_start_at ? new Date(event.next_start_at) : null,
      }
    case 'tile_deleted':
      return { ...event, deleted_at: new Date(event.deleted_at) }
    case 'segment_started':
      return { ...event, started_at: new Date(event.started_at) }
    case 'segment_ended':
      return { ...event, ended_at: new Date(event.ended_at) }
    case 'tile_created':
      const temporal = event.tile.temporal ?? {
        releaseAt: null,
        dueAt: null,
        fixedStart: null,
        fixedEnd: null,
        activeStart: null,
        activeEnd: null,
      }
      const annotation = event.tile.annotation ?? {
        semanticRole: 'work',
        labels: [],
        timedLabels: [],
      }
      return {
        ...event,
        tile: {
          ...event.tile,
          core: {
            ...event.tile.core,
            startedAt: event.tile.core.startedAt ? new Date(event.tile.core.startedAt) : null,
            completedAt: event.tile.core.completedAt ? new Date(event.tile.core.completedAt) : null,
          },
          work: {
            segments: event.tile.work.segments.map(seg => ({
              ...seg,
              startAt: new Date(seg.startAt),
              endAt: seg.endAt ? new Date(seg.endAt) : null,
            })),
          },
          temporal: {
            ...temporal,
            releaseAt: temporal.releaseAt ? new Date(temporal.releaseAt) : null,
            dueAt: temporal.dueAt ? new Date(temporal.dueAt) : null,
            fixedStart: temporal.fixedStart ? new Date(temporal.fixedStart) : null,
            fixedEnd: temporal.fixedEnd ? new Date(temporal.fixedEnd) : null,
            activeStart: temporal.activeStart ? new Date(temporal.activeStart) : null,
            activeEnd: temporal.activeEnd ? new Date(temporal.activeEnd) : null,
          },
          annotation: {
            ...annotation,
            timedLabels: annotation.timedLabels.map(label => ({
              ...label,
              startAt: label.startAt ? new Date(label.startAt) : null,
              endAt: label.endAt ? new Date(label.endAt) : null,
            })),
          },
        },
      }
  }
}
