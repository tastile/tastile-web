/** @vitest-environment jsdom */

import { renderHook, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TileId } from '../domain/ids'
import { Actor } from '../domain/actor'
import { Tile } from '../domain/tile'
import type { Command } from '../core/command'
import type { ExecutionSnapshot } from '../domain/execution'
import { useDaemonExecution } from './use-daemon-execution'

const {
  readSnapshotMock,
  sendCommandMock,
  restoreSessionMock,
  getUserMock,
  getSessionMock,
  getBrowserAccessTokenMock,
  openExecutionStreamMock,
  streamCloseMock,
  wasmReadSnapshotMock,
  wasmExecuteMock,
  wasmExecuteWithAckMock,
  wasmReplaceEventLogMock,
  wasmReplaceTilesMock,
  wasmExportTilesMock,
  wasmConfigureSyncMock,
  wasmRestoreSyncMock,
  wasmTriggerSyncMock,
  wasmReadSyncStatusMock,
  createWasmExecutionEngineMock,
  loadAllTilesMock,
  replaceAllTilesMock,
  localStorageGetItemMock,
  localStorageSetItemMock,
  localStorageRemoveItemMock,
} = vi.hoisted(() => ({
  readSnapshotMock: vi.fn<() => Promise<ExecutionSnapshot>>(),
  sendCommandMock: vi.fn(),
  restoreSessionMock: vi.fn(),
  getUserMock: vi.fn(),
  getSessionMock: vi.fn(),
  getBrowserAccessTokenMock: vi.fn(),
  openExecutionStreamMock: vi.fn(),
  streamCloseMock: vi.fn(),
  wasmReadSnapshotMock: vi.fn<() => Promise<ExecutionSnapshot>>(),
  wasmExecuteMock: vi.fn(),
  wasmExecuteWithAckMock: vi.fn(),
  wasmReplaceEventLogMock: vi.fn(),
  wasmReplaceTilesMock: vi.fn(),
  wasmExportTilesMock: vi.fn(),
  wasmConfigureSyncMock: vi.fn(),
  wasmRestoreSyncMock: vi.fn(),
  wasmTriggerSyncMock: vi.fn(),
  wasmReadSyncStatusMock: vi.fn(),
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
    sendCommand = sendCommandMock
    restoreSession = restoreSessionMock
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
    sendCommandMock.mockReset()
    restoreSessionMock.mockReset()
    getUserMock.mockReset()
    getSessionMock.mockReset()
    getBrowserAccessTokenMock.mockReset()
    openExecutionStreamMock.mockReset()
    streamCloseMock.mockReset()
    wasmReadSnapshotMock.mockReset()
    wasmExecuteMock.mockReset()
    wasmExecuteWithAckMock.mockReset()
    wasmReplaceEventLogMock.mockReset()
    wasmReplaceTilesMock.mockReset()
    wasmExportTilesMock.mockReset()
    wasmConfigureSyncMock.mockReset()
    wasmRestoreSyncMock.mockReset()
    wasmTriggerSyncMock.mockReset()
    wasmReadSyncStatusMock.mockReset()
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
    openExecutionStreamMock.mockReturnValue({ close: streamCloseMock })
    sendCommandMock.mockResolvedValue({
      accepted: true,
      commandId: 'cmd-1',
      requestId: 'req-1',
    })
    wasmReadSnapshotMock.mockResolvedValue(snapshot({ tiles: [], promptQueue: [], timeline: [] }))
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
    expect(result.current.state.execution.activeTileId).toBe(TileId.fromString('tile-2'))
    expect(result.current.state.execution.pendingPrompt).toBeNull()
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
