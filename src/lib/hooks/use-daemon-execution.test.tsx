/** @vitest-environment jsdom */

import { renderHook, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SegmentId, TileId } from '../domain/ids'
import { Actor } from '../domain/actor'
import { Tile } from '../domain/tile'
import type { Command } from '../core/command'
import type { ExecutionSnapshot } from '../domain/execution'
import { useDaemonExecution } from './use-daemon-execution'

const {
  readSnapshotMock,
  daemonReadTilesMock,
  daemonReadExecutionViewMock,
  daemonReadPendingPromptMock,
  daemonReadTodayTimelineMock,
  sendCommandMock,
  restoreSessionMock,
  getUserMock,
  getSessionMock,
  getBrowserAccessTokenMock,
  openExecutionStreamMock,
  streamCloseMock,
  wasmReadSnapshotMock,
  wasmReadTilesMock,
  wasmReadExecutionViewMock,
  wasmReadPendingPromptMock,
  wasmReadTodayTimelineMock,
  wasmExecuteMock,
  wasmExecuteWithAckMock,
  wasmReplaceEventLogMock,
  wasmReplaceTilesMock,
  wasmExportTilesMock,
  wasmConfigureSyncMock,
  wasmRestoreSyncMock,
  wasmTriggerSyncMock,
  wasmReadSyncStatusMock,
  daemonReadSyncStatusMock,
  createWasmExecutionEngineMock,
  loadAllTilesMock,
  replaceAllTilesMock,
  localStorageGetItemMock,
  localStorageSetItemMock,
  localStorageRemoveItemMock,
} = vi.hoisted(() => ({
  readSnapshotMock: vi.fn<() => Promise<ExecutionSnapshot>>(),
  daemonReadTilesMock: vi.fn(),
  daemonReadExecutionViewMock: vi.fn(),
  daemonReadPendingPromptMock: vi.fn(),
  daemonReadTodayTimelineMock: vi.fn(),
  sendCommandMock: vi.fn(),
  restoreSessionMock: vi.fn(),
  getUserMock: vi.fn(),
  getSessionMock: vi.fn(),
  getBrowserAccessTokenMock: vi.fn(),
  openExecutionStreamMock: vi.fn(),
  streamCloseMock: vi.fn(),
  wasmReadSnapshotMock: vi.fn<() => Promise<ExecutionSnapshot>>(),
  wasmReadTilesMock: vi.fn(),
  wasmReadExecutionViewMock: vi.fn(),
  wasmReadPendingPromptMock: vi.fn(),
  wasmReadTodayTimelineMock: vi.fn(),
  wasmExecuteMock: vi.fn(),
  wasmExecuteWithAckMock: vi.fn(),
  wasmReplaceEventLogMock: vi.fn(),
  wasmReplaceTilesMock: vi.fn(),
  wasmExportTilesMock: vi.fn(),
  wasmConfigureSyncMock: vi.fn(),
  wasmRestoreSyncMock: vi.fn(),
  wasmTriggerSyncMock: vi.fn(),
  wasmReadSyncStatusMock: vi.fn(),
  daemonReadSyncStatusMock: vi.fn(),
  createWasmExecutionEngineMock: vi.fn(),
  loadAllTilesMock: vi.fn(),
  replaceAllTilesMock: vi.fn(),
  localStorageGetItemMock: vi.fn(),
  localStorageSetItemMock: vi.fn(),
  localStorageRemoveItemMock: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: getUserMock,
      getSession: getSessionMock,
    },
  }),
  getBrowserAccessToken: getBrowserAccessTokenMock,
}))

vi.mock('../daemon/client', () => ({
  DaemonClient: class {
    readSnapshot = readSnapshotMock
    readTiles = daemonReadTilesMock
    readExecutionView = daemonReadExecutionViewMock
    readPendingPrompt = daemonReadPendingPromptMock
    readTodayTimeline = daemonReadTodayTimelineMock
    sendCommand = sendCommandMock
    restoreSession = restoreSessionMock
    readSyncStatus = daemonReadSyncStatusMock
  },
}))

vi.mock('../daemon/stream', () => ({
  openExecutionStream: openExecutionStreamMock,
}))

vi.mock('../wasm/core-engine', () => ({
  createWasmExecutionEngine: createWasmExecutionEngineMock,
}))

vi.mock('../storage/event-store', () => ({
  EventStore: class {
    loadAllTiles = loadAllTilesMock
    replaceAllTiles = replaceAllTilesMock
  },
}))

describe('useDaemonExecution', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    readSnapshotMock.mockReset()
    daemonReadTilesMock.mockReset()
    daemonReadExecutionViewMock.mockReset()
    daemonReadPendingPromptMock.mockReset()
    daemonReadTodayTimelineMock.mockReset()
    sendCommandMock.mockReset()
    restoreSessionMock.mockReset()
    getUserMock.mockReset()
    getSessionMock.mockReset()
    getBrowserAccessTokenMock.mockReset()
    openExecutionStreamMock.mockReset()
    streamCloseMock.mockReset()
    wasmReadSnapshotMock.mockReset()
    wasmReadTilesMock.mockReset()
    wasmReadExecutionViewMock.mockReset()
    wasmReadPendingPromptMock.mockReset()
    wasmReadTodayTimelineMock.mockReset()
    wasmExecuteMock.mockReset()
    wasmExecuteWithAckMock.mockReset()
    wasmReplaceEventLogMock.mockReset()
    wasmReplaceTilesMock.mockReset()
    wasmExportTilesMock.mockReset()
    wasmConfigureSyncMock.mockReset()
    wasmRestoreSyncMock.mockReset()
    wasmTriggerSyncMock.mockReset()
    wasmReadSyncStatusMock.mockReset()
    daemonReadSyncStatusMock.mockReset()
    createWasmExecutionEngineMock.mockReset()
    loadAllTilesMock.mockReset()
    replaceAllTilesMock.mockReset()
    localStorageGetItemMock.mockReset()
    localStorageSetItemMock.mockReset()
    localStorageRemoveItemMock.mockReset()
    process.env.NEXT_PUBLIC_DAEMON_BASE_URL = 'https://daemon.example'
    delete process.env.NEXT_PUBLIC_EXECUTION_BACKEND
    process.env.NEXT_PUBLIC_DAEMON_REFRESH_MS = '60000'

    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
    getSessionMock.mockResolvedValue({
      data: {
        session: {
          access_token: 'token-1',
          refresh_token: 'refresh-token-1',
          expires_at: 1774706400,
          user: {
            id: 'user-1',
            email: 'user@example.com',
          },
        },
      },
    })
    getBrowserAccessTokenMock.mockResolvedValue('token-1')
    restoreSessionMock.mockResolvedValue(undefined)
    daemonReadSyncStatusMock.mockResolvedValue({
      inProgress: false,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastError: null,
      lastResult: null,
    })
    openExecutionStreamMock.mockReturnValue({ close: streamCloseMock })
    daemonReadTilesMock.mockResolvedValue({ tiles: [], nextActionableTileId: null, nextActionableStartAt: null })
    daemonReadExecutionViewMock.mockResolvedValue({
      tilesInProgress: [],
      mainTile: null,
      isWorking: false,
      isOnBreak: false,
      isIdle: true,
      mainTileStartedAt: null,
      mainTileEndsAt: null,
      pendingPromptId: null,
      tileCount: 0,
      eventCount: 0,
    })
    daemonReadPendingPromptMock.mockResolvedValue({ prompt: null })
    daemonReadTodayTimelineMock.mockResolvedValue({ items: [] })
    sendCommandMock.mockResolvedValue({
      accepted: true,
      commandId: 'cmd-1',
      requestId: 'req-1',
    })
    wasmReadSnapshotMock.mockResolvedValue(snapshot({ tiles: [], promptQueue: [], timeline: [] }))
    wasmReadTilesMock.mockResolvedValue({ tiles: [], nextActionableTileId: null, nextActionableStartAt: null })
    wasmReadExecutionViewMock.mockResolvedValue({
      tilesInProgress: [],
      mainTile: null,
      isWorking: false,
      isOnBreak: false,
      isIdle: true,
      mainTileStartedAt: null,
      mainTileEndsAt: null,
      pendingPromptId: null,
      tileCount: 0,
      eventCount: 0,
    })
    wasmReadPendingPromptMock.mockResolvedValue({ prompt: null })
    wasmReadTodayTimelineMock.mockResolvedValue({ items: [] })
    wasmExecuteMock.mockResolvedValue(undefined)
    wasmExecuteWithAckMock.mockResolvedValue({ accepted: true, emittedEvents: [] })
    wasmReplaceEventLogMock.mockResolvedValue(undefined)
    wasmReplaceTilesMock.mockResolvedValue(undefined)
    wasmExportTilesMock.mockResolvedValue([])
    wasmConfigureSyncMock.mockResolvedValue({ accepted: true, metadata: { configured: true } })
    wasmRestoreSyncMock.mockResolvedValue({ accepted: true, metadata: { downloaded: 0, applied: 0 } })
    wasmTriggerSyncMock.mockResolvedValue({ accepted: true, metadata: { uploaded: 0, downloaded: 0, applied: 0 } })
    wasmReadSyncStatusMock.mockResolvedValue({ inProgress: false, lastError: null, lastAttemptAt: null, lastSuccessAt: null, lastResult: null })
    loadAllTilesMock.mockResolvedValue([])
    replaceAllTilesMock.mockResolvedValue(undefined)
    createWasmExecutionEngineMock.mockResolvedValue({
      readSnapshot: wasmReadSnapshotMock,
      readTiles: wasmReadTilesMock,
      readExecutionView: wasmReadExecutionViewMock,
      readPendingPrompt: wasmReadPendingPromptMock,
      readTodayTimeline: wasmReadTodayTimelineMock,
      execute: wasmExecuteMock,
      executeWithAck: wasmExecuteWithAckMock,
      replaceEventLog: wasmReplaceEventLogMock,
      replaceTiles: wasmReplaceTilesMock,
      exportTiles: wasmExportTilesMock,
      configureSync: wasmConfigureSyncMock,
      restoreSync: wasmRestoreSyncMock,
      triggerSync: wasmTriggerSyncMock,
      readSyncStatus: wasmReadSyncStatusMock,
    })
    localStorageGetItemMock.mockReturnValue('persisted-web-device')
    vi.stubGlobal('localStorage', {
      getItem: localStorageGetItemMock,
      setItem: localStorageSetItemMock,
      removeItem: localStorageRemoveItemMock,
    })
  })

  it('uses wasm backend without daemon stream when execution backend is wasm', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'wasm'
    wasmReadSnapshotMock
      .mockResolvedValueOnce(
        snapshot({
          tiles: [
            {
              tileId: TileId.fromString('tile-wasm'),
              title: 'WASM Tile',
              phaseKind: 'work',
              startedAt: new Date('2026-03-26T08:00:00.000Z'),
              phaseEndsAt: new Date('2026-03-26T08:25:00.000Z'),
            },
          ],
          promptQueue: [],
          timeline: [],
        })
      )
      .mockResolvedValueOnce(
        snapshot({
          tiles: [],
          promptQueue: [],
          timeline: [],
        })
      )

    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(createWasmExecutionEngineMock).toHaveBeenCalledTimes(1)
    expect(loadAllTilesMock).toHaveBeenCalledTimes(1)
    expect(wasmReplaceTilesMock).not.toHaveBeenCalled()
    expect(readSnapshotMock).not.toHaveBeenCalled()
    expect(openExecutionStreamMock).not.toHaveBeenCalled()
    expect(result.current.state.execution.activeTileId).toEqual(TileId.fromString('tile-wasm'))

    await act(async () => {
      await result.current.execute(
        {
          type: 'clear_prompt',
          prompt_id: 'prompt-wasm',
          reason: 'dismissed',
        },
        Actor.human('self')
      )
    })
    expect(wasmExecuteWithAckMock).toHaveBeenCalledTimes(1)
    expect(wasmReadSnapshotMock).toHaveBeenCalledTimes(2)
  })

  it('hydrates active tile from wasm export and derives phase end when snapshot end is null', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'wasm'
    const tileId = TileId.fromString('41612f8d-afb8-484e-9c67-99bc3c007de1')
    const hydratedTile = Tile.create(tileId, 'Hydrated Tile')
    hydratedTile.objective.targetWorkMin = 45
    hydratedTile.core.startedAt = new Date('2026-03-26T08:00:00.000Z')
    hydratedTile.work.segments.push({
      id: SegmentId.fromString('seg-1'),
      startAt: new Date('2026-03-26T08:00:00.000Z'),
      endAt: null,
      expectedEndAt: new Date('2026-03-26T08:45:00.000Z'),
      mode: 'work',
      sourceTileId: tileId,
    })
    wasmReadSnapshotMock.mockResolvedValueOnce(
      snapshot({
        tiles: [
          {
            tileId,
            title: 'Hydrated Tile',
            phaseKind: 'work',
            startedAt: new Date('2026-03-26T08:00:00.000Z'),
            phaseEndsAt: null,
          },
        ],
        promptQueue: [],
        timeline: [
          {
            id: 'line-active',
            tileId,
            title: 'Hydrated Tile',
            type: 'work',
            status: 'active',
            startAt: new Date('2026-03-26T08:00:00.000Z'),
            endAt: null,
          },
        ],
      })
    )
    wasmExportTilesMock.mockResolvedValueOnce([hydratedTile])

    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.state.tiles.get(tileId)?.objective.targetWorkMin).toBe(45)
    expect(result.current.state.execution.phaseEndsAt?.toISOString()).toBe('2026-03-26T08:45:00.000Z')
  })

  it('replays Supabase events into wasm on startup and persists emitted events after commands', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'wasm'
    getSessionMock.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'token-1',
          refresh_token: 'refresh-token-1',
          expires_at: 1774706400,
          user: {
            id: 'user-1',
            email: 'user@example.com',
          },
        },
      },
    })
    loadAllTilesMock.mockResolvedValueOnce([])
    wasmExecuteWithAckMock.mockResolvedValueOnce({
      accepted: true,
      emittedEvents: [
        {
          event_id: 'local-event-1',
          aggregate_id: 'tile:tile-local',
          occurred_at: new Date('2026-03-29T02:00:00.000Z'),
          actor: { type: 'system', id: '00000000-0000-0000-0000-000000000001' },
          caused_by_command_id: null,
          request_id: null,
          event: {
            type: 'tile_started',
            tile_id: TileId.fromString('tile-local'),
            started_at: new Date('2026-03-29T02:00:00.000Z'),
          },
        },
      ],
    })
    wasmExportTilesMock.mockResolvedValueOnce([])

    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(wasmReplaceTilesMock).not.toHaveBeenCalled()
    expect(wasmConfigureSyncMock).toHaveBeenCalledWith({
      deviceId: 'persisted-web-device',
      connected: true,
      authenticated: true,
      remoteTiles: [],
    })
    expect(wasmRestoreSyncMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.execute(
        {
          type: 'start_tile',
          tile_id: TileId.fromString('tile-local'),
          started_at: new Date('2026-03-29T02:00:00.000Z'),
          source: 'manual',
        },
        Actor.human('self')
      )
    })

    expect(wasmExecuteWithAckMock).toHaveBeenCalledTimes(1)
    expect(wasmTriggerSyncMock).toHaveBeenCalledTimes(1)
    expect(replaceAllTilesMock).toHaveBeenCalledTimes(1)
  })

  it('continues with local tiles when wasm restore sync is rejected', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'wasm'
    const existing = [
      Tile.create(TileId.fromString('41612f8d-afb8-484e-9c67-99bc3c007de1'), 'Local fallback tile'),
    ]
    loadAllTilesMock.mockResolvedValueOnce(existing)
    wasmRestoreSyncMock.mockResolvedValueOnce({
      accepted: false,
      metadata: { error: 'sync unavailable' },
    })

    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(wasmReplaceTilesMock).toHaveBeenCalledWith(existing)
    expect(wasmReadSnapshotMock).toHaveBeenCalled()
  })

  it('does not mirror Supabase tiles after successful wasm restore', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'wasm'
    loadAllTilesMock.mockResolvedValueOnce([])

    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(wasmRestoreSyncMock).toHaveBeenCalledTimes(1)
    expect(wasmReplaceTilesMock).not.toHaveBeenCalled()
  })

  it('surfaces wasm sync status counters with remote downloaded value', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'wasm'
    loadAllTilesMock.mockResolvedValueOnce([])
    wasmReadSyncStatusMock.mockResolvedValueOnce({
      inProgress: false,
      lastError: null,
      lastAttemptAt: '2026-04-04T00:00:00.000Z',
      lastSuccessAt: '2026-04-04T00:00:01.000Z',
      lastResult: { uploaded: 1, downloaded: 2, applied: 2, failed: 0, conflicts: 0 },
    })

    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(wasmReadSyncStatusMock).toHaveBeenCalledTimes(1)
    expect((result.current.state.execution as { syncStatus?: { lastResult?: { downloaded?: number } | null } }).syncStatus?.lastResult?.downloaded).toBe(2)
  })

  it('updates sync status immediately after wasm trigger sync', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'wasm'
    loadAllTilesMock.mockResolvedValueOnce([])
    wasmExecuteWithAckMock.mockResolvedValueOnce({
      accepted: true,
      emittedEvents: [
        {
          event_id: 'local-event-1',
          aggregate_id: 'tile:tile-local',
          occurred_at: new Date('2026-03-29T02:00:00.000Z'),
          actor: { type: 'system', id: '00000000-0000-0000-0000-000000000001' },
          caused_by_command_id: null,
          request_id: null,
          event: {
            type: 'tile_started',
            tile_id: TileId.fromString('tile-local'),
            started_at: new Date('2026-03-29T02:00:00.000Z'),
          },
        },
      ],
    })
    wasmReadSyncStatusMock
      .mockResolvedValueOnce({
        inProgress: false,
        lastError: null,
        lastAttemptAt: null,
        lastSuccessAt: null,
        lastResult: { uploaded: 0, downloaded: 0, applied: 0, failed: 0, conflicts: 0 },
      })
      .mockResolvedValueOnce({
        inProgress: false,
        lastError: null,
        lastAttemptAt: '2026-04-04T00:00:00.000Z',
        lastSuccessAt: '2026-04-04T00:00:01.000Z',
        lastResult: { uploaded: 1, downloaded: 3, applied: 3, failed: 0, conflicts: 0 },
      })

    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await act(async () => {
      await result.current.execute(
        {
          type: 'start_tile',
          tile_id: TileId.fromString('tile-local'),
          started_at: new Date('2026-03-29T02:00:00.000Z'),
          source: 'manual',
        },
        Actor.human('self')
      )
    })

    expect(wasmReadSyncStatusMock).toHaveBeenCalledTimes(2)
    expect((result.current.state.execution as { syncStatus?: { lastResult?: { downloaded?: number } | null } }).syncStatus?.lastResult?.downloaded).toBe(3)
  })

  it('refreshes sync status even when wasm trigger sync is rejected', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'wasm'
    loadAllTilesMock.mockResolvedValueOnce([])
    wasmExecuteWithAckMock.mockResolvedValueOnce({
      accepted: true,
      emittedEvents: [
        {
          event_id: 'local-event-1',
          aggregate_id: 'tile:tile-local',
          occurred_at: new Date('2026-03-29T02:00:00.000Z'),
          actor: { type: 'system', id: '00000000-0000-0000-0000-000000000001' },
          caused_by_command_id: null,
          request_id: null,
          event: {
            type: 'tile_started',
            tile_id: TileId.fromString('tile-local'),
            started_at: new Date('2026-03-29T02:00:00.000Z'),
          },
        },
      ],
    })
    wasmTriggerSyncMock.mockResolvedValueOnce({
      accepted: false,
      metadata: { error: 'trigger rejected' },
    })
    wasmReadSyncStatusMock
      .mockResolvedValueOnce({
        inProgress: false,
        lastError: null,
        lastAttemptAt: null,
        lastSuccessAt: null,
        lastResult: null,
      })
      .mockResolvedValueOnce({
        inProgress: false,
        lastError: 'trigger rejected',
        lastAttemptAt: '2026-04-04T00:00:02.000Z',
        lastSuccessAt: null,
        lastResult: { uploaded: 1, downloaded: 0, applied: 0, failed: 1, conflicts: 0 },
      })

    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))

    await expect(
      act(async () => {
        await result.current.execute(
          {
            type: 'start_tile',
            tile_id: TileId.fromString('tile-local'),
            started_at: new Date('2026-03-29T02:00:00.000Z'),
            source: 'manual',
          },
          Actor.human('self')
        )
      })
    ).rejects.toThrow('trigger rejected')

    expect(wasmReadSyncStatusMock).toHaveBeenCalledTimes(2)
    expect(wasmReplaceTilesMock).toHaveBeenCalledTimes(1)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('hydrates from daemon snapshot and updates via stream events', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'daemon'
    const first = snapshot({
      tiles: [
            {
              tileId: TileId.fromString('tile-1'),
              title: 'Deep work',
              phaseKind: 'work',
              startedAt: new Date('2026-03-26T09:00:00.000Z'),
              phaseEndsAt: new Date('2026-03-26T09:25:00.000Z'),
            },
      ],
      promptQueue: [
        {
          promptId: 'prompt-1',
          tileId: TileId.fromString('tile-1'),
          kind: 'start_tile',
          severity: 'elevated',
          suggestedMinutes: 25,
          reasons: ['focus'],
          actions: ['start_tile', 'dismiss'],
          scheduledAt: new Date('2026-03-26T09:01:00.000Z'),
          reason: 'Start now',
          status: 'pending',
        },
      ],
      timeline: [
        {
          id: 'line-1',
          tileId: TileId.fromString('tile-1'),
          title: 'Deep work',
          type: 'work',
          status: 'active',
          startAt: new Date('2026-03-26T09:00:00.000Z'),
          endAt: new Date('2026-03-26T09:25:00.000Z'),
        },
      ],
    })
    const second = snapshot({
      tiles: [
            {
              tileId: TileId.fromString('tile-2'),
              title: 'Review PR',
              phaseKind: 'work',
              startedAt: new Date('2026-03-26T09:30:00.000Z'),
              phaseEndsAt: new Date('2026-03-26T09:55:00.000Z'),
            },
      ],
      promptQueue: [],
      timeline: [
        {
          id: 'line-2',
          tileId: TileId.fromString('tile-2'),
          title: 'Review PR',
          type: 'work',
          status: 'active',
          startAt: new Date('2026-03-26T09:30:00.000Z'),
          endAt: new Date('2026-03-26T09:55:00.000Z'),
        },
      ],
    })

    readSnapshotMock.mockResolvedValueOnce(first).mockResolvedValueOnce(second)

    const { result } = renderHook(() => useDaemonExecution())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(daemonReadSyncStatusMock).toHaveBeenCalledTimes(1)
    expect(restoreSessionMock).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'user@example.com',
      accessToken: 'token-1',
      refreshToken: 'refresh-token-1',
      expiresAt: '2026-03-28T14:00:00.000Z',
    })
    expect(result.current.state.tiles.size).toBe(1)
    expect(result.current.state.execution.activeTileId).toBe(TileId.fromString('tile-1'))
    expect(result.current.state.execution.pendingPrompt?.promptId).toBe('prompt-1')
    expect(result.current.state.events[0]?.aggregate_id).toBe('tile:tile-1')

    const onEvent = openExecutionStreamMock.mock.calls[0][0].onEvent as (event: { eventId: string }) => void
    await act(async () => {
      onEvent({ eventId: 'evt-1' })
    })

    await waitFor(() => expect(readSnapshotMock).toHaveBeenCalledTimes(2))
    expect(daemonReadSyncStatusMock).toHaveBeenCalledTimes(2)
    expect(result.current.state.execution.activeTileId).toBe(TileId.fromString('tile-2'))
    expect(result.current.state.execution.pendingPrompt).toBeNull()
  })

  it('normalizes daemon pending prompt action ids to web prompt actions', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'daemon'
    readSnapshotMock.mockResolvedValueOnce(snapshot({ tiles: [], promptQueue: [], timeline: [] }))
    daemonReadPendingPromptMock.mockResolvedValueOnce({
      prompt: {
        promptId: 'prompt-legacy',
        kind: 'start_tile',
        severity: 'soft',
        tileId: 'tile-legacy',
        title: 'Legacy prompt',
        body: 'Legacy body',
        why: 'Legacy why',
        suggestedMinutes: 20,
        reasons: ['legacy'],
        actions: [{ id: 'DEFER', label: 'Defer' }, { id: 'CONTINUE', label: 'Continue' }],
        createdAt: '2026-03-26T09:00:00.000Z',
        expiresAt: null,
        stale: false,
      },
    })

    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.state.execution.pendingPrompt?.actions).toEqual(['defer_tile', 'dismiss'])
  })

  it('builds timeline items from today timeline duration minutes when end is missing', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'daemon'
    readSnapshotMock.mockResolvedValueOnce(snapshot({ tiles: [], promptQueue: [], timeline: [] }))
    daemonReadTodayTimelineMock.mockResolvedValueOnce({
      items: [
        {
          kind: 'work',
          tileId: 'tile-a',
          semanticRole: 'work',
          title: 'Short task',
          startedAt: '2026-03-26T08:00:00.000Z',
          endedAt: null,
          durationMin: 30,
          isActive: false,
        },
        {
          kind: 'work',
          tileId: 'tile-b',
          semanticRole: 'work',
          title: 'Long task',
          startedAt: '2026-03-26T09:00:00.000Z',
          endedAt: null,
          durationMin: 120,
          isActive: false,
        },
      ],
    })

    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const short = result.current.state.timeline.find(item => item.title === 'Short task')
    const long = result.current.state.timeline.find(item => item.title === 'Long task')
    expect(short?.endAt).toBeTruthy()
    expect(long?.endAt).toBeTruthy()
    const shortMin = Math.round(((short!.endAt!.getTime()) - short!.startAt.getTime()) / 60000)
    const longMin = Math.round(((long!.endAt!.getTime()) - long!.startAt.getTime()) / 60000)
    expect(shortMin).toBe(30)
    expect(longMin).toBe(120)
  })

  it('keeps active timeline duration from duration minutes and ignores invalid tile ids safely', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'daemon'
    readSnapshotMock.mockResolvedValueOnce(snapshot({ tiles: [], promptQueue: [], timeline: [] }))
    daemonReadTodayTimelineMock.mockResolvedValueOnce({
      items: [
        {
          kind: 'work',
          tileId: 'not-a-valid-id',
          semanticRole: 'work',
          title: 'Active duration source',
          startedAt: '2026-03-26T09:00:00.000Z',
          endedAt: null,
          durationMin: 90,
          isActive: true,
        },
      ],
    })

    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const item = result.current.state.timeline.find(row => row.title === 'Active duration source')
    expect(item?.status).toBe('active')
    expect(item?.endAt).toBeTruthy()
    const durationMin = Math.round((item!.endAt!.getTime() - item!.startAt.getTime()) / 60000)
    expect(durationMin).toBe(90)
  })

  it('fills missing timeline duration from tile objective when daemon timeline omits duration', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'daemon'
    readSnapshotMock.mockResolvedValueOnce(snapshot({ tiles: [], promptQueue: [], timeline: [] }))
    daemonReadTilesMock.mockResolvedValueOnce({
      tiles: [
        {
          id: '41612f8d-afb8-484e-9c67-99bc3c007de1',
          title: 'Short objective tile',
          lifecycle: 'ready',
          nextAction: null,
          doneDefinition: null,
          workedMinutes: 0,
          breakMinutes: 0,
          semanticRole: 'work',
          labels: [],
          objectiveMode: null,
          targetWorkMin: 30,
          targetRestMin: 5,
          doneRule: null,
          resumeNote: null,
          projectedNextStartAt: null,
          temporal: null,
        },
        {
          id: '7f6f0a59-4d26-4f13-883b-a4f76f12bc21',
          title: 'Long objective tile',
          lifecycle: 'ready',
          nextAction: null,
          doneDefinition: null,
          workedMinutes: 0,
          breakMinutes: 0,
          semanticRole: 'work',
          labels: [],
          objectiveMode: null,
          targetWorkMin: 120,
          targetRestMin: 5,
          doneRule: null,
          resumeNote: null,
          projectedNextStartAt: null,
          temporal: null,
        },
      ],
      nextActionableTileId: null,
      nextActionableStartAt: null,
    })
    daemonReadTodayTimelineMock.mockResolvedValueOnce({
      items: [
        {
          kind: 'work',
          tileId: '41612f8d-afb8-484e-9c67-99bc3c007de1',
          semanticRole: 'work',
          title: 'Short objective tile',
          startedAt: '2026-03-26T08:00:00.000Z',
          endedAt: null,
          durationMin: 0,
          isActive: false,
        },
        {
          kind: 'work',
          tileId: '7f6f0a59-4d26-4f13-883b-a4f76f12bc21',
          semanticRole: 'work',
          title: 'Long objective tile',
          startedAt: '2026-03-26T09:00:00.000Z',
          endedAt: null,
          durationMin: 0,
          isActive: false,
        },
      ],
    })

    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const short = result.current.state.timeline.find(item => item.title === 'Short objective tile')
    const long = result.current.state.timeline.find(item => item.title === 'Long objective tile')
    expect(short?.durationMin).toBe(30)
    expect(long?.durationMin).toBe(120)
  })

  it('keeps daemon flow working when sync status read fails', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'daemon'
    daemonReadSyncStatusMock.mockRejectedValueOnce(new Error('sync status unavailable'))
    readSnapshotMock.mockResolvedValueOnce(
      snapshot({
        tiles: [],
        promptQueue: [],
        timeline: [],
      })
    )
    sendCommandMock.mockResolvedValueOnce({
      accepted: true,
      commandId: 'cmd-1',
      requestId: 'req-1',
    })
    readSnapshotMock.mockResolvedValueOnce(
      snapshot({
        tiles: [],
        promptQueue: [],
        timeline: [],
      })
    )

    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(readSnapshotMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.execute(
        {
          type: 'clear_prompt',
          prompt_id: 'prompt-1',
          reason: 'dismissed',
        },
        Actor.human('self')
      )
    })

    expect(sendCommandMock).toHaveBeenCalledTimes(1)
    expect(readSnapshotMock).toHaveBeenCalledTimes(2)
  })

  it('restores daemon session and retries command after unauthorized response', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'daemon'
    readSnapshotMock.mockResolvedValue(
      snapshot({
        tiles: [],
        promptQueue: [],
        timeline: [],
      })
    )
    sendCommandMock
      .mockRejectedValueOnce(new Error('Failed to send daemon command: 401 unauthorized'))
      .mockResolvedValueOnce({
        accepted: true,
        commandId: 'cmd-2',
        requestId: 'req-2',
      })

    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(restoreSessionMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.execute(
        {
          type: 'clear_prompt',
          prompt_id: 'prompt-reauth',
          reason: 'dismissed',
        },
        Actor.human('self')
      )
    })

    expect(sendCommandMock).toHaveBeenCalledTimes(2)
    expect(restoreSessionMock).toHaveBeenCalledTimes(2)
  })

  it('keeps daemon init working when session expires_at is an invalid string', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'daemon'
    getSessionMock.mockResolvedValueOnce({
      data: {
        session: {
          access_token: 'token-1',
          refresh_token: 'refresh-token-1',
          expires_at: 'invalid-date-value',
          user: {
            id: 'user-1',
            email: 'user@example.com',
          },
        },
      },
    })
    readSnapshotMock.mockResolvedValueOnce(
      snapshot({
        tiles: [],
        promptQueue: [],
        timeline: [],
      })
    )

    const { result } = renderHook(() => useDaemonExecution())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(restoreSessionMock).toHaveBeenCalledWith({
      userId: 'user-1',
      email: 'user@example.com',
      accessToken: 'token-1',
      refreshToken: 'refresh-token-1',
      expiresAt: null,
    })
    expect(readSnapshotMock).toHaveBeenCalledTimes(1)
  })

  it('refreshes daemon snapshot periodically even without stream events', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'daemon'
    process.env.NEXT_PUBLIC_DAEMON_REFRESH_MS = '25'
    readSnapshotMock
      .mockResolvedValueOnce(
        snapshot({
          tiles: [
            {
              tileId: TileId.fromString('tile-periodic-1'),
              title: 'Before sync',
              phaseKind: 'work',
              startedAt: new Date('2026-03-26T09:00:00.000Z'),
              phaseEndsAt: new Date('2026-03-26T09:25:00.000Z'),
            },
          ],
          promptQueue: [],
          timeline: [],
        })
      )
      .mockResolvedValue(
        snapshot({
          tiles: [
            {
              tileId: TileId.fromString('tile-periodic-2'),
              title: 'After sync',
              phaseKind: 'work',
              startedAt: new Date('2026-03-26T10:00:00.000Z'),
              phaseEndsAt: new Date('2026-03-26T10:25:00.000Z'),
            },
          ],
          promptQueue: [],
          timeline: [],
        })
      )

    vi.useFakeTimers()
    try {
      const { result, unmount } = renderHook(() => useDaemonExecution())
      await act(async () => {
        await Promise.resolve()
        await Promise.resolve()
      })
      expect(result.current.loading).toBe(false)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(25)
      })
      expect(readSnapshotMock.mock.calls.length).toBeGreaterThanOrEqual(2)
      expect(result.current.state.execution.activeTileId).toBe(TileId.fromString('tile-periodic-2'))
      unmount()
    } finally {
      vi.useRealTimers()
    }
  })

  it('handles unauthenticated user by stopping loading without stream setup', async () => {
    getSessionMock.mockResolvedValueOnce({
      data: { session: null },
    })
    getUserMock.mockResolvedValueOnce({
      data: { user: null },
    })
    readSnapshotMock.mockResolvedValueOnce(snapshot({ tiles: [], promptQueue: [], timeline: [] }))

    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(readSnapshotMock).not.toHaveBeenCalled()
    expect(restoreSessionMock).not.toHaveBeenCalled()
    expect(openExecutionStreamMock).not.toHaveBeenCalled()
    expect(result.current.state.tiles.size).toBe(0)
  })

  it('closes stream on unmount', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'daemon'
    readSnapshotMock.mockResolvedValueOnce(snapshot({ tiles: [], promptQueue: [], timeline: [] }))
    const { result, unmount } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))
    unmount()
    expect(streamCloseMock).toHaveBeenCalledTimes(1)
  })

  it('ignores stale refresh results when newer refresh resolves first', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'daemon'
    const initial = snapshot({ tiles: [], promptQueue: [], timeline: [] })
    const a = deferred<ExecutionSnapshot>()
    const b = deferred<ExecutionSnapshot>()
    readSnapshotMock
      .mockResolvedValueOnce(initial)
      .mockReturnValueOnce(a.promise)
      .mockReturnValueOnce(b.promise)

    const { result } = renderHook(() => useDaemonExecution())

    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(openExecutionStreamMock).toHaveBeenCalledTimes(1))
    const onEvent = openExecutionStreamMock.mock.calls[0][0].onEvent as () => void
    await act(async () => {
      onEvent()
      onEvent()
    })

    b.resolve(
      snapshot({
        tiles: [
            {
              tileId: TileId.fromString('tile-new'),
              title: 'New',
              phaseKind: 'work',
              startedAt: new Date('2026-03-26T11:00:00.000Z'),
              phaseEndsAt: new Date('2026-03-26T11:25:00.000Z'),
            },
        ],
        promptQueue: [],
        timeline: [],
      })
    )
    await act(async () => {
      await Promise.resolve()
    })

    a.resolve(
      snapshot({
        tiles: [
            {
              tileId: TileId.fromString('tile-old'),
              title: 'Old',
              phaseKind: 'work',
              startedAt: new Date('2026-03-26T10:00:00.000Z'),
              phaseEndsAt: new Date('2026-03-26T10:25:00.000Z'),
            },
        ],
        promptQueue: [],
        timeline: [],
      })
    )

    await waitFor(() => expect(result.current.state.tiles.has(TileId.fromString('tile-new'))).toBe(true))
    expect(result.current.state.tiles.has(TileId.fromString('tile-old'))).toBe(false)
  })

  it('executes with wasm backend even when unauthenticated', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'wasm'
    getSessionMock.mockResolvedValueOnce({ data: { session: null } })
    getUserMock.mockResolvedValueOnce({ data: { user: null } })
    wasmReadSnapshotMock.mockResolvedValueOnce(snapshot({ tiles: [], promptQueue: [], timeline: [] }))
    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))
    await act(async () => {
      await result.current.execute(
        {
          type: 'clear_prompt',
          prompt_id: 'prompt-early',
          reason: 'dismissed',
        },
        Actor.human('self')
      )
    })
    expect(wasmExecuteMock).toHaveBeenCalledTimes(1)
  })

  it('uses wasm backend by default when env is not set', async () => {
    delete process.env.NEXT_PUBLIC_EXECUTION_BACKEND
    process.env.NEXT_PUBLIC_DAEMON_BASE_URL = 'https://daemon.example'
    wasmReadSnapshotMock.mockResolvedValueOnce(snapshot({ tiles: [], promptQueue: [], timeline: [] }))
    renderHook(() => useDaemonExecution())
    await waitFor(() => expect(wasmReadSnapshotMock.mock.calls.length).toBeGreaterThanOrEqual(1))
    expect(createWasmExecutionEngineMock).toHaveBeenCalledTimes(1)
    expect(openExecutionStreamMock).not.toHaveBeenCalled()
    expect(readSnapshotMock).not.toHaveBeenCalled()
  })

  it('stops loading with a safe fallback when daemon snapshot read fails', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'daemon'
    readSnapshotMock.mockRejectedValueOnce(new Error('network failure'))

    const { result } = renderHook(() => useDaemonExecution())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.state.tiles.size).toBe(0)
    expect(openExecutionStreamMock).not.toHaveBeenCalled()
  })

  it('stops loading with a safe fallback when wasm engine creation fails', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'wasm'
    createWasmExecutionEngineMock.mockRejectedValueOnce(new Error('wasm boot failed'))

    const { result } = renderHook(() => useDaemonExecution())

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.state.tiles.size).toBe(0)
    expect(wasmReadSnapshotMock).not.toHaveBeenCalled()
  })

  it('sends command to daemon then refreshes snapshot', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'daemon'
    readSnapshotMock
      .mockResolvedValueOnce(
        snapshot({
          tiles: [],
          promptQueue: [],
          timeline: [],
        })
      )
      .mockResolvedValueOnce(
        snapshot({
          tiles: [
            {
              tileId: TileId.fromString('tile-3'),
              title: 'Write docs',
              phaseKind: 'work',
              startedAt: new Date('2026-03-26T10:00:00.000Z'),
              phaseEndsAt: new Date('2026-03-26T10:25:00.000Z'),
            },
          ],
          promptQueue: [],
          timeline: [],
        })
      )

    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))

    const command: Command = {
      type: 'start_tile',
      tile_id: TileId.fromString('tile-3'),
      started_at: new Date('2026-03-26T10:00:00.000Z'),
      source: 'manual',
    }

    await act(async () => {
      await result.current.execute(command, Actor.human('self'))
    })

    expect(sendCommandMock).toHaveBeenCalledWith({
      type: 'start_tile',
      tileId: TileId.fromString('tile-3'),
      startedAt: new Date('2026-03-26T10:00:00.000Z'),
      source: 'manual',
    })
    expect(readSnapshotMock).toHaveBeenCalledTimes(2)
    expect(result.current.state.tiles.has(TileId.fromString('tile-3'))).toBe(true)
    expect(result.current.state.execution.phaseEndsAt?.toISOString()).toBe('2026-03-26T10:25:00.000Z')
  })

  it('does not use synthetic break tile ids as active tile id', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'daemon'
    readSnapshotMock.mockResolvedValueOnce(
      snapshot({
        tiles: [],
        promptQueue: [],
        timeline: [
          {
            id: 'scheduled-break-1',
            tileId: TileId.fromString('synthetic:break:1774521250:4:1774535950'),
            title: 'Break (5min)',
            type: 'break',
            status: 'active',
            startAt: new Date('2026-03-26T10:00:00.000Z'),
            endAt: new Date('2026-03-26T10:05:00.000Z'),
          },
        ],
      })
    )
    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.state.execution.activeTileId).toBeNull()
  })

  it('prefers active timeline tile when it disagrees with inProgressTiles order', async () => {
    process.env.NEXT_PUBLIC_EXECUTION_BACKEND = 'daemon'
    readSnapshotMock.mockResolvedValueOnce(
      snapshot({
        tiles: [
          {
            tileId: TileId.fromString('tile-stale'),
            title: 'Stale in progress',
            phaseKind: 'work',
            startedAt: new Date('2026-03-26T09:00:00.000Z'),
            phaseEndsAt: new Date('2026-03-26T09:25:00.000Z'),
          },
          {
            tileId: TileId.fromString('tile-active'),
            title: 'Actually active',
            phaseKind: 'work',
            startedAt: new Date('2026-03-26T09:30:00.000Z'),
            phaseEndsAt: new Date('2026-03-26T09:55:00.000Z'),
          },
        ],
        promptQueue: [],
        timeline: [
          {
            id: 'line-active',
            tileId: TileId.fromString('tile-active'),
            title: 'Actually active',
            type: 'work',
            status: 'active',
            startAt: new Date('2026-03-26T09:30:00.000Z'),
            endAt: new Date('2026-03-26T09:55:00.000Z'),
          },
        ],
      })
    )
    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.state.execution.activeTileId).toBe(TileId.fromString('tile-active'))
  })
})

function snapshot(input: {
  tiles: ExecutionSnapshot['inProgressTiles']
  promptQueue: ExecutionSnapshot['promptQueue']
  timeline: ExecutionSnapshot['timeline']
}): ExecutionSnapshot {
  return {
    inProgressTiles: input.tiles,
    promptQueue: input.promptQueue,
    timeline: input.timeline,
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
