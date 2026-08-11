// ============================================================================
// Domain Layer: Reducer
// ============================================================================
//
// Single function that converts Event -> AppState.
// Entry point for dependency inversion: all reducer logic is dispatched
// from here.
// ============================================================================

import type { Command } from "./command";
import type { Event, EventEnvelope } from "./event";
import type { AppState } from "./state";

/**
 * Reducer: Event → AppState
 *
 * Mutates `state` in place and returns it.  This matches the handler/test
 * convention where `state` is shared across multiple `reduce()` calls.
 */
const reduce = (state: AppState, event: Event): AppState => {
  switch (event.type) {
    // ==================== Tile Events ====================

    case "tile_created": {
      const { tile } = event;
      state.tiles.set(tile.core.id, tile);
      return state;
    }

    case "tile_started": {
      const { tile_id, started_at } = event;
      const tile = state.tiles.get(tile_id);
      if (tile) {
        tile.core.startedAt = started_at;
      }
      return state;
    }

    case "tile_completed": {
      const { tile_id, completed_at } = event;
      const tile = state.tiles.get(tile_id);
      if (tile) {
        tile.core.completedAt = completed_at;
      }
      if (state.execution.activeTileId === tile_id) {
        state.execution.activeTileId = null;
        state.execution.phaseKind = "idle";
        state.execution.phaseStartedAt = null;
        state.execution.phaseEndsAt = null;
      }
      return state;
    }

    case "tile_interrupted": {
      const { tile_id, interrupted_at, source, reason } = event;
      const tile = state.tiles.get(tile_id);
      if (tile) {
        tile.annotation.interruptedAt = interrupted_at;
        tile.annotation.interruptSource = source;
        tile.annotation.interruptReason = reason;
      }
      return state;
    }

    case "tile_deferred": {
      const { tile_id, deferred_at, next_start_at } = event;
      const tile = state.tiles.get(tile_id);
      if (tile) {
        tile.core.deferredAt = deferred_at;
        tile.core.nextStartAt = next_start_at;
      }
      return state;
    }

    case "tile_deleted": {
      const { tile_id } = event;
      state.tiles.delete(tile_id);
      return state;
    }

    // ==================== Segment Events ====================

    case "segment_started": {
      const { segment_id, tile_id, mode, started_at, expected_end_at } = event;
      const tile = state.tiles.get(tile_id);
      if (tile) {
        tile.work.segments.push({
          id: segment_id,
          mode,
          startAt: started_at,
          expectedEndAt: expected_end_at ?? null,
          endAt: null,
          sourceTileId: tile_id,
        });
      }
      if (mode === "work") {
        state.execution.phaseKind = "work";
        state.execution.phaseStartedAt = started_at;
        state.execution.phaseEndsAt = expected_end_at ?? null;
      }
      state.execution.activeTileId = tile_id;
      return state;
    }

    case "segment_ended": {
      const { segment_id, tile_id, ended_at } = event;
      const tile = state.tiles.get(tile_id);
      if (tile) {
        const seg = tile.work.segments.find((s) => s.id === segment_id);
        if (seg) {
          seg.endAt = ended_at;
        }
      }
      return state;
    }

    // ==================== Execution Events ====================

    case "break_started": {
      const { linked_tile_id, started_at, ends_at } = event;
      state.execution.activeTileId = linked_tile_id || state.execution.activeTileId;
      state.execution.pendingPrompt = null;
      state.execution.phaseKind = "break";
      state.execution.phaseStartedAt = started_at;
      state.execution.phaseEndsAt = ends_at ?? null;
      return state;
    }

    case "break_ended": {
      state.execution.activeTileId = null;
      state.execution.pendingPrompt = null;
      state.execution.phaseKind = "idle";
      state.execution.phaseStartedAt = null;
      state.execution.phaseEndsAt = null;
      return state;
    }

    case "prompt_scheduled": {
      const {
        prompt_id,
        tile_id,
        scheduled_at,
        kind,
        severity,
        suggested_minutes,
        reasons,
        actions,
        reason,
      } = event;
      state.execution.activeTileId = null;
      state.execution.pendingPrompt = {
        promptId: prompt_id,
        tileId: tile_id,
        scheduledAt: scheduled_at,
        kind,
        severity,
        suggestedMinutes: suggested_minutes,
        reasons,
        actions,
        reason,
      };
      return state;
    }

    case "prompt_cleared": {
      state.execution.pendingPrompt = null;
      return state;
    }

    // ==================== Default ====================

    default:
      return state;
  }
};

/**
 * Event → AppState
 */
export function eventReducer(state: AppState, event: Event): AppState {
  return reduce(state, event);
}

// TODO: Implement domainReducer when needed
