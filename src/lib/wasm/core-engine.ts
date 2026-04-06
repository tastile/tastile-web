import type { Command } from '../core/command'
import type { EventEnvelope } from '../core/event'
import type { Actor } from '../domain/actor'
import { EventId, CommandId, RequestId } from '../domain/ids'
import type { ExecutionSnapshot } from '../domain/execution'
import { parseExecutionSnapshot } from '../daemon/contracts'
import type { Tile } from '../domain/tile'
import type {
  DaemonExecutionViewResponse,
  DaemonPendingPromptResponse,
  DaemonTimelineTodayResponse,
  DaemonTileView,
  DaemonTilesResponse,
} from '../daemon/client'

export interface WasmExecutionEngine {
  readSnapshot(): Promise<ExecutionSnapshot>
  readTiles(params?: { viewMode?: string; lifecycle?: string; limit?: number; search?: string }): Promise<DaemonTilesResponse>
  readExecutionView(): Promise<DaemonExecutionViewResponse>
  readPendingPrompt(): Promise<DaemonPendingPromptResponse>
  readTodayTimeline(): Promise<DaemonTimelineTodayResponse>
  execute(command: Command, actor: Actor): Promise<void>
  executePayload(payload: string): Promise<void>
  executeWithAck(command: Command, actor: Actor): Promise<WasmCommandAck>
  configureSync(input: WasmSyncConfigureInput): Promise<WasmSyncCommandAck>
  restoreSync(): Promise<WasmSyncCommandAck>
  triggerSync(): Promise<WasmSyncCommandAck>
  readSyncStatus(): Promise<WasmSyncStatus>
  replaceEventLog(events: EventEnvelope[]): Promise<void>
  replaceTiles(tiles: Tile[]): Promise<void>
  exportTiles(): Promise<Tile[]>
}

export async function createWasmExecutionEngine(): Promise<WasmExecutionEngine> {
  const wasmModule = await loadWasmModule()
  const engine = new wasmModule.WasmCoreEngine()
  const readSnapshot = async (): Promise<ExecutionSnapshot> => {
    const raw = engine.read_snapshot_json(new Date().toISOString())
    const parsed = JSON.parse(raw)
    return parseExecutionSnapshot(parsed)
  }
  const exportTiles = async (): Promise<Tile[]> => JSON.parse(engine.export_tiles_json()) as Tile[]
  const buildTilesResponse = (
    snapshot: ExecutionSnapshot,
    tiles: Tile[],
    params?: { viewMode?: string; lifecycle?: string; limit?: number; search?: string }
  ): DaemonTilesResponse => {
    const lifecycleById = new Map<string, string>()
    for (const timeline of snapshot.timeline) {
      if (!timeline.tileId) continue
      if (timeline.status === 'active') lifecycleById.set(timeline.tileId, 'started')
      if (timeline.status === 'done' && !lifecycleById.has(timeline.tileId)) lifecycleById.set(timeline.tileId, 'done')
    }
    let rows: DaemonTileView[] = tiles.map((tile: Tile) => toDaemonTileView(tile, lifecycleById.get(tile.core.id) ?? inferLifecycle(tile)))
    if (params?.lifecycle) {
      const normalized = params.lifecycle.toLowerCase()
      rows = rows.filter((tile: DaemonTileView) => tile.lifecycle.toLowerCase() === normalized)
    }
    if (params?.search) {
      const keyword = params.search.toLowerCase()
      rows = rows.filter((tile: DaemonTileView) => tile.title.toLowerCase().includes(keyword) || (tile.nextAction ?? '').toLowerCase().includes(keyword))
    }
    if (typeof params?.limit === 'number' && Number.isFinite(params.limit)) {
      rows = rows.slice(0, Math.max(0, Math.trunc(params.limit)))
    }
    return {
      tiles: rows,
      nextActionableTileId: rows.find((tile: DaemonTileView) => tile.lifecycle !== 'done')?.id ?? null,
      nextActionableStartAt: rows.find((tile: DaemonTileView) => tile.projectedNextStartAt)?.projectedNextStartAt ?? null,
    }
  }
  const readTiles = async (params?: { viewMode?: string; lifecycle?: string; limit?: number; search?: string }): Promise<DaemonTilesResponse> => {
    const [snapshot, tiles] = await Promise.all([readSnapshot(), exportTiles()])
    return buildTilesResponse(snapshot, tiles, params)
  }
  const readExecutionView = async (): Promise<DaemonExecutionViewResponse> => {
    const [snapshot, tiles] = await Promise.all([readSnapshot(), exportTiles()])
    const tileResponse = buildTilesResponse(snapshot, tiles)
    const tileById = new Map(tileResponse.tiles.map((tile: DaemonTileView) => [tile.id, tile] as const))
    const tilesInProgress = snapshot.inProgressTiles.map(progress => {
      const base = tileById.get(progress.tileId)
      return base ?? {
        ...toDaemonTileView({
          core: {
            id: progress.tileId,
            title: progress.title,
            nextAction: null,
            doneDefinition: null,
            startedAt: progress.startedAt,
            completedAt: null,
          },
          work: { segments: [] },
          temporal: { releaseAt: null, dueAt: null, fixedStart: null, fixedEnd: null, activeStart: null, activeEnd: null },
          objective: { objectiveMode: 'finish_once', targetWorkMin: null, targetRestMin: null, doneRule: null, recurrence: null },
          interruption: { interruptPenalty: 3, resumePenalty: 3, breakSplitsWork: true, externalInterruptOnly: false },
          automation: { promptOnStart: false, promptOnEnd: false, autoStartAllowed: false, autoEndAllowed: false },
          annotation: { semanticRole: 'work', labels: [], timedLabels: [] },
        } as Tile, 'started'),
        title: progress.title,
        lifecycle: 'started',
      }
    })
    const main = tilesInProgress[0] ?? null
    const active = snapshot.inProgressTiles[0] ?? null
    return {
      tilesInProgress,
      mainTile: main,
      isWorking: active?.phaseKind === 'work',
      isOnBreak: active?.phaseKind === 'break',
      isIdle: !active,
      mainTileStartedAt: active?.startedAt.toISOString() ?? null,
      mainTileEndsAt: active?.phaseEndsAt?.toISOString() ?? null,
      pendingPromptId: snapshot.promptQueue[0]?.promptId ?? null,
      tileCount: tileResponse.tiles.length,
      eventCount: snapshot.timeline.length,
    }
  }
  const readPendingPrompt = async (): Promise<DaemonPendingPromptResponse> => {
    const snapshot = await readSnapshot()
    const prompt = snapshot.promptQueue.find(item => item.status === 'pending') ?? null
    if (!prompt) return { prompt: null }
    return {
      prompt: {
        promptId: prompt.promptId,
        kind: prompt.kind,
        severity: prompt.severity,
        tileId: prompt.tileId,
        title: prompt.title ?? '',
        body: prompt.body ?? '',
        why: prompt.why ?? '',
        suggestedMinutes: prompt.suggestedMinutes,
        reasons: prompt.reasons,
        actions: prompt.actions.map(action => ({ id: action, label: action })),
        createdAt: prompt.scheduledAt.toISOString(),
        expiresAt: prompt.expiresAt?.toISOString() ?? null,
        stale: Boolean(prompt.stale),
      },
    }
  }
  const readTodayTimeline = async (): Promise<DaemonTimelineTodayResponse> => {
    const snapshot = await readSnapshot()
    return {
      items: snapshot.timeline.map(item => ({
        kind: item.type,
        tileId: item.tileId,
        semanticRole: item.type === 'fixed' ? 'label' : item.type,
        title: item.title,
        startedAt: item.startAt.toISOString(),
        endedAt: item.endAt?.toISOString() ?? null,
        durationMin:
          item.durationMin && item.durationMin > 0
            ? item.durationMin
            : item.endAt
              ? Math.max(0, Math.round((item.endAt.getTime() - item.startAt.getTime()) / 60000))
              : item.status === 'active'
                ? Math.max(0, Math.round((Date.now() - item.startAt.getTime()) / 60000))
                : 25,
        isActive: item.status === 'active',
      })),
    }
  }

  return {
    readSnapshot,
    readTiles,
    readExecutionView,
    readPendingPrompt,
    readTodayTimeline,
    async execute(command: Command, actor: Actor) {
      const payload = JSON.stringify({ command, actor })
      engine.execute(payload)
    },
    async executePayload(payload: string) {
      engine.execute(payload)
    },
    async executeWithAck(command: Command, actor: Actor) {
      const payload = JSON.stringify({ command, actor })
      return parseCommandAck(JSON.parse(engine.execute_with_ack_json(payload)))
    },
    async configureSync(input: WasmSyncConfigureInput) {
      const payload = JSON.stringify({
        device_id: input.deviceId,
        connected: input.connected,
        authenticated: input.authenticated,
        remote_tiles: input.remoteTiles?.map(tile => toSnakeCaseDeep(tile)),
      })
      return parseSyncCommandAck(JSON.parse(engine.configure_sync_json(payload)))
    },
    async restoreSync() {
      return parseSyncCommandAck(JSON.parse(engine.restore_sync_json()))
    },
    async triggerSync() {
      return parseSyncCommandAck(JSON.parse(engine.trigger_sync_json()))
    },
    async readSyncStatus() {
      return parseSyncStatus(JSON.parse(engine.read_sync_status_json()))
    },
    async replaceEventLog(events: EventEnvelope[]) {
      const payload = JSON.stringify(events)
      const ack = parseCommandAck(JSON.parse(engine.replace_event_log_json(payload)))
      if (!ack.accepted) {
        throw new Error(ack.error?.message ?? 'Failed to replace wasm event log')
      }
    },
    async replaceTiles(tiles: Tile[]) {
      const ack = parseCommandAck(JSON.parse(engine.replace_tiles_json(JSON.stringify(tiles))))
      if (!ack.accepted) {
        throw new Error(ack.error?.message ?? 'Failed to replace wasm tiles')
      }
    },
    exportTiles,
  }
}

function inferLifecycle(tile: Tile): string {
  if (tile.core.completedAt) return 'done'
  if (tile.core.startedAt) return 'started'
  return 'ready'
}

function toDaemonTileView(tile: Tile, lifecycle: string): DaemonTileView {
  const workedMinutes = tile.work.segments
    .filter(segment => segment.mode === 'work' && segment.endAt)
    .reduce((sum, segment) => sum + Math.max(0, Math.round((segment.endAt!.getTime() - segment.startAt.getTime()) / 60000)), 0)
  const breakMinutes = tile.work.segments
    .filter(segment => segment.mode === 'break' && segment.endAt)
    .reduce((sum, segment) => sum + Math.max(0, Math.round((segment.endAt!.getTime() - segment.startAt.getTime()) / 60000)), 0)
  return {
    id: tile.core.id,
    title: tile.core.title,
    lifecycle,
    nextAction: tile.core.nextAction,
    doneDefinition: tile.core.doneDefinition,
    workedMinutes,
    breakMinutes,
    semanticRole: tile.annotation.semanticRole,
    labels: tile.annotation.labels,
    objectiveMode: tile.objective.objectiveMode,
    targetWorkMin: tile.objective.targetWorkMin,
    targetRestMin: tile.objective.targetRestMin,
    doneRule: tile.objective.doneRule,
    resumeNote: null,
    projectedNextStartAt: tile.temporal.fixedStart?.toISOString() ?? null,
    temporal: {
      releaseAt: tile.temporal.releaseAt?.toISOString() ?? null,
      dueAt: tile.temporal.dueAt?.toISOString() ?? null,
      fixedStart: tile.temporal.fixedStart?.toISOString() ?? null,
      fixedEnd: tile.temporal.fixedEnd?.toISOString() ?? null,
      activeStart: tile.temporal.activeStart?.toISOString() ?? null,
      activeEnd: tile.temporal.activeEnd?.toISOString() ?? null,
    },
  }
}

export interface WasmCommandAck {
  accepted: boolean
  emittedEvents: EventEnvelope[]
  error?: {
    code: string
    message: string
  } | null
}

export interface WasmSyncConfigureInput {
  deviceId?: string
  connected?: boolean
  authenticated?: boolean
  remoteTiles?: Tile[]
}

export interface WasmSyncCommandAck {
  accepted: boolean
  metadata: {
    uploaded?: number
    downloaded?: number
    applied?: number
    failed?: number
    conflicts?: number
    error?: string
  }
}

export interface WasmSyncStatus {
  inProgress: boolean
  lastAttemptAt: string | null
  lastSuccessAt: string | null
  lastError: string | null
  lastResult: {
    uploaded: number
    downloaded: number
    applied: number
    failed: number
    conflicts: number
  } | null
}

type RawCommandAck = {
  accepted?: unknown
  metadata?: {
    emittedEvents?: RawEventEnvelope[]
    emitted_events?: RawEventEnvelope[]
  } | null
  error?: {
    code?: unknown
    message?: unknown
  } | null
}

type RawEventEnvelope = {
  event_id?: unknown
  eventId?: unknown
  aggregate_id?: unknown
  aggregateId?: unknown
  occurred_at?: unknown
  occurredAt?: unknown
  actor?: {
    type?: unknown
    id?: unknown
    actorType?: unknown
    actorId?: unknown
  } | null
  caused_by_command_id?: unknown
  causedByCommandId?: unknown
  request_id?: unknown
  requestId?: unknown
  event?: unknown
}

type CoreWasmModule = {
  default: (moduleOrPath?: unknown) => Promise<unknown>
  WasmCoreEngine: new () => {
    execute: (commandJson: string) => void
    execute_with_ack_json: (commandJson: string) => string
    read_snapshot_json: (nowIsoUtc: string | null) => string
    configure_sync_json: (configJson: string) => string
    restore_sync_json: () => string
    trigger_sync_json: () => string
    read_sync_status_json: () => string
    replace_event_log_json: (eventsJson: string) => string
    replace_tiles_json: (tilesJson: string) => string
    export_tiles_json: () => string
  }
}

let cachedWasmModule: Promise<CoreWasmModule> | null = null

async function loadWasmModule(): Promise<CoreWasmModule> {
  if (!cachedWasmModule) {
    cachedWasmModule = (async () => {
      const wasmModule = (await import('@/wasm/tastile-core-wasm/pkg/tastile_core_wasm.js')) as unknown as CoreWasmModule
      await wasmModule.default()
      return wasmModule
    })()
  }
  return cachedWasmModule
}

function parseCommandAck(raw: RawCommandAck): WasmCommandAck {
  return {
    accepted: raw.accepted === true,
    emittedEvents: Array.isArray(raw.metadata?.emittedEvents ?? raw.metadata?.emitted_events)
      ? (raw.metadata!.emittedEvents ?? raw.metadata!.emitted_events)!.map(parseEventEnvelope)
      : [],
    error: raw.error && typeof raw.error.code === 'string' && typeof raw.error.message === 'string'
      ? { code: raw.error.code, message: raw.error.message }
      : null,
  }
}

function parseEventEnvelope(raw: RawEventEnvelope): EventEnvelope {
  const eventId = typeof raw.event_id === 'string' ? raw.event_id : raw.eventId
  const aggregateId = typeof raw.aggregate_id === 'string' ? raw.aggregate_id : raw.aggregateId
  const occurredAt = typeof raw.occurred_at === 'string' ? raw.occurred_at : raw.occurredAt
  const causedByCommandId =
    typeof raw.caused_by_command_id === 'string' ? raw.caused_by_command_id : raw.causedByCommandId
  const requestId = typeof raw.request_id === 'string' ? raw.request_id : raw.requestId

  if (typeof eventId !== 'string') throw new Error('Invalid emitted event_id')
  if (typeof aggregateId !== 'string') throw new Error('Invalid emitted aggregate_id')
  if (typeof occurredAt !== 'string') throw new Error('Invalid emitted occurred_at')
  const actorType = typeof raw.actor?.type === 'string' ? raw.actor.type : raw.actor?.actorType
  const actorId = typeof raw.actor?.id === 'string' ? raw.actor.id : raw.actor?.actorId
  if (!raw.actor || typeof actorType !== 'string' || typeof actorId !== 'string') {
    throw new Error('Invalid emitted actor')
  }
  if (!raw.event || typeof raw.event !== 'object' || Array.isArray(raw.event)) {
    throw new Error('Invalid emitted event payload')
  }

  return {
    event_id: EventId.fromString(eventId),
    aggregate_id: aggregateId,
    occurred_at: new Date(occurredAt),
    actor: {
      type: actorType as Actor['type'],
      id: actorId,
    },
    caused_by_command_id: typeof causedByCommandId === 'string' ? CommandId.fromString(causedByCommandId) : null,
    request_id: typeof requestId === 'string' ? RequestId.fromString(requestId) : null,
    event: normalizeEventDates(raw.event as Record<string, unknown>) as EventEnvelope['event'],
  }
}

function normalizeEventDates(event: Record<string, unknown>) {
  const clone: Record<string, unknown> = { ...event }
  for (const key of [
    'started_at',
    'completed_at',
    'deferred_at',
    'next_start_at',
    'deleted_at',
    'expected_end_at',
    'ended_at',
    'interrupted_at',
    'scheduled_at',
    'cleared_at',
  ]) {
    if (typeof clone[key] === 'string') {
      clone[key] = new Date(clone[key] as string)
    }
  }
  return clone
}

function parseSyncCommandAck(raw: { accepted?: unknown; metadata?: unknown }): WasmSyncCommandAck {
  const metadata = raw.metadata && typeof raw.metadata === 'object' ? (raw.metadata as Record<string, unknown>) : {}
  const toOptionalCounter = (value: unknown): number | undefined => (value == null ? undefined : toFiniteCounter(value))
  return {
    accepted: raw.accepted === true,
    metadata: {
      uploaded: toOptionalCounter(metadata.uploaded),
      downloaded: toOptionalCounter(metadata.downloaded),
      applied: toOptionalCounter(metadata.applied),
      failed: toOptionalCounter(metadata.failed),
      conflicts: toOptionalCounter(metadata.conflicts),
      error: typeof metadata.error === 'string' ? metadata.error : undefined,
    },
  }
}

function parseSyncStatus(raw: unknown): WasmSyncStatus {
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {}
  const parseIsoOrNull = (input: unknown): string | null => {
    if (typeof input !== 'string') return null
    return Number.isNaN(Date.parse(input)) ? null : input
  }
  const lastResultRaw =
    value.last_result && typeof value.last_result === 'object'
      ? (value.last_result as Record<string, unknown>)
      : null
  return {
    inProgress: value.in_progress === true,
    lastAttemptAt: parseIsoOrNull(value.last_attempt_at),
    lastSuccessAt: parseIsoOrNull(value.last_success_at),
    lastError: typeof value.last_error === 'string' ? value.last_error : null,
    lastResult: lastResultRaw
      ? {
          uploaded: toFiniteCounter(lastResultRaw.uploaded),
          downloaded: toFiniteCounter(lastResultRaw.downloaded),
          applied: toFiniteCounter(lastResultRaw.applied),
          failed: toFiniteCounter(lastResultRaw.failed),
          conflicts: toFiniteCounter(lastResultRaw.conflicts),
        }
      : null,
  }
}

function toFiniteCounter(value: unknown): number {
  const parsed = Number(value ?? 0)
  if (!Number.isFinite(parsed)) return 0
  if (parsed <= 0) return 0
  return Math.trunc(parsed)
}

function toSnakeCaseDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(item => toSnakeCaseDeep(item))
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  if (!value || typeof value !== 'object') return value
  const mapped: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const snake = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)
    mapped[snake] = toSnakeCaseDeep(child)
  }
  return mapped
}

