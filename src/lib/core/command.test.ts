import { describe, expect, it } from 'vitest'
import { fromDaemonCommandRequest } from './command'
import { TileId } from '../domain/ids'
import { Tile } from '../domain/tile'

describe('fromDaemonCommandRequest', () => {
  it('maps daemon start_tile request into core snake_case command', () => {
    const tileId = TileId.fromString('tile-1')
    const startedAt = new Date('2026-03-26T09:00:00.000Z')

    const command = fromDaemonCommandRequest({
      type: 'start_tile',
      tileId,
      startedAt,
      source: 'manual',
    })

    expect(command).toEqual({
      type: 'start_tile',
      tile_id: tileId,
      started_at: startedAt,
      source: 'manual',
    })
  })

  it('maps create_tile request', () => {
    const tileId = TileId.fromString('tile-1')
    const tile = Tile.create(tileId, 'Task')
    expect(fromDaemonCommandRequest({ type: 'create_tile', tileId, tile })).toEqual({
      type: 'create_tile',
      tile_id: tileId,
      tile,
    })
  })

  it('maps complete_tile request', () => {
    const tileId = TileId.fromString('tile-1')
    const nextTileId = TileId.fromString('tile-2')
    const completedAt = new Date('2026-03-26T10:00:00.000Z')
    expect(fromDaemonCommandRequest({ type: 'complete_tile', tileId, completedAt, nextTileId })).toEqual({
      type: 'complete_tile',
      tile_id: tileId,
      completed_at: completedAt,
      next_tile_id: nextTileId,
    })
  })

  it('maps defer_tile request with null nextStartAt', () => {
    const tileId = TileId.fromString('tile-1')
    const deferredAt = new Date('2026-03-26T10:10:00.000Z')
    expect(fromDaemonCommandRequest({ type: 'defer_tile', tileId, deferredAt, nextStartAt: null })).toEqual({
      type: 'defer_tile',
      tile_id: tileId,
      deferred_at: deferredAt,
      next_start_at: null,
    })
  })

  it('maps delete_tile request', () => {
    const tileId = TileId.fromString('tile-1')
    const deletedAt = new Date('2026-03-26T10:20:00.000Z')
    expect(fromDaemonCommandRequest({ type: 'delete_tile', tileId, deletedAt })).toEqual({
      type: 'delete_tile',
      tile_id: tileId,
      deleted_at: deletedAt,
    })
  })

  it('maps switch_active_tile request', () => {
    const fromTileId = TileId.fromString('tile-1')
    const toTileId = TileId.fromString('tile-2')
    const switchedAt = new Date('2026-03-26T10:30:00.000Z')
    expect(
      fromDaemonCommandRequest({
        type: 'switch_active_tile',
        fromTileId,
        toTileId,
        switchedAt,
        reason: 'manual switch',
        interruptSource: 'user_switch',
      })
    ).toEqual({
      type: 'switch_active_tile',
      from_tile_id: fromTileId,
      to_tile_id: toTileId,
      switched_at: switchedAt,
      reason: 'manual switch',
      interrupt_source: 'user_switch',
    })
  })

  it('maps start_break request', () => {
    const linkedTileId = TileId.fromString('tile-1')
    expect(fromDaemonCommandRequest({ type: 'start_break', linkedTileId, breakMin: 5, reason: null })).toEqual({
      type: 'start_break',
      linked_tile_id: linkedTileId,
      break_min: 5,
      reason: null,
    })
  })

  it('maps end_break request with nulls', () => {
    expect(fromDaemonCommandRequest({ type: 'end_break', tileId: null, endedAt: null })).toEqual({
      type: 'end_break',
      tile_id: null,
      ended_at: null,
    })
  })

  it('maps extend_phase request', () => {
    const tileId = TileId.fromString('tile-1')
    expect(fromDaemonCommandRequest({ type: 'extend_phase', tileId, deltaMin: 10 })).toEqual({
      type: 'extend_phase',
      tile_id: tileId,
      delta_min: 10,
    })
  })

  it('maps clear_prompt request', () => {
    expect(fromDaemonCommandRequest({ type: 'clear_prompt', promptId: 'p1', reason: 'dismissed' })).toEqual({
      type: 'clear_prompt',
      prompt_id: 'p1',
      reason: 'dismissed',
    })
  })

  it('maps request_prompt request', () => {
    const requestedAt = new Date('2026-03-26T10:45:00.000Z')
    expect(
      fromDaemonCommandRequest({
        type: 'request_prompt',
        tileId: null,
        requestedAt,
        reason: 'status_icon',
      })
    ).toEqual({
      type: 'request_prompt',
      tile_id: null,
      requested_at: requestedAt,
      reason: 'status_icon',
    })
  })

  it('maps respond_startup_recovery request', () => {
    const tileId = TileId.fromString('tile-1')
    const stopAt = new Date('2026-03-26T10:45:00.000Z')
    expect(
      fromDaemonCommandRequest({
        type: 'respond_startup_recovery',
        promptId: 'p1',
        tileId,
        actionId: 'confirm_stop_at',
        stopAt,
      })
    ).toEqual({
      type: 'respond_startup_recovery',
      prompt_id: 'p1',
      tile_id: tileId,
      action: 'confirm_stop_at',
      stop_at: stopAt,
    })
  })
})
