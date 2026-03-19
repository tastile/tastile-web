import { Execution } from '../domain/execution'
import { TileId } from '../domain/ids'
import { Tile } from '../domain/tile'
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
