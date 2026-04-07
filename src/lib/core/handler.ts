import { EventId, SegmentId, TileId } from '../domain/ids'
import { CommandEnvelope } from './command'
import { Event, EventEnvelope } from './event'
import { reduce } from './reducer'
import { AppState } from './state'
import { validate } from './validate'
import { Tile } from '../domain/tile'

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

      case 'switch_active_tile': {
        const fromTile = state.tiles.get(command.from_tile_id)
        if (fromTile) {
          const openSegment = [...fromTile.work.segments].reverse().find(s => !s.endAt)
          if (openSegment) {
            events.push(
              this.wrap(envelope, `tile:${command.from_tile_id}`, {
                type: 'segment_ended',
                segment_id: openSegment.id,
                tile_id: command.from_tile_id,
                mode: openSegment.mode,
                ended_at: command.switched_at,
              })
            )
          }
        }
        events.push(
          this.wrap(envelope, `tile:${command.from_tile_id}`, {
            type: 'tile_interrupted',
            tile_id: command.from_tile_id,
            interrupted_at: command.switched_at,
            source: command.interrupt_source,
            reason: command.reason,
            switched_to_tile_id: command.to_tile_id,
          })
        )
        events.push(
          this.wrap(envelope, `tile:${command.to_tile_id}`, {
            type: 'tile_started',
            tile_id: command.to_tile_id,
            started_at: command.switched_at,
          })
        )
        events.push(
          this.wrap(envelope, `tile:${command.to_tile_id}`, {
            type: 'segment_started',
            segment_id: SegmentId.new(),
            tile_id: command.to_tile_id,
            mode: 'work',
            started_at: command.switched_at,
          })
        )
        return events
      }

      case 'start_break': {
        const now = envelope.issued_at
        const linkedTileId = command.linked_tile_id ?? state.execution.activeTileId
        if (linkedTileId) {
          const tile = state.tiles.get(linkedTileId)
          const openSegment = tile ? [...tile.work.segments].reverse().find(s => !s.endAt) : null
          if (openSegment) {
            events.push(
              this.wrap(envelope, `tile:${linkedTileId}`, {
                type: 'segment_ended',
                segment_id: openSegment.id,
                tile_id: linkedTileId,
                mode: openSegment.mode,
                ended_at: now,
              })
            )
          }
        }

        const breakTileId = TileId.new()
        const breakText =
          command.break_min < 60
            ? `${command.break_min}min`
            : `${Math.floor(command.break_min / 60)}h${command.break_min % 60}m`
        const breakTile = Tile.create(breakTileId, `Break (${breakText})`)
        breakTile.annotation.semanticRole = 'break'
        breakTile.objective.targetRestMin = command.break_min
        breakTile.automation.autoEndAllowed = true
        breakTile.automation.autoStartAllowed = false

        events.push(this.wrap(envelope, `tile:${breakTileId}`, { type: 'tile_created', tile: breakTile }))
        events.push(
          this.wrap(envelope, 'execution:singleton', {
            type: 'break_started',
            linked_tile_id: linkedTileId,
            started_at: now,
            ends_at: new Date(now.getTime() + command.break_min * 60 * 1000),
            reason: command.reason,
          })
        )
        events.push(
          this.wrap(envelope, `tile:${breakTileId}`, {
            type: 'tile_started',
            tile_id: breakTileId,
            started_at: now,
          })
        )
        events.push(
          this.wrap(envelope, `tile:${breakTileId}`, {
            type: 'segment_started',
            segment_id: SegmentId.new(),
            tile_id: breakTileId,
            mode: 'break',
            started_at: now,
          })
        )
        return events
      }

      case 'end_break': {
        const endedAt = command.ended_at ?? envelope.issued_at
        const breakTileId =
          command.tile_id ??
          Array.from(state.tiles.values()).find(
            t => t.annotation.semanticRole === 'break' && t.core.startedAt !== null && t.core.completedAt === null
          )?.core.id ??
          null

        if (breakTileId) {
          const tile = state.tiles.get(breakTileId)
          if (tile && tile.annotation.semanticRole === 'break') {
            const openSegment = [...tile.work.segments].reverse().find(s => !s.endAt)
            if (openSegment) {
              events.push(
                this.wrap(envelope, `tile:${breakTileId}`, {
                  type: 'segment_ended',
                  segment_id: openSegment.id,
                  tile_id: breakTileId,
                  mode: openSegment.mode,
                  ended_at: endedAt,
                })
              )
            }
            events.push(
              this.wrap(envelope, `tile:${breakTileId}`, {
                type: 'tile_completed',
                tile_id: breakTileId,
                completed_at: endedAt,
              })
            )
          }
        }

        events.push(
          this.wrap(envelope, 'execution:singleton', {
            type: 'break_ended',
            ended_at: endedAt,
          })
        )
        return events
      }

      case 'extend_phase': {
        const tile = state.tiles.get(command.tile_id)
        const openSegment = tile ? [...tile.work.segments].reverse().find(s => !s.endAt) : null
        if (!openSegment) return events
        const expectedEndAt = new Date(envelope.issued_at.getTime() + command.delta_min * 60 * 1000)
        events.push(
          this.wrap(envelope, `tile:${command.tile_id}`, {
            type: 'segment_ended',
            segment_id: openSegment.id,
            tile_id: command.tile_id,
            mode: openSegment.mode,
            ended_at: envelope.issued_at,
          })
        )
        events.push(
          this.wrap(envelope, `tile:${command.tile_id}`, {
            type: 'segment_started',
            segment_id: SegmentId.new(),
            tile_id: command.tile_id,
            mode: openSegment.mode,
            started_at: envelope.issued_at,
            expected_end_at: expectedEndAt,
          })
        )
        return events
      }

      case 'clear_prompt': {
        events.push(
          this.wrap(envelope, 'execution:singleton', {
            type: 'prompt_cleared',
            prompt_id: command.prompt_id,
            cleared_at: envelope.issued_at,
            reason: command.reason,
          })
        )
        return events
      }

      case 'request_prompt': {
        if (state.execution.pendingPrompt) {
          return events
        }
        const prompt = inferPromptFromState(state, command.tile_id, command.requested_at)
        if (!prompt) return events
        events.push(
          this.wrap(envelope, 'execution:singleton', {
            type: 'prompt_scheduled',
            prompt_id: prompt.promptId,
            tile_id: prompt.tileId,
            scheduled_at: command.requested_at,
            reason: command.reason || prompt.reason,
            kind: prompt.kind,
            severity: prompt.severity,
            suggested_minutes: prompt.suggestedMinutes,
            reasons: prompt.reasons,
            actions: prompt.actions,
          })
        )
        return events
    }
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

function inferPromptFromState(
  state: AppState,
  requestedTileId: TileId | null,
  at: Date
): AppState['execution']['pendingPrompt'] {
  const tileId = requestedTileId ?? state.execution.activeTileId
  if (!tileId) return null
  const tile = state.tiles.get(tileId)
  if (!tile) return null

  const openSegment = [...tile.work.segments].reverse().find(seg => !seg.endAt)
  if (openSegment?.mode === 'break') {
    return {
      promptId: generatePromptId('manual-end-break', tileId),
      tileId,
      kind: 'end_break',
      severity: 'elevated',
      suggestedMinutes: null,
      reasons: ['user_requested'],
      actions: ['end_break', 'dismiss'],
      scheduledAt: at,
      reason: 'User requested',
    }
  }

  if (tile.core.startedAt && !tile.core.completedAt) {
    return {
      promptId: generatePromptId('manual-end-tile', tileId),
      tileId,
      kind: 'end_tile',
      severity: 'soft',
      suggestedMinutes: null,
      reasons: ['user_requested'],
      actions: ['complete_tile', 'extend_phase', 'defer_tile', 'dismiss'],
      scheduledAt: at,
      reason: 'User requested',
    }
  }

  return {
    promptId: generatePromptId('manual-start-tile', tileId),
    tileId,
    kind: 'start_tile',
    severity: 'soft',
    suggestedMinutes: tile.objective.targetWorkMin ?? 25,
    reasons: ['user_requested'],
    actions: ['start_tile', 'defer_tile', 'dismiss'],
    scheduledAt: at,
    reason: 'User requested',
  }
}

function generatePromptId(prefix: string, tileId: TileId | null): string {
  return `${prefix}:${tileId ?? 'none'}:${EventId.new()}`
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
    timeline: [...state.timeline],
    events: [...state.events],
  }
}
