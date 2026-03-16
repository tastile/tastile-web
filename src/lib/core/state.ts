// src/lib/core/state.ts
import { TileId } from '../domain/ids'
import { Tile } from '../domain/tile'
import { Execution } from '../domain/execution'
import { EventEnvelope } from './event'

export interface AppState {
  tiles: Map<TileId, Tile>
  execution: Execution
  events: EventEnvelope[]
}

export const AppState = {
  initial: (): AppState => ({
    tiles: new Map(),
    execution: Execution.initial(),
    events: [],
  }),
}
