import type { Command } from '../core/command'
import type { EventEnvelope } from '../core/event'
import type { Actor } from '../domain/actor'
import { EventId, CommandId, RequestId } from '../domain/ids'
import type { ExecutionSnapshot } from '../domain/execution'
import { parseExecutionSnapshot } from '../daemon/contracts'
import type { Tile } from '../domain/tile'

export interface WasmExecutionEngine {
  readSnapshot(): Promise<ExecutionSnapshot>
  execute(command: Command, actor: Actor): Promise<void>
  executePayload(payload: string): Promise<void>
  executeWithAck(command: Command, actor: Actor): Promise<WasmCommandAck>
  replaceEventLog(events: EventEnvelope[]): Promise<void>
  replaceTiles(tiles: Tile[]): Promise<void>
  exportTiles(): Promise<Tile[]>
}

export async function createWasmExecutionEngine(): Promise<WasmExecutionEngine> {
  const wasmModule = await loadWasmModule()
  const engine = new wasmModule.WasmCoreEngine()

  return {
    async readSnapshot() {
      const raw = engine.read_snapshot_json(new Date().toISOString())
      const parsed = JSON.parse(raw)
      return parseExecutionSnapshot(parsed)
    },
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
    async exportTiles() {
      return JSON.parse(engine.export_tiles_json()) as Tile[]
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

