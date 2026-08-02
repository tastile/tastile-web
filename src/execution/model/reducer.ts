// ============================================================================
// Reducer: Event to AppState transformation
// ============================================================================
//
// 依存関係の逆転の入口として、Event から AppState を導出するロジックを
// 単一関数に集約する。
//
// Event Sourcing Pattern:
// UI → API Layer → Command Handler → Event Store → Reducer → AppState
// ============================================================================

import type { Command } from "./command";
import { eventReducer as reduce } from "./domain-reducer";
import type { Event } from "./event";
import type { AppState } from "./state";

/**
 * Reducer: AppState → AppState
 */
export const reducer = (state: AppState, command: Command): AppState => {
  // Command → Events (placeholder - would need command handler)
  // For now, return state unchanged
  return state;
};

/**
 * Reducer: Event → AppState
 */
export const eventReducer = (state: AppState, event: Event): AppState => {
  return reduce(state, event);
};

/**
 * Command → AppState
 */
export function commandReducer(state: AppState, command: Command): AppState {
  return reducer(state, command);
}
