/** @vitest-environment jsdom */

import { renderHook, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TileId } from '../domain/ids'
import { Actor } from '../domain/actor'
import type { Command } from '../core/command'
import type { ExecutionSnapshot } from '../domain/execution'
import { useDaemonExecution } from './use-daemon-execution'

const {
  readSnapshotMock,
  sendCommandMock,
  getUserMock,
  getBrowserAccessTokenMock,
  openExecutionStreamMock,
  streamCloseMock,
  wasmReadSnapshotMock,
  wasmExecuteMock,
  createWasmExecutionEngineMock,
} = vi.hoisted(() => ({
  readSnapshotMock: vi.fn<() => Promise<ExecutionSnapshot>>(),
  sendCommandMock: vi.fn(),
  getUserMock: vi.fn(),
  getBrowserAccessTokenMock: vi.fn(),
  openExecutionStreamMock: vi.fn(),
  streamCloseMock: vi.fn(),
  wasmReadSnapshotMock: vi.fn<() => Promise<ExecutionSnapshot>>(),
  wasmExecuteMock: vi.fn(),
  createWasmExecutionEngineMock: vi.fn(),
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: getUserMock,
    },
  }),
  getBrowserAccessToken: getBrowserAccessTokenMock,
}))

vi.mock('../daemon/client', () => ({
  DaemonClient: class {
    readSnapshot = readSnapshotMock
    sendCommand = sendCommandMock
  },
}))

vi.mock('../daemon/stream', () => ({
  openExecutionStream: openExecutionStreamMock,
}))

vi.mock('../wasm/core-engine', () => ({
  createWasmExecutionEngine: createWasmExecutionEngineMock,
}))

describe('useDaemonExecution', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  beforeEach(() => {
    readSnapshotMock.mockReset()
    sendCommandMock.mockReset()
    getUserMock.mockReset()
    getBrowserAccessTokenMock.mockReset()
    openExecutionStreamMock.mockReset()
    streamCloseMock.mockReset()
    wasmReadSnapshotMock.mockReset()
    wasmExecuteMock.mockReset()
    createWasmExecutionEngineMock.mockReset()
    process.env.NEXT_PUBLIC_DAEMON_BASE_URL = 'https://daemon.example'
    delete process.env.NEXT_PUBLIC_EXECUTION_BACKEND
    process.env.NEXT_PUBLIC_DAEMON_REFRESH_MS = '60000'

    getUserMock.mockResolvedValue({
      data: { user: { id: 'user-1' } },
    })
    getBrowserAccessTokenMock.mockResolvedValue('token-1')
    openExecutionStreamMock.mockReturnValue({ close: streamCloseMock })
    sendCommandMock.mockResolvedValue({
      accepted: true,
      commandId: 'cmd-1',
      requestId: 'req-1',
    })
    wasmReadSnapshotMock.mockResolvedValue(snapshot({ tiles: [], promptQueue: [], timeline: [] }))
    wasmExecuteMock.mockResolvedValue(undefined)
    createWasmExecutionEngineMock.mockResolvedValue({
      readSnapshot: wasmReadSnapshotMock,
      execute: wasmExecuteMock,
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
    expect(readSnapshotMock).not.toHaveBeenCalled()
    expect(openExecutionStreamMock).not.toHaveBeenCalled()
    expect(result.current.state.execution.activeTileId).toBe(TileId.fromString('tile-wasm'))

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
    expect(wasmExecuteMock).toHaveBeenCalledTimes(1)
    expect(wasmReadSnapshotMock).toHaveBeenCalledTimes(2)
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

    const { result, unmount } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))
    vi.useFakeTimers()
    try {
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
    getUserMock.mockResolvedValueOnce({
      data: { user: null },
    })
    readSnapshotMock.mockResolvedValueOnce(snapshot({ tiles: [], promptQueue: [], timeline: [] }))

    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(readSnapshotMock).not.toHaveBeenCalled()
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

  it('uses daemon backend by default when env is not set', async () => {
    delete process.env.NEXT_PUBLIC_DAEMON_BASE_URL
    delete process.env.NEXT_PUBLIC_EXECUTION_BACKEND
    readSnapshotMock.mockResolvedValueOnce(snapshot({ tiles: [], promptQueue: [], timeline: [] }))
    renderHook(() => useDaemonExecution())
    await waitFor(() => expect(readSnapshotMock.mock.calls.length).toBeGreaterThanOrEqual(1))
    expect(openExecutionStreamMock).toHaveBeenCalledTimes(1)
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
