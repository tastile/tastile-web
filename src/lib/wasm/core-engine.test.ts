import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWasmExecutionEngine } from './core-engine'
import { EventId, TileId } from '../domain/ids'

const executeMock = vi.fn()
const executeWithAckMock = vi.fn()
const readSnapshotJsonMock = vi.fn()
const replaceEventLogJsonMock = vi.fn()

vi.mock('@/wasm/tastile-core-wasm/pkg/tastile_core_wasm.js', () => ({
  default: vi.fn(async () => undefined),
  WasmCoreEngine: class {
    execute(commandJson: string) {
      executeMock(commandJson)
    }
    execute_with_ack_json(commandJson: string) {
      return executeWithAckMock(commandJson)
    }
    read_snapshot_json(nowIsoUtc: string | null) {
      return readSnapshotJsonMock(nowIsoUtc)
    }
    replace_event_log_json(eventsJson: string) {
      return replaceEventLogJsonMock(eventsJson)
    }
  },
}))

describe('core-engine wasm bridge', () => {
  beforeEach(() => {
    executeMock.mockReset()
    executeWithAckMock.mockReset()
    readSnapshotJsonMock.mockReset()
    replaceEventLogJsonMock.mockReset()
  })

  it('parses wasm snapshot JSON into Date fields', async () => {
    readSnapshotJsonMock.mockReturnValue(
      JSON.stringify({
        in_progress_tiles: [
          {
            tile_id: '41612f8d-afb8-484e-9c67-99bc3c007de1',
            title: 'WASM Tile',
            phase_kind: 'work',
            started_at: '2026-03-26T09:00:00.000Z',
          },
        ],
        prompt_queue: [
          {
            prompt_id: 'prompt-1',
            tile_id: '41612f8d-afb8-484e-9c67-99bc3c007de1',
            kind: 'start_tile',
            severity: 'soft',
            suggested_minutes: 25,
            reasons: ['resume_in_flight'],
            actions: ['start_tile', 'dismiss'],
            scheduled_at: '2026-03-26T09:01:00.000Z',
            reason: 'Resume now',
            status: 'pending',
          },
        ],
        timeline: [
          {
            id: 'segment-1',
            tile_id: '41612f8d-afb8-484e-9c67-99bc3c007de1',
            title: 'WASM Tile',
            type: 'work',
            status: 'active',
            start_at: '2026-03-26T09:00:00.000Z',
            end_at: null,
          },
        ],
      })
    )

    const engine = await createWasmExecutionEngine()
    const snapshot = await engine.readSnapshot()

    expect(snapshot.inProgressTiles[0].startedAt instanceof Date).toBe(true)
    expect(snapshot.promptQueue[0].scheduledAt instanceof Date).toBe(true)
    expect(snapshot.timeline[0].startAt instanceof Date).toBe(true)
  })

  it('forwards command and actor payload to wasm execute', async () => {
    const engine = await createWasmExecutionEngine()
    const command = {
      type: 'clear_prompt',
      prompt_id: 'prompt-2',
      reason: 'dismissed',
    } as const
    const actor = { type: 'human', id: 'self' } as const

    await engine.execute(command, actor)

    expect(executeMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(executeMock.mock.calls[0][0])).toEqual({
      command,
      actor,
    })
  })

  it('returns emitted events from wasm command ack payload', async () => {
    executeWithAckMock.mockReturnValue(
      JSON.stringify({
        accepted: true,
        eventIds: ['event-1'],
        metadata: {
          emittedEvents: [
            {
              eventId: 'event-1',
              aggregateId: 'tile:41612f8d-afb8-484e-9c67-99bc3c007de1',
              occurredAt: '2026-03-29T01:00:00.000Z',
              actor: { actorType: 'system', actorId: '00000000-0000-0000-0000-000000000001' },
              event: {
                type: 'tile_started',
                tile_id: TileId.fromString('41612f8d-afb8-484e-9c67-99bc3c007de1'),
                started_at: '2026-03-29T01:00:00.000Z',
              },
            },
          ],
        },
      })
    )

    const engine = await createWasmExecutionEngine()
    const ack = await engine.executeWithAck(
      {
        type: 'start_tile',
        tile_id: TileId.fromString('41612f8d-afb8-484e-9c67-99bc3c007de1'),
        started_at: new Date('2026-03-29T01:00:00.000Z'),
        source: 'manual',
      },
      { type: 'human', id: 'self' }
    )

    expect(ack.accepted).toBe(true)
    expect(ack.emittedEvents).toHaveLength(1)
    expect(ack.emittedEvents[0]).toMatchObject({
      event_id: 'event-1',
      aggregate_id: 'tile:41612f8d-afb8-484e-9c67-99bc3c007de1',
      event: {
        type: 'tile_started',
        tile_id: '41612f8d-afb8-484e-9c67-99bc3c007de1',
      },
    })
    expect(ack.emittedEvents[0].occurred_at.toISOString()).toBe('2026-03-29T01:00:00.000Z')
  })

  it('replaces the wasm event log from synchronized remote events', async () => {
    replaceEventLogJsonMock.mockReturnValue(
      JSON.stringify({
        accepted: true,
        metadata: { eventCount: 1, revision: 1 },
      })
    )

    const engine = await createWasmExecutionEngine()
    await engine.replaceEventLog([
      {
        event_id: EventId.fromString('event-1'),
        aggregate_id: 'tile:41612f8d-afb8-484e-9c67-99bc3c007de1',
        occurred_at: new Date('2026-03-29T01:00:00.000Z'),
        actor: { type: 'system', id: '00000000-0000-0000-0000-000000000001' },
        caused_by_command_id: null,
        request_id: null,
        event: {
          type: 'tile_started',
          tile_id: TileId.fromString('41612f8d-afb8-484e-9c67-99bc3c007de1'),
          started_at: new Date('2026-03-29T01:00:00.000Z'),
        },
      },
    ])

    expect(replaceEventLogJsonMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(replaceEventLogJsonMock.mock.calls[0][0])).toEqual([
      {
        event_id: 'event-1',
        aggregate_id: 'tile:41612f8d-afb8-484e-9c67-99bc3c007de1',
        occurred_at: '2026-03-29T01:00:00.000Z',
        actor: { type: 'system', id: '00000000-0000-0000-0000-000000000001' },
        caused_by_command_id: null,
        request_id: null,
        event: {
          type: 'tile_started',
          tile_id: '41612f8d-afb8-484e-9c67-99bc3c007de1',
          started_at: '2026-03-29T01:00:00.000Z',
        },
      },
    ])
  })
})
