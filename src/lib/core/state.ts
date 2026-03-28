import { Execution } from '../domain/execution'
import { TimelineItemSnapshot } from '../domain/execution'
import { TileId } from '../domain/ids'
import { Tile } from '../domain/tile'
import { EventEnvelope } from './event'

export interface AppState {
  tiles: Map<TileId, Tile>
  execution: Execution
  timeline: TimelineItemSnapshot[]
  events: EventEnvelope[]
}

export const AppState = {
  initial: (): AppState => ({
    tiles: new Map(),
    execution: Execution.initial(),
    timeline: [],
    events: [],
  }),
}
