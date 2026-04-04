'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppState } from '../core/state'
import { Command, DaemonCommandRequest } from '../core/command'
import type { EventEnvelope } from '../core/event'
import { DaemonClient } from '../daemon/client'
import { openExecutionStream } from '../daemon/stream'
import { Actor } from '../domain/actor'
import { ExecutionSnapshot, PromptQueueItemSnapshot } from '../domain/execution'
import { EventId, TileId } from '../domain/ids'
import { Tile } from '../domain/tile'
import { createClient, getBrowserAccessToken } from '@/lib/supabase/client'
import { createWasmExecutionEngine, WasmExecutionEngine } from '../wasm/core-engine'
import { EventStore } from '../storage/event-store'

const DEFAULT_DAEMON_BASE_URL = 'http://127.0.0.1:3140'
const DEFAULT_EXECUTION_BACKEND = 'wasm'
const DEFAULT_DAEMON_REFRESH_MS = 5_000
const WASM_TILES_STORAGE_KEY = 'tastile:wasm-tiles:v1'

export function useDaemonExecution() {
  const [state, setState] = useState<AppState>(AppState.initial())
  const [loading, setLoading] = useState(true)
  const [supabase] = useState(() => createClient())
  const clientRef = useRef<DaemonClient | null>(null)
  const wasmRef = useRef<WasmExecutionEngine | null>(null)
  const eventStoreRef = useRef<EventStore | null>(null)
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

  const refreshSnapshot = useCallback(async () => {
    const client = clientRef.current
    const wasm = wasmRef.current
    if (!client && !wasm) return
    const requestId = ++refreshRequestRef.current
    const snapshot = client ? await client.readSnapshot() : await wasm!.readSnapshot()
    if (!mountedRef.current) return
    if (requestId < appliedRefreshRef.current) return
    appliedRefreshRef.current = requestId
    setState(projectSnapshotToAppState(snapshot))
  }, [])

  useEffect(() => {
    let active = true
    let closeStream: (() => void) | null = null
    let refreshTimer: ReturnType<typeof setInterval> | null = null
    mountedRef.current = true

    async function init() {
      try {
        if (backend === 'wasm') {
          const wasm = await createWasmExecutionEngine()
          wasmRef.current = wasm
          const {
            data: { session },
          } = await supabase.auth.getSession()
          if (session?.user) {
            const eventStore = new EventStore(supabase, session.user.id)
            eventStoreRef.current = eventStore
            const tiles = await eventStore.loadAllTiles()
            await wasm.configureSync({
              deviceId: 'web-device',
              connected: true,
              authenticated: true,
              remoteTiles: tiles,
            })
            const restoreAck = await wasm.restoreSync()
            if (!restoreAck.accepted) {
              throw new Error(restoreAck.metadata.error ?? 'WASM restore sync was rejected')
            }
            await wasm.replaceTiles(tiles)
            refreshTimer = setInterval(() => {
              void (async () => {
                try {
                  const latest = await eventStore.loadAllTiles()
                  await wasm.replaceTiles(latest)
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

        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (!active || !session?.user) {
          if (active) setLoading(false)
          return
        }

        const getAccessToken = async () => getBrowserAccessToken(supabase)
        clientRef.current = new DaemonClient({
          baseUrl,
          getAccessToken,
        })
        await clientRef.current.restoreSession({
          userId: session.user.id,
          email: session.user.email ?? '',
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          expiresAt: session.expires_at ? new Date(session.expires_at * 1000).toISOString() : null,
        })

        await refreshSnapshot()
        if (!active) return

        const stream = openExecutionStream({
          baseUrl,
          getAccessToken,
          onEvent: () => {
            void refreshSnapshot().catch(err => {
              console.error('Failed to refresh daemon snapshot from stream event:', err)
            })
          },
        })
        closeStream = stream.close
        refreshTimer = setInterval(() => {
          void refreshSnapshot().catch(err => {
            console.error('Failed to refresh daemon snapshot from periodic poll:', err)
          })
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
  }, [backend, baseUrl, daemonRefreshMs, refreshSnapshot, supabase])

  const execute = useCallback(async (command: Command, actor: Actor) => {
    const client = clientRef.current
    const wasm = wasmRef.current
    if (!client && !wasm) {
      throw new Error('Daemon client not initialized. Are you authenticated?')
    }
    if (client) {
      await client.sendCommand(toDaemonCommand(command))
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
            const tiles = await wasm!.exportTiles()
            await eventStore.replaceAllTiles(tiles)
          }
        } catch (err) {
          const latest = await eventStore.loadAllTiles()
          await wasm!.replaceTiles(latest)
          throw err
        }
      } else {
        await wasm!.execute(command, actor)
        await persistWasmTiles(wasm!)
      }
    }
    await refreshSnapshot()
  }, [refreshSnapshot])

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

function projectSnapshotToAppState(snapshot: ExecutionSnapshot): AppState {
  const tiles = new Map<TileId, Tile>()
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

  for (const row of snapshot.timeline) {
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
  const activeTimeline = snapshot.timeline.find(row => row.status === 'active')
  const activeTimelineTileId = activeTimeline?.tileId && tiles.has(activeTimeline.tileId) ? activeTimeline.tileId : null
  const activeTileId = primary?.tileId ?? activeTimelineTileId ?? null
  const activeStartAt = primary?.startedAt ?? activeTimeline?.startAt ?? null
  const activePhaseKind = primary?.phaseKind ?? (activeTimeline?.type === 'break' ? 'break' : activeTimeline ? 'work' : 'idle')
  const activeEndsAt = primary?.phaseEndsAt ?? activeTimeline?.endAt ?? null
  if (activeTileId && !tiles.has(activeTileId) && activeTimeline?.tileId) {
    ensureTile(activeTimeline.tileId, activeTimeline.title)
  }

  const pendingPrompt = toPendingPrompt(snapshot.promptQueue)
  const events = toCompatEvents(snapshot)

  return {
    tiles,
    execution: {
      activeTileId,
      phaseKind: activePhaseKind,
      phaseStartedAt: activeStartAt,
      phaseEndsAt: activeEndsAt,
      pendingPrompt,
    },
    timeline: snapshot.timeline,
    events,
  }
}

function toPendingPrompt(promptQueue: PromptQueueItemSnapshot[]) {
  const nextPrompt = promptQueue.find(item => item.status === 'pending') ?? null
  if (!nextPrompt) return null
  const { status, ...pendingPrompt } = nextPrompt
  void status
  return pendingPrompt
}

function toCompatEvents(snapshot: ExecutionSnapshot): EventEnvelope[] {
  const system = Actor.system()
  const events: EventEnvelope[] = []
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
  }
}

