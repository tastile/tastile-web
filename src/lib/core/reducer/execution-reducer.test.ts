import { describe, it, expect } from 'vitest'
import { applyTileStarted, applyTileCompleted, applyBreakStarted } from './execution-reducer'
import { Execution, PhaseKind } from '../../domain/execution'
import { TileId } from '../../domain/ids'
import { StartSource } from '../../domain/tile'

describe('Execution Reducer', () => {
  it('should set active tile on TileStarted', () => {
    const exec = Execution.initial()
    const tileId = TileId.new()
    const now = new Date()
    applyTileStarted(exec, { tile_id: tileId, started_at: now, source: StartSource.Manual })
    expect(exec.active_tile_id).toBe(tileId)
    expect(exec.phase_kind).toBe(PhaseKind.Work)
    expect(exec.phase_started_at).toBe(now)
  })

  it('should clear active tile on TileCompleted', () => {
    const exec = Execution.initial()
    const tileId = TileId.new()
    exec.active_tile_id = tileId
    exec.phase_kind = PhaseKind.Work
    applyTileCompleted(exec, { tile_id: tileId, completed_at: new Date() })
    expect(exec.active_tile_id).toBeNull()
    expect(exec.phase_kind).toBe(PhaseKind.Idle)
  })

  it('should transition to Break phase', () => {
    const exec = Execution.initial()
    const now = new Date()
    const endsAt = new Date(now.getTime() + 5 * 60 * 1000)
    applyBreakStarted(exec, {
      linked_tile_id: null,
      started_at: now,
      ends_at: endsAt,
      reason: null,
    })
    expect(exec.phase_kind).toBe(PhaseKind.Break)
    expect(exec.phase_started_at).toBe(now)
    expect(exec.phase_ends_at).toBe(endsAt)
  })
})
