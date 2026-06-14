/** @vitest-environment jsdom */

import { renderHook, waitFor, act } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TileId } from '../domain/ids'
import { Actor } from '../domain/actor'
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
  getSessionClientMock,
  getIdTokenClientMock,
  clearSessionCacheMock,
  openExecutionStreamMock,
  streamCloseMock,
  daemonReadSyncStatusMock,
} = vi.hoisted(() => ({
  readSnapshotMock: vi.fn<() => Promise<ExecutionSnapshot>>(),
  daemonReadTilesMock: vi.fn(),
  daemonReadExecutionViewMock: vi.fn(),
  daemonReadPendingPromptMock: vi.fn(),
  daemonReadTodayTimelineMock: vi.fn(),
  sendCommandMock: vi.fn(),
  restoreSessionMock: vi.fn(),
  getSessionClientMock: vi.fn(),
  getIdTokenClientMock: vi.fn(),
  clearSessionCacheMock: vi.fn(),
  openExecutionStreamMock: vi.fn(),
  streamCloseMock: vi.fn(),
  daemonReadSyncStatusMock: vi.fn(),
}))

vi.mock('@/lib/daemon/id-token-client', () => ({
  getSessionClient: getSessionClientMock,
  getIdTokenClient: getIdTokenClientMock,
  clearSessionCache: clearSessionCacheMock,
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

function snapshot(overrides: Partial<ExecutionSnapshot> = {}): ExecutionSnapshot {
  return {
    inProgressTiles: [],
    promptQueue: [],
    timeline: [],
    ...overrides,
  } as ExecutionSnapshot
}

describe('useDaemonExecution', () => {
  beforeEach(() => {
    readSnapshotMock.mockReset()
    daemonReadTilesMock.mockReset()
    daemonReadExecutionViewMock.mockReset()
    daemonReadPendingPromptMock.mockReset()
    daemonReadTodayTimelineMock.mockReset()
    sendCommandMock.mockReset()
    restoreSessionMock.mockReset()
    getSessionClientMock.mockReset()
    getIdTokenClientMock.mockReset()
    clearSessionCacheMock.mockReset()
    openExecutionStreamMock.mockReset()
    streamCloseMock.mockReset()
    daemonReadSyncStatusMock.mockReset()

    process.env.NEXT_PUBLIC_DAEMON_REFRESH_MS = '60000'

    getSessionClientMock.mockResolvedValue({
      idToken: 'id-token-1',
      refreshToken: 'refresh-token-1',
      sub: 'cognito-sub-1',
      exp: 1774706400,
    })
    getIdTokenClientMock.mockResolvedValue('id-token-1')
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
    readSnapshotMock.mockResolvedValue(snapshot())
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('hydrates from daemon snapshot and updates via stream events', async () => {
    const first = snapshot({
      inProgressTiles: [
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
    readSnapshotMock.mockResolvedValueOnce(first)

    const second = snapshot({
      inProgressTiles: [
        {
          tileId: TileId.fromString('tile-1'),
          title: 'Deep work',
          phaseKind: 'work',
          startedAt: new Date('2026-03-26T09:00:00.000Z'),
          phaseEndsAt: new Date('2026-03-26T09:25:00.000Z'),
        },
      ],
      promptQueue: [],
      timeline: [
        {
          id: 'line-1',
          tileId: TileId.fromString('tile-1'),
          title: 'Deep work',
          type: 'work',
          status: 'done',
          startAt: new Date('2026-03-26T09:00:00.000Z'),
          endAt: new Date('2026-03-26T09:25:00.000Z'),
        },
      ],
    })
    readSnapshotMock.mockResolvedValueOnce(second)

    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(result.current.state.execution.activeTileId).toEqual(TileId.fromString('tile-1'))
    expect(result.current.state.execution.pendingPrompt?.promptId).toBe('prompt-1')
    expect(openExecutionStreamMock).toHaveBeenCalledTimes(1)

    await act(async () => {
      const onEvent = openExecutionStreamMock.mock.calls[0][0].onEvent
      onEvent()
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    expect(readSnapshotMock).toHaveBeenCalledTimes(2)
    expect(result.current.state.execution.pendingPrompt).toBeNull()
  })

  it('sends command and refreshes snapshot', async () => {
    readSnapshotMock.mockResolvedValue(snapshot())
    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))

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

  it('shows loading state initially', async () => {
    readSnapshotMock.mockResolvedValue(snapshot())
    const { result } = renderHook(() => useDaemonExecution())
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.loading).toBe(false))
  })

  it('returns empty state when no session', async () => {
    getSessionClientMock.mockResolvedValue(null)
    readSnapshotMock.mockResolvedValue(snapshot())
    const { result } = renderHook(() => useDaemonExecution())
    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.state.tiles.size).toBe(0)
  })
})
