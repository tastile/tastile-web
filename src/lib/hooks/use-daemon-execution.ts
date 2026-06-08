'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from '../core/state'
import { Command, DaemonCommandRequest } from '../core/command'
import type { EventEnvelope } from '../core/event'
import { DaemonClient } from '../daemon/client'
import { openExecutionStream } from '../daemon/stream'
import { Actor } from '../domain/actor'
import { ExecutionSnapshot, ExecutionSyncStatus, PromptAction, PromptQueueItemSnapshot, TimelineItemSnapshot } from '../domain/execution'
import { EventId, TileId } from '../domain/ids'
import { Tile } from '../domain/tile'
import { createClient } from '@/lib/supabase/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  clearSessionCache,
  getIdTokenClient,
  getSessionClient,
} from '@/lib/daemon/id-token-client'
import { createWasmExecutionEngine, WasmExecutionEngine } from '../wasm/core-engine'
import { EventStore } from '../storage/event-store'
import type {
  DaemonExecutionViewResponse,
  DaemonPendingPromptResponse,
  DaemonTimelineTodayResponse,
  DaemonTilesResponse,
} from '../daemon/client'

const DEFAULT_DAEMON_BASE_URL = 'http://127.0.0.1:3140'
const DEFAULT_EXECUTION_BACKEND = 'wasm'
const DEFAULT_DAEMON_REFRESH_MS = 5_000
const WASM_TILES_STORAGE_KEY = 'tastile:wasm-tiles:v1'
const WASM_DEVICE_ID_STORAGE_KEY = 'tastile:wasm-device-id:v1'
let runtimeWasmDeviceId: string | null = null

async function readDaemonSyncStatusSafely(client: DaemonClient): Promise<ExecutionSyncStatus | null> {
  try {
    return await client.readSyncStatus()
  } catch (err) {
    console.warn('Failed to read daemon sync status', err)
    return null
  }
}

export function useDaemonExecution() {
  const [state, setState] = useState<AppState>(AppState.initial())
  const [loading, setLoading] = useState(true)
  const [supabase] = useState<SupabaseClient | null>(() => {
    // Supabase is only used by the optional WASM offline backend. The
    // dashboard's primary path is the daemon (Cognito bearer), which does
    // not require Supabase. If Supabase env is not configured, the WASM
    // branch is disabled and the daemon path is used.
    try {
      return createClient()
    } catch (err) {
      console.warn('Supabase client not available; WASM offline mode disabled.', err)
      return null
    }
  })
  const clientRef = useRef<DaemonClient | null>(null)
  const wasmRef = useRef<WasmExecutionEngine | null>(null)
  const eventStoreRef = useRef<EventStore | null>(null)
  const syncStatusRef = useRef<ExecutionSyncStatus | null>(null)
  const mountedRef = useRef(true)
  const refreshRequestRef = useRef(0)
  const appliedRefreshRef = useRef(0)
  const baseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_DAEMON_BASE_URL ?? DEFAULT_DAEMON_BASE_URL,
    []
  )
  const backend = useMemo(
    () => process.env.NEXT_PUBLIC_EXECUTION_BACKEND ?? DEFAULT_EXECUTION_BACKEND,
    []
  )
  const daemonRefreshMs = useMemo(() => {
    const raw = process.env.NEXT_PUBLIC_DAEMON_REFRESH_MS
    if (!raw) return DEFAULT_DAEMON_REFRESH_MS
    const parsed = Number(raw)
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_DAEMON_REFRESH_MS
    return parsed
  }, [])
  const e2eBypassAuth = useMemo(
    () => process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === '1',
    []
  )

  const restoreDaemonSession = useCallback(async (): Promise<boolean> => {
    const client = clientRef.current
    if (!client) return false
    // Force-refresh so we never replay a stale id_token that the daemon will
    // reject on the next call.
    const session = await getSessionClient(true)
    if (!session) return false
    await client.restoreSession({
      userId: session.sub,
      email: '',
      accessToken: session.idToken,
      refreshToken: session.refreshToken,
      expiresAt: new Date(session.exp * 1000).toISOString(),
    })
    return true
  }, [])

  const refreshSnapshot = useCallback(async () => {
    const client = clientRef.current
    const wasm = wasmRef.current
    if (!client && !wasm) return
    const requestId = ++refreshRequestRef.current
    const daemonClient = client!
    const readClientSnapshot = () => Promise.all([
      daemonClient.readSnapshot(),
      Promise.resolve(null as Tile[] | null),
      safeRead(() => daemonClient.readTiles(), null as DaemonTilesResponse | null),
      safeRead(() => daemonClient.readExecutionView(), null as DaemonExecutionViewResponse | null),
      safeRead(() => daemonClient.readPendingPrompt(), null as DaemonPendingPromptResponse | null),
      safeRead(() => daemonClient.readTodayTimeline(), null as DaemonTimelineTodayResponse | null),
    ])
    const readWasmSnapshot = () => Promise.all([
      wasm!.readSnapshot(),
      wasm!.exportTiles().catch(() => null as Tile[] | null),
      safeRead(() => wasm!.readTiles(), null as DaemonTilesResponse | null),
      safeRead(() => wasm!.readExecutionView(), null as DaemonExecutionViewResponse | null),
      safeRead(() => wasm!.readPendingPrompt(), null as DaemonPendingPromptResponse | null),
      safeRead(() => wasm!.readTodayTimeline(), null as DaemonTimelineTodayResponse | null),
    ])
    const [snapshot, exportedTiles, tilesView, executionView, pendingPromptView, todayTimeline] = client
      ? await runWithDaemonReauthRetry(readClientSnapshot, restoreDaemonSession)
      : await readWasmSnapshot()
    if (!mountedRef.current) return
    if (requestId < appliedRefreshRef.current) return
    appliedRefreshRef.current = requestId
    setState(
      projectSnapshotToAppState(
        snapshot,
        syncStatusRef.current,
        exportedTiles,
        tilesView,
        executionView,
        pendingPromptView,
        todayTimeline
      )
    )
  }, [restoreDaemonSession])

  useEffect(() => {
    let active = true
    let closeStream: (() => void) | null = null
    let refreshTimer: ReturnType<typeof setInterval> | null = null
    mountedRef.current = true

    async function init() {
      try {
        if (backend === 'wasm' && !supabase) {
          console.warn('NEXT_PUBLIC_EXECUTION_BACKEND=wasm requested but Supabase env is not configured; falling back to daemon backend.')
        }
        if (backend === 'wasm' && supabase) {
          const wasm = await createWasmExecutionEngine()
          wasmRef.current = wasm
          const {
            data: { session },
          } = await supabase.auth.getSession()
          if (session?.user) {
            const eventStore = new EventStore(supabase, session.user.id)
            eventStoreRef.current = eventStore
            const tiles = await eventStore.loadAllTiles()
            const deviceId = getOrCreateWasmDeviceId()
            let shouldMirrorSupabaseTiles = false
            await wasm.configureSync({
              deviceId,
              connected: true,
              authenticated: true,
              remoteTiles: tiles,
            })
            const restoreAck = await wasm.restoreSync()
            const syncStatus = await wasm.readSyncStatus()
            syncStatusRef.current = syncStatus
            if (!restoreAck.accepted) {
              console.warn('WASM restore sync was rejected, falling back to local tiles', restoreAck.metadata.error)
              await wasm.replaceTiles(tiles)
              shouldMirrorSupabaseTiles = true
            }
            refreshTimer = setInterval(() => {
              void (async () => {
                try {
                  if (shouldMirrorSupabaseTiles) {
                    const latest = await eventStore.loadAllTiles()
                    await wasm.replaceTiles(latest)
                  }
                  const latestSyncStatus = await wasm.readSyncStatus()
                  syncStatusRef.current = latestSyncStatus
                  await refreshSnapshot()
                } catch (err) {
                  console.error('Failed to refresh wasm tiles from Supabase:', err)
                }
              })()
            }, daemonRefreshMs)
          } else {
            await replayPersistedWasmTiles(wasm)
          }
          await refreshSnapshot()
          return
        }

        const session = await getSessionClient()
        if (!active || (!session && !e2eBypassAuth)) {
          if (active) setLoading(false)
          return
        }

        const getAccessToken = e2eBypassAuth
          ? undefined
          : async () => {
              // Cache eviction on null: the next call will re-fetch from
              // /api/auth/session instead of replaying a stale id_token.
              const token = await getIdTokenClient()
              if (!token) clearSessionCache()
              return token
            }
        clientRef.current = new DaemonClient({
          baseUrl,
          getAccessToken,
        })
        if (session) {
          await clientRef.current.restoreSession({
            userId: session.sub,
            email: '',
            accessToken: session.idToken,
            refreshToken: session.refreshToken,
            expiresAt: new Date(session.exp * 1000).toISOString(),
          })
        }
        const daemonSyncStatus = await readDaemonSyncStatusSafely(clientRef.current)
        if (daemonSyncStatus) {
          syncStatusRef.current = daemonSyncStatus
        }

        await refreshSnapshot()
        if (!active) return

        const stream = openExecutionStream({
          baseUrl,
          getAccessToken,
          onEvent: () => {
            void (async () => {
              try {
                const daemonClient = clientRef.current
                if (daemonClient) {
                  const daemonSyncStatus = await readDaemonSyncStatusSafely(daemonClient)
                  if (daemonSyncStatus) {
                    syncStatusRef.current = daemonSyncStatus
                  }
                }
                await refreshSnapshot()
              } catch (err) {
                console.error('Failed to refresh daemon snapshot from stream event:', err)
              }
            })()
          },
        })
        closeStream = stream.close
        refreshTimer = setInterval(() => {
          void (async () => {
            try {
              const daemonClient = clientRef.current
              if (daemonClient) {
                const daemonSyncStatus = await readDaemonSyncStatusSafely(daemonClient)
                if (daemonSyncStatus) {
                  syncStatusRef.current = daemonSyncStatus
                }
              }
              await refreshSnapshot()
            } catch (err) {
              console.error('Failed to refresh daemon snapshot from periodic poll:', err)
            }
          })()
        }, daemonRefreshMs)
      } catch (err) {
        console.error(`Failed to initialize daemon execution (baseUrl=${baseUrl}):`, err)
      } finally {
        if (active) setLoading(false)
      }
    }

    void init()

    return () => {
      active = false
      mountedRef.current = false
      closeStream?.()
      if (refreshTimer) clearInterval(refreshTimer)
    }
  }, [backend, baseUrl, daemonRefreshMs, e2eBypassAuth, refreshSnapshot, supabase])

  const execute = useCallback(async (command: Command, actor: Actor) => {
    const client = clientRef.current
    const wasm = wasmRef.current
    if (!client && !wasm) {
      throw new Error('Daemon client not initialized. Are you authenticated?')
    }
    if (client) {
      await runWithDaemonReauthRetry(
        () => client.sendCommand(toDaemonCommand(command)),
        restoreDaemonSession
      )
      const daemonSyncStatus = await readDaemonSyncStatusSafely(client)
      if (daemonSyncStatus) {
        syncStatusRef.current = daemonSyncStatus
      }
    } else {
      const eventStore = eventStoreRef.current
      if (eventStore) {
        const ack = await wasm!.executeWithAck(command, actor)
        if (!ack.accepted) {
          throw new Error(ack.error?.message ?? 'WASM command was rejected')
        }
        try {
          if (ack.emittedEvents.length > 0) {
            const syncAck = await wasm!.triggerSync()
            if (!syncAck.accepted) {
              throw new Error(syncAck.metadata.error ?? 'WASM trigger sync was rejected')
            }
            syncStatusRef.current = await wasm!.readSyncStatus()
            const tiles = await wasm!.exportTiles()
            await eventStore.replaceAllTiles(tiles)
          }
        } catch (err) {
          try {
            syncStatusRef.current = await wasm!.readSyncStatus()
            if (mountedRef.current) {
              setState(current => ({
                ...current,
                execution: {
                  ...current.execution,
                  syncStatus: syncStatusRef.current,
                },
              }))
            }
          } catch (statusErr) {
            console.warn('Failed to refresh wasm sync status after trigger error', statusErr)
          }
          const latest = await eventStore.loadAllTiles()
          await wasm!.replaceTiles(latest)
          try {
            await refreshSnapshot()
          } catch (refreshErr) {
            console.warn('Failed to refresh snapshot after wasm trigger error', refreshErr)
          }
          throw err
        }
      } else {
        await wasm!.execute(command, actor)
        await persistWasmTiles(wasm!)
      }
    }
    await refreshSnapshot()
  }, [refreshSnapshot, restoreDaemonSession])

  return { state, loading, execute }
}

function replayPersistedWasmTiles(engine: WasmExecutionEngine): Promise<void> {
  const storage = getLocalStorage()
  if (!storage) return Promise.resolve()
  let raw: string | null = null
  try {
    raw = storage.getItem(WASM_TILES_STORAGE_KEY)
  } catch {
    return Promise.resolve()
  }
  if (!raw) return Promise.resolve()
  let tiles: Tile[] = []
  try {
    tiles = JSON.parse(raw) as Tile[]
  } catch {
    storage.removeItem(WASM_TILES_STORAGE_KEY)
    return Promise.resolve()
  }
  return engine.replaceTiles(tiles).catch(err => {
    console.warn('Skipping persisted wasm tile replay due to execution error', err)
  })
}

async function persistWasmTiles(engine: WasmExecutionEngine) {
  const storage = getLocalStorage()
  if (!storage) return
  try {
    const tiles = await engine.exportTiles()
    storage.setItem(WASM_TILES_STORAGE_KEY, JSON.stringify(tiles))
  } catch {
    return
  }
}

function getLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    const storage = window.localStorage
    if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
      return null
    }
    return storage
  } catch {
    return null
  }
}

function getOrCreateWasmDeviceId(): string {
  const storage = getLocalStorage()
  if (!storage) {
    if (!runtimeWasmDeviceId) runtimeWasmDeviceId = createWebDeviceId()
    return runtimeWasmDeviceId
  }
  try {
    const existing = storage.getItem(WASM_DEVICE_ID_STORAGE_KEY)
    if (existing && existing.trim().length > 0) return existing
    const created = createWebDeviceId()
    storage.setItem(WASM_DEVICE_ID_STORAGE_KEY, created)
    return created
  } catch {
    if (!runtimeWasmDeviceId) runtimeWasmDeviceId = createWebDeviceId()
    return runtimeWasmDeviceId
  }
}

function createWebDeviceId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `web-${crypto.randomUUID()}`
  }
  return `web-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function projectSnapshotToAppState(
  snapshot: ExecutionSnapshot,
  syncStatus: ExecutionSyncStatus | null = null,
  exportedTiles: Tile[] | null = null,
  tilesView: DaemonTilesResponse | null = null,
  executionView: DaemonExecutionViewResponse | null = null,
  pendingPromptView: DaemonPendingPromptResponse | null = null,
  todayTimeline: DaemonTimelineTodayResponse | null = null
): AppState {
  const tiles = new Map<TileId, Tile>()
  if (Array.isArray(exportedTiles)) {
    for (const tile of exportedTiles) {
      tiles.set(tile.core.id, tile)
    }
  }
  if (tilesView?.tiles?.length) {
    for (const view of tilesView.tiles) {
      const tile = toDomainTileFromView(view)
      tiles.set(tile.core.id, mergeTiles(tiles.get(tile.core.id), tile))
    }
  }
  const timeline = toTimelineSnapshots(snapshot.timeline, todayTimeline, tiles)
  const ensureTile = (tileId: TileId, title: string): Tile => {
    const existing = tiles.get(tileId)
    if (existing) return existing
    const created = Tile.create(tileId, title || 'Untitled tile')
    tiles.set(tileId, created)
    return created
  }

  for (const row of snapshot.inProgressTiles) {
    const tile = ensureTile(row.tileId, row.title)
    tile.core.startedAt = row.startedAt
  }

  for (const row of timeline) {
    if (!row.tileId || row.tileId.startsWith('synthetic:')) continue
    const tile = ensureTile(row.tileId, row.title)
    if (!tile.core.startedAt && (row.status === 'active' || row.status === 'done')) {
      tile.core.startedAt = row.startAt
    }
    if (row.status === 'done' && row.endAt) {
      tile.core.completedAt = row.endAt
    }
  }

  const primary = snapshot.inProgressTiles[0] ?? null
  const activeTimeline = timeline.find(row => row.status === 'active')
  const activeTimelineTileId = activeTimeline?.tileId && tiles.has(activeTimeline.tileId) ? activeTimeline.tileId : null
  const executionMainTileId = executionView?.mainTile?.id ? TileId.fromString(executionView.mainTile.id) : null
  const activeTileId = executionMainTileId ?? activeTimelineTileId ?? primary?.tileId ?? null
  const activeStartAt = toDateOrNull(executionView?.mainTileStartedAt) ?? activeTimeline?.startAt ?? primary?.startedAt ?? (activeTileId ? tiles.get(activeTileId)?.core.startedAt ?? null : null)
  const activePhaseKind = executionView?.isOnBreak
    ? 'break'
    : executionView?.isWorking
      ? 'work'
      : activeTimeline
        ? (activeTimeline.type === 'break' ? 'break' : 'work')
        : (primary?.phaseKind ?? 'idle')
  const activeEndsAt =
    toDateOrNull(executionView?.mainTileEndsAt) ??
    activeTimeline?.endAt ??
    primary?.phaseEndsAt ??
    derivePhaseEndsAtFromTile(activeTileId ? tiles.get(activeTileId) ?? null : null, activePhaseKind, activeStartAt)
  if (activeTileId && !tiles.has(activeTileId) && activeTimeline?.tileId) {
    ensureTile(activeTimeline.tileId, activeTimeline.title)
  }

  const pendingPrompt = toPendingPrompt(snapshot.promptQueue, pendingPromptView)
  const events = toCompatEvents(snapshot, todayTimeline)

  return {
    tiles,
    execution: {
      activeTileId,
      phaseKind: activePhaseKind,
      phaseStartedAt: activeStartAt,
      phaseEndsAt: activeEndsAt,
      nextActionableStartAt: toDateOrNull(tilesView?.nextActionableStartAt) ?? null,
      pendingPrompt,
      syncStatus,
    },
    timeline,
    events,
  }
}

function toTimelineSnapshots(
  snapshotTimeline: TimelineItemSnapshot[],
  todayTimeline: DaemonTimelineTodayResponse | null,
  tilesById: Map<TileId, Tile>
): TimelineItemSnapshot[] {
  const inferDurationForTile = (
    tileId: TileId | null,
    type: TimelineItemSnapshot['type']
  ): number | null => {
    if (!tileId) return null
    const tile = tilesById.get(tileId)
    if (!tile) return null
    if (type === 'break') {
      const value = tile.objective.targetRestMin
      return typeof value === 'number' && value > 0 ? value : null
    }
    const value = tile.objective.targetWorkMin
    return typeof value === 'number' && value > 0 ? value : null
  }

  if (!todayTimeline?.items?.length) {
    return snapshotTimeline.map(item => {
      const fallback = inferDurationForTile(item.tileId, item.type)
      return {
        ...item,
        durationMin: item.durationMin && item.durationMin > 0 ? item.durationMin : fallback,
      }
    })
  }

  const now = Date.now()
  const items: TimelineItemSnapshot[] = []
  for (const [index, row] of todayTimeline.items.entries()) {
    const startAt = toDateOrNull(row.startedAt)
    if (!startAt) continue
    const tileId = toTileIdOrNull(row.tileId)
    const parsedEnd = toDateOrNull(row.endedAt)
    const inferredDuration =
      row.durationMin > 0
        ? row.durationMin
        : inferDurationForTile(tileId, row.kind === 'break' ? 'break' : row.kind === 'work' ? 'work' : 'fixed')
    const inferredEnd =
      parsedEnd ??
      (inferredDuration && inferredDuration > 0
        ? new Date(startAt.getTime() + inferredDuration * 60 * 1000)
        : null)
    const status: TimelineItemSnapshot['status'] = row.isActive
      ? 'active'
      : inferredEnd && inferredEnd.getTime() <= now
        ? 'done'
        : 'scheduled'
    const type: TimelineItemSnapshot['type'] =
      row.kind === 'work' || row.kind === 'break' || row.kind === 'fixed' ? row.kind : 'fixed'

    items.push({
      id: `${row.tileId ?? 'timeline'}-${index}-${startAt.getTime()}`,
      tileId,
      title: row.title,
      type,
      status,
      startAt,
      endAt: inferredEnd,
      durationMin: inferredDuration ?? null,
    })
  }

  if (items.length === 0) {
    return snapshotTimeline.map(item => {
      const fallback = inferDurationForTile(item.tileId, item.type)
      return {
        ...item,
        durationMin: item.durationMin && item.durationMin > 0 ? item.durationMin : fallback,
      }
    })
  }
  items.sort((a, b) => a.startAt.getTime() - b.startAt.getTime())
  return items
}

function toTileIdOrNull(value: string | null): TileId | null {
  if (!value) return null
  try {
    return TileId.fromString(value)
  } catch {
    return null
  }
}

function derivePhaseEndsAtFromTile(tile: Tile | null, phaseKind: 'work' | 'break' | 'idle', activeStartAt: Date | null): Date | null {
  if (!tile || !activeStartAt || phaseKind === 'idle') return null
  const segmentMode = phaseKind === 'break' ? 'break' : 'work'
  const openSegment = [...(tile.work.segments ?? [])].reverse().find(segment => !segment.endAt && segment.mode === segmentMode)
  if (openSegment?.expectedEndAt) return openSegment.expectedEndAt
  const startAt = openSegment?.startAt ?? activeStartAt
  if (segmentMode === 'break') {
    const restMin = tile.objective.targetRestMin ?? 5
    return new Date(startAt.getTime() + restMin * 60 * 1000)
  }
  const targetMin = tile.objective.targetWorkMin ?? 25
  let workedMin = 0
  for (const segment of tile.work.segments ?? []) {
    if (segment.mode !== 'work' || !segment.endAt) continue
    workedMin += Math.max(0, Math.floor((segment.endAt.getTime() - segment.startAt.getTime()) / 60000))
  }
  const remainingMin = tile.interruption.breakSplitsWork ? Math.max(0, targetMin - workedMin) : targetMin
  return new Date(startAt.getTime() + remainingMin * 60 * 1000)
}

function toPendingPrompt(promptQueue: PromptQueueItemSnapshot[], pendingPromptView: DaemonPendingPromptResponse | null = null) {
  if (pendingPromptView?.prompt) {
    const actions: PromptAction[] = pendingPromptView.prompt.actions
      .map(action => normalizePromptActionId(action.id))
      .filter((action): action is PromptAction => action !== null)
    return {
      promptId: pendingPromptView.prompt.promptId,
      tileId: pendingPromptView.prompt.tileId ? TileId.fromString(pendingPromptView.prompt.tileId) : null,
      kind: pendingPromptView.prompt.kind as PromptQueueItemSnapshot['kind'],
      severity: pendingPromptView.prompt.severity as PromptQueueItemSnapshot['severity'],
      title: pendingPromptView.prompt.title,
      body: pendingPromptView.prompt.body,
      why: pendingPromptView.prompt.why,
      suggestedMinutes: pendingPromptView.prompt.suggestedMinutes,
      reasons: pendingPromptView.prompt.reasons,
      actions: actions.length > 0 ? actions : (['dismiss'] as PromptAction[]),
      scheduledAt: toDateOrNull(pendingPromptView.prompt.createdAt) ?? new Date(),
      reason: pendingPromptView.prompt.reasons[0] ?? 'user_requested',
      expiresAt: toDateOrNull(pendingPromptView.prompt.expiresAt),
      stale: pendingPromptView.prompt.stale,
    }
  }
  const nextPrompt = promptQueue.find(item => item.status === 'pending') ?? null
  if (!nextPrompt) return null
  const { status, ...pendingPrompt } = nextPrompt
  void status
  return pendingPrompt
}

function toCompatEvents(snapshot: ExecutionSnapshot, todayTimeline: DaemonTimelineTodayResponse | null = null): EventEnvelope[] {
  const system = Actor.system()
  const events: EventEnvelope[] = []
  if (todayTimeline?.items?.length) {
    for (const [index, row] of todayTimeline.items.entries()) {
      if (!row.tileId) continue
      const startAt = toDateOrNull(row.startedAt)
      if (!startAt) continue
      events.push({
        event_id: EventId.fromString(`timeline-${index}-started`),
        aggregate_id: `tile:${row.tileId}`,
        occurred_at: startAt,
        actor: system,
        caused_by_command_id: null,
        request_id: null,
        event: {
          type: 'tile_started',
          tile_id: TileId.fromString(row.tileId),
          started_at: startAt,
        },
      })
      const endAt = toDateOrNull(row.endedAt)
      if (endAt) {
        events.push({
          event_id: EventId.fromString(`timeline-${index}-completed`),
          aggregate_id: `tile:${row.tileId}`,
          occurred_at: endAt,
          actor: system,
          caused_by_command_id: null,
          request_id: null,
          event: {
            type: 'tile_completed',
            tile_id: TileId.fromString(row.tileId),
            completed_at: endAt,
          },
        })
      }
    }
  }
  for (const row of snapshot.timeline) {
    if (!row.tileId || row.tileId.startsWith('synthetic:')) continue
    events.push({
      event_id: EventId.fromString(`${row.id}-started`),
      aggregate_id: `tile:${row.tileId}`,
      occurred_at: row.startAt,
      actor: system,
      caused_by_command_id: null,
      request_id: null,
      event: {
        type: 'tile_started',
        tile_id: row.tileId,
        started_at: row.startAt,
      },
    })
    if (row.status === 'done' && row.endAt) {
      events.push({
        event_id: EventId.fromString(`${row.id}-completed`),
        aggregate_id: `tile:${row.tileId}`,
        occurred_at: row.endAt,
        actor: system,
        caused_by_command_id: null,
        request_id: null,
        event: {
          type: 'tile_completed',
          tile_id: row.tileId,
          completed_at: row.endAt,
        },
      })
    }
  }
  events.sort((a, b) => a.occurred_at.getTime() - b.occurred_at.getTime())
  return events
}

function normalizePromptActionId(rawActionId: string): PromptAction | null {
  const normalized = rawActionId.trim().toLowerCase()
  switch (normalized) {
    case 'start':
    case 'start_tile':
      return 'start_tile'
    case 'complete':
    case 'complete_tile':
    case 'complete_and_start_next':
      return 'complete_tile'
    case 'complete_phase':
      return 'complete_phase'
    case 'extend':
    case 'extend_phase':
      return 'extend_phase'
    case 'defer':
    case 'defer_tile':
      return 'defer_tile'
    case 'break':
    case 'start_break':
    case 'start_break_parallel':
      return 'start_break_parallel'
    case 'start_break_split':
      return 'start_break_split'
    case 'start_break_split_extend':
    case 'start_break_split_and_extend':
      return 'start_break_split_and_extend'
    case 'end_break':
      return 'end_break'
    case 'confirm_continue':
      return 'confirm_continue'
    case 'confirm_stop_at':
      return 'confirm_stop_at'
    case 'confirm_executed':
      return 'confirm_executed'
    case 'confirm_skipped':
      return 'confirm_skipped'
    case 'continue':
    case 'dismiss':
      return 'dismiss'
    default:
      return null
  }
}

function isUnauthorizedDaemonError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return /(^|\D)401(\D|$)/.test(error.message)
}

async function runWithDaemonReauthRetry<T>(
  operation: () => Promise<T>,
  restoreSession: () => Promise<boolean>
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    if (!isUnauthorizedDaemonError(error)) throw error
    const restored = await restoreSession()
    if (!restored) throw error
    return await operation()
  }
}

function toDomainTileFromView(view: DaemonTilesResponse['tiles'][number]): Tile {
  const tile = Tile.create(TileId.fromString(view.id), view.title)
  tile.core.nextAction = view.nextAction
  tile.core.doneDefinition = view.doneDefinition
  tile.objective.targetWorkMin = view.targetWorkMin
  tile.objective.targetRestMin = view.targetRestMin
  tile.objective.doneRule = (view.doneRule as Tile['objective']['doneRule']) ?? null
  tile.annotation.semanticRole = (view.semanticRole as Tile['annotation']['semanticRole']) ?? 'work'
  tile.annotation.labels = view.labels
  tile.temporal.releaseAt = toDateOrNull(view.temporal?.releaseAt)
  tile.temporal.dueAt = toDateOrNull(view.temporal?.dueAt)
  tile.temporal.fixedStart = toDateOrNull(view.temporal?.fixedStart) ?? toDateOrNull(view.projectedNextStartAt)
  tile.temporal.fixedEnd = toDateOrNull(view.temporal?.fixedEnd)
  tile.temporal.activeStart = toDateOrNull(view.temporal?.activeStart)
  tile.temporal.activeEnd = toDateOrNull(view.temporal?.activeEnd)
  if (view.lifecycle.toLowerCase() === 'started') {
    tile.core.startedAt = toDateOrNull(view.temporal?.activeStart) ?? toDateOrNull(view.temporal?.fixedStart) ?? new Date()
  }
  if (view.lifecycle.toLowerCase() === 'done') {
    tile.core.completedAt = toDateOrNull(view.temporal?.activeEnd) ?? toDateOrNull(view.temporal?.fixedEnd) ?? new Date()
  }
  return tile
}

function mergeTiles(base: Tile | undefined, next: Tile): Tile {
  if (!base) return next
  return {
    ...base,
    core: {
      ...base.core,
      title: next.core.title || base.core.title,
      nextAction: next.core.nextAction ?? base.core.nextAction,
      doneDefinition: next.core.doneDefinition ?? base.core.doneDefinition,
      startedAt: base.core.startedAt ?? next.core.startedAt,
      completedAt: base.core.completedAt ?? next.core.completedAt,
    },
    temporal: {
      ...base.temporal,
      ...next.temporal,
    },
    objective: {
      ...base.objective,
      ...next.objective,
    },
    annotation: {
      ...base.annotation,
      semanticRole: next.annotation.semanticRole ?? base.annotation.semanticRole,
      labels: next.annotation.labels.length > 0 ? next.annotation.labels : base.annotation.labels,
    },
  }
}

function toDateOrNull(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

function toDaemonCommand(command: Command): DaemonCommandRequest {
  switch (command.type) {
    case 'create_tile':
      return { type: 'create_tile', tileId: command.tile_id, tile: command.tile }
    case 'start_tile':
      return { type: 'start_tile', tileId: command.tile_id, startedAt: command.started_at, source: command.source }
    case 'complete_tile':
      return {
        type: 'complete_tile',
        tileId: command.tile_id,
        completedAt: command.completed_at,
        nextTileId: command.next_tile_id,
        scope: command.scope,
      }
    case 'defer_tile':
      return {
        type: 'defer_tile',
        tileId: command.tile_id,
        deferredAt: command.deferred_at,
        nextStartAt: command.next_start_at,
      }
    case 'delete_tile':
      return { type: 'delete_tile', tileId: command.tile_id, deletedAt: command.deleted_at }
    case 'switch_active_tile':
      return {
        type: 'switch_active_tile',
        fromTileId: command.from_tile_id,
        toTileId: command.to_tile_id,
        switchedAt: command.switched_at,
        reason: command.reason,
        interruptSource: command.interrupt_source,
      }
    case 'start_break':
      return {
        type: 'start_break',
        linkedTileId: command.linked_tile_id,
        breakMin: command.break_min,
        reason: command.reason,
      }
    case 'end_break':
      return { type: 'end_break', tileId: command.tile_id, endedAt: command.ended_at }
    case 'extend_phase':
      return { type: 'extend_phase', tileId: command.tile_id, deltaMin: command.delta_min }
    case 'clear_prompt':
      return { type: 'clear_prompt', promptId: command.prompt_id, reason: command.reason }
    case 'request_prompt':
      return {
        type: 'request_prompt',
        tileId: command.tile_id,
        requestedAt: command.requested_at,
        reason: command.reason,
      }
    case 'respond_startup_recovery':
      return {
        type: 'respond_startup_recovery',
        promptId: command.prompt_id,
        tileId: command.tile_id,
        actionId: command.action,
        stopAt: command.stop_at,
      }
  }
}

async function safeRead<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await run()
  } catch {
    return fallback
  }
}

