// ============================================================================
// Domain Layer: Reducer
// ============================================================================
//
// 単一の関数で Event → AppState を変換する。
// 依存関係の逆転の入口として、すべての Reducer ロジックをここから
// 呼び出す。
// ============================================================================

import type { Event, EventEnvelope } from "./event";
import type { Command } from "./command";
import type { AppState } from "./state";

/**
 * Reducer: Event → AppState
 */
export const reduce = (state: AppState, event: Event): AppState => {
  switch (event.type) {
    // ==================== Tile Events ====================

    case "tile_created": {
      const { tile } = event;
      const newTiles = new Map(state.tiles);
      newTiles.set(tile.core.id, tile);
      return {
        ...state,
        tiles: newTiles,
      };
    }

    case "tile_started": {
      const { tile_id, started_at } = event;
      const newTiles = new Map(state.tiles);
      const tile = newTiles.get(tile_id);
      if (tile) {
        tile.core.startedAt = started_at;
      }
      return {
        ...state,
        tiles: newTiles,
      };
    }

    case "tile_completed": {
      const { tile_id, completed_at } = event;
      const newTiles = new Map(state.tiles);
      const tile = newTiles.get(tile_id);
      if (tile) {
        tile.core.completedAt = completed_at;
      }
      return {
        ...state,
        tiles: newTiles,
      };
    }

    case "tile_interrupted": {
      const { tile_id, interrupted_at, source, reason } = event;
      const newTiles = new Map(state.tiles);
      const tile = newTiles.get(tile_id);
      if (tile) {
        tile.annotation.interruptedAt = interrupted_at;
        tile.annotation.interruptSource = source;
        tile.annotation.interruptReason = reason;
      }
      return {
        ...state,
        tiles: newTiles,
      };
    }

    case "tile_deferred": {
      const { tile_id, deferred_at, next_start_at } = event;
      const newTiles = new Map(state.tiles);
      const tile = newTiles.get(tile_id);
      if (tile) {
        tile.core.deferredAt = deferred_at;
        tile.core.nextStartAt = next_start_at;
      }
      return {
        ...state,
        tiles: newTiles,
      };
    }

    case "tile_deleted": {
      const { tile_id } = event;
      const newTiles = new Map(state.tiles);
      newTiles.delete(tile_id);
      return {
        ...state,
        tiles: newTiles,
      };
    }

    // ==================== Segment Events ====================

    case "segment_started": {
      const { segment_id, tile_id, mode, started_at, expected_end_at } = event;
      const newTiles = new Map(state.tiles);
      const tile = newTiles.get(tile_id);
      if (tile) {
        const segments = [...tile.work.segments];
        segments.push({
          id: segment_id,
          mode,
          startAt: started_at,
          expectedEndAt: expected_end_at ?? null,
          endAt: null,
          sourceTileId: tile_id,
        });
        tile.work.segments = segments;
      }
      return {
        ...state,
        tiles: newTiles,
      };
    }

    case "segment_ended": {
      const { segment_id, tile_id, ended_at } = event;
      const newTiles = new Map(state.tiles);
      const tile = newTiles.get(tile_id);
      if (tile) {
        const segments = [...tile.work.segments];
        const index = segments.findIndex((s) => s.id === segment_id);
        if (index >= 0) {
          segments[index].endAt = ended_at;
          tile.work.segments = segments;
        }
      }
      return {
        ...state,
        tiles: newTiles,
      };
    }

    // ==================== Execution Events ====================

    case "break_started": {
      const { linked_tile_id, started_at, ends_at, reason } = event;
      return {
        ...state,
        execution: {
          ...state.execution,
          activeTileId: linked_tile_id || state.execution.activeTileId,
          pendingPrompt: null,
        },
      };
    }

    case "break_ended": {
      const { ended_at } = event;
      return {
        ...state,
        execution: {
          ...state.execution,
          activeTileId: null,
          pendingPrompt: null,
        },
      };
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
      return {
        ...state,
        execution: {
          ...state.execution,
          activeTileId: null,
          pendingPrompt: {
            promptId: prompt_id,
            tileId: tile_id,
            scheduledAt: scheduled_at,
            kind,
            severity,
            suggestedMinutes: suggested_minutes,
            reasons,
            actions,
            reason,
          },
        },
      };
    }

    case "prompt_cleared": {
      return {
        ...state,
        execution: {
          ...state.execution,
          pendingPrompt: null,
        },
      };
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

/**
 * Command → Events
 */
export function domainReducer(state: AppState, command: Command): EventEnvelope[] {
  // Implementation would generate events from command
  return [];
}

/**
 * Export for core/reducer.ts compatibility
 */
export { eventReducer as coreReduce };
