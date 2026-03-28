import type { Command } from '../core/command'
import type { Actor } from '../domain/actor'
import type { ExecutionSnapshot } from '../domain/execution'
import { parseExecutionSnapshot } from '../daemon/contracts'

export interface WasmExecutionEngine {
  readSnapshot(): Promise<ExecutionSnapshot>
  execute(command: Command, actor: Actor): Promise<void>
  executePayload(payload: string): Promise<void>
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
  }
}

type CoreWasmModule = {
  default: (moduleOrPath?: unknown) => Promise<unknown>
  WasmCoreEngine: new () => {
    execute: (commandJson: string) => void
    read_snapshot_json: (nowIsoUtc: string | null) => string
  }
}

let cachedWasmModule: Promise<CoreWasmModule> | null = null

async function loadWasmModule(): Promise<CoreWasmModule> {
  if (!cachedWasmModule) {
    cachedWasmModule = (async () => {
      const wasmModule = (await import('@/wasm/tastile-core-wasm/pkg/tastile_core_wasm.js')) as CoreWasmModule
      await wasmModule.default()
      return wasmModule
    })()
  }
  return cachedWasmModule
}

