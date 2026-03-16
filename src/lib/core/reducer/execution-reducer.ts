import { Execution, PhaseKind } from '../../domain/execution'
import {
  TileStartedPayload,
  TileCompletedPayload,
  PhaseExtendedPayload,
  BreakStartedPayload,
  BreakEndedPayload,
} from '../event'

export function applyTileStarted(exec: Execution, payload: TileStartedPayload): void {
  exec.active_tile_id = payload.tile_id
  exec.phase_kind = PhaseKind.Work
  exec.phase_started_at = payload.started_at
  exec.phase_ends_at = new Date(payload.started_at.getTime() + 25 * 60 * 1000)
}

export function applyTileCompleted(exec: Execution, payload: TileCompletedPayload): void {
  exec.active_tile_id = null
  exec.phase_kind = PhaseKind.Idle
  exec.phase_started_at = null
  exec.phase_ends_at = null
}

export function applyPhaseExtended(exec: Execution, payload: PhaseExtendedPayload): void {
  if (exec.phase_ends_at) {
    exec.phase_ends_at = new Date(exec.phase_ends_at.getTime() + payload.delta_min * 60 * 1000)
  }
}

export function applyBreakStarted(exec: Execution, payload: BreakStartedPayload): void {
  exec.phase_kind = PhaseKind.Break
  exec.phase_started_at = payload.started_at
  exec.phase_ends_at = payload.ends_at
  exec.active_tile_id = null
}

export function applyBreakEnded(exec: Execution, _payload: BreakEndedPayload): void {
  exec.phase_kind = PhaseKind.Idle
  exec.phase_started_at = null
  exec.phase_ends_at = null
}
