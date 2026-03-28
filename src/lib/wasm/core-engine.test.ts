import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createWasmExecutionEngine } from './core-engine'

const executeMock = vi.fn()
const readSnapshotJsonMock = vi.fn()

vi.mock('@/wasm/tastile-core-wasm/pkg/tastile_core_wasm.js', () => ({
  default: vi.fn(async () => undefined),
  WasmCoreEngine: class {
    execute(commandJson: string) {
      executeMock(commandJson)
    }
    read_snapshot_json(nowIsoUtc: string | null) {
      return readSnapshotJsonMock(nowIsoUtc)
    }
  },
}))

describe('core-engine wasm bridge', () => {
  beforeEach(() => {
    executeMock.mockReset()
    readSnapshotJsonMock.mockReset()
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
})
