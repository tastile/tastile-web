import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWasmExecutionEngine } from './core-engine'
import { EventId, TileId } from '../domain/ids'
import { Tile } from '../domain/tile'

const executeMock = vi.fn()
const executeWithAckMock = vi.fn()
const readSnapshotJsonMock = vi.fn()
const replaceEventLogJsonMock = vi.fn()
const configureSyncJsonMock = vi.fn()
const restoreSyncJsonMock = vi.fn()
const triggerSyncJsonMock = vi.fn()
const readSyncStatusJsonMock = vi.fn()

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
    configure_sync_json(configJson: string) {
      return configureSyncJsonMock(configJson)
    }
    restore_sync_json() {
      return restoreSyncJsonMock()
    }
    trigger_sync_json() {
      return triggerSyncJsonMock()
    }
    read_sync_status_json() {
      return readSyncStatusJsonMock()
    }
  },
}))

describe('core-engine wasm bridge', () => {
  beforeEach(() => {
    executeMock.mockReset()
    executeWithAckMock.mockReset()
    readSnapshotJsonMock.mockReset()
    replaceEventLogJsonMock.mockReset()
    configureSyncJsonMock.mockReset()
    restoreSyncJsonMock.mockReset()
    triggerSyncJsonMock.mockReset()
    readSyncStatusJsonMock.mockReset()
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

  it('maps Supabase tile data into wasm sync config shape', async () => {
    configureSyncJsonMock.mockReturnValue(JSON.stringify({ accepted: true, metadata: { configured: true } }))
    const tile = Tile.create(TileId.fromString('41612f8d-afb8-484e-9c67-99bc3c007de1'), 'Remote tile')
    tile.core.nextAction = 'Do first action'

    const engine = await createWasmExecutionEngine()
    await engine.configureSync({
      deviceId: 'web-device',
      connected: true,
      authenticated: true,
      remoteTiles: [tile],
    })

    expect(configureSyncJsonMock).toHaveBeenCalledTimes(1)
    expect(JSON.parse(configureSyncJsonMock.mock.calls[0][0])).toMatchObject({
      device_id: 'web-device',
      connected: true,
      authenticated: true,
      remote_tiles: [
        {
          core: {
            id: '41612f8d-afb8-484e-9c67-99bc3c007de1',
            next_action: 'Do first action',
          },
          annotation: {
            semantic_role: 'work',
          },
        },
      ],
    })
  })

  it('normalizes invalid Date values in sync payload instead of throwing', async () => {
    configureSyncJsonMock.mockReturnValue(JSON.stringify({ accepted: true, metadata: { configured: true } }))
    const tile = Tile.create(TileId.fromString('41612f8d-afb8-484e-9c67-99bc3c007de1'), 'Remote tile')
    tile.core.startedAt = new Date('invalid')

    const engine = await createWasmExecutionEngine()
    await engine.configureSync({
      deviceId: 'web-device',
      connected: true,
      authenticated: true,
      remoteTiles: [tile],
    })

    const payload = JSON.parse(configureSyncJsonMock.mock.calls[0][0])
    expect(payload.remote_tiles[0].core.started_at).toBeNull()
  })

  it('bridges wasm sync restore, trigger, and status JSON APIs', async () => {
    restoreSyncJsonMock.mockReturnValue(
      JSON.stringify({ accepted: true, metadata: { uploaded: 0, downloaded: 1, applied: 1, failed: 0, conflicts: 0 } })
    )
    triggerSyncJsonMock.mockReturnValue(
      JSON.stringify({ accepted: true, metadata: { uploaded: 1, downloaded: 1, applied: 1, failed: 0, conflicts: 0 } })
    )
    readSyncStatusJsonMock.mockReturnValue(
      JSON.stringify({
        in_progress: false,
        last_attempt_at: '2026-04-03T12:00:00.000Z',
        last_success_at: '2026-04-03T12:00:01.000Z',
        last_error: null,
        last_result: { uploaded: 1, downloaded: 1, applied: 1, failed: 0, conflicts: 0 },
      })
    )

    const engine = await createWasmExecutionEngine()
    const restore = await engine.restoreSync()
    const trigger = await engine.triggerSync()
    const status = await engine.readSyncStatus()

    expect(restore).toMatchObject({ accepted: true, metadata: { downloaded: 1, applied: 1 } })
    expect(trigger).toMatchObject({ accepted: true, metadata: { uploaded: 1, downloaded: 1 } })
    expect(status).toMatchObject({
      inProgress: false,
      lastAttemptAt: '2026-04-03T12:00:00.000Z',
      lastSuccessAt: '2026-04-03T12:00:01.000Z',
      lastResult: { uploaded: 1, downloaded: 1, applied: 1, failed: 0, conflicts: 0 },
    })
  })

  it('normalizes invalid sync status counters to zero', async () => {
    readSyncStatusJsonMock.mockReturnValue(
      JSON.stringify({
        in_progress: false,
        last_attempt_at: null,
        last_success_at: null,
        last_error: null,
        last_result: { uploaded: 'x', downloaded: null, applied: {}, failed: [], conflicts: 'y' },
      })
    )

    const engine = await createWasmExecutionEngine()
    const status = await engine.readSyncStatus()
    expect(status.lastResult).toEqual({
      uploaded: 0,
      downloaded: 0,
      applied: 0,
      failed: 0,
      conflicts: 0,
    })
  })

  it('normalizes sync status counters to non-negative integers', async () => {
    readSyncStatusJsonMock.mockReturnValue(
      JSON.stringify({
        in_progress: false,
        last_attempt_at: null,
        last_success_at: null,
        last_error: null,
        last_result: { uploaded: 3.9, downloaded: -2, applied: 1.2, failed: 0, conflicts: -1.8 },
      })
    )

    const engine = await createWasmExecutionEngine()
    const status = await engine.readSyncStatus()
    expect(status.lastResult).toEqual({
      uploaded: 3,
      downloaded: 0,
      applied: 1,
      failed: 0,
      conflicts: 0,
    })
  })

  it('normalizes sync command ack counters to optional non-negative integers', async () => {
    restoreSyncJsonMock.mockReturnValue(
      JSON.stringify({
        accepted: true,
        metadata: {
          uploaded: 3.8,
          downloaded: -1,
          applied: null,
          failed: 'x',
          conflicts: 2,
          error: 'noop',
        },
      })
    )

    const engine = await createWasmExecutionEngine()
    const ack = await engine.restoreSync()
    expect(ack).toEqual({
      accepted: true,
      metadata: {
        uploaded: 3,
        downloaded: 0,
        applied: undefined,
        failed: 0,
        conflicts: 2,
        error: 'noop',
      },
    })
  })

  it('normalizes invalid sync status timestamps to null', async () => {
    readSyncStatusJsonMock.mockReturnValue(
      JSON.stringify({
        in_progress: false,
        last_attempt_at: 'not-a-date',
        last_success_at: 'still-not-a-date',
        last_error: null,
        last_result: null,
      })
    )

    const engine = await createWasmExecutionEngine()
    const status = await engine.readSyncStatus()
    expect(status.lastAttemptAt).toBeNull()
    expect(status.lastSuccessAt).toBeNull()
  })
})
