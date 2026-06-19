import { Execution, type TimelineItemSnapshot } from "../domain/execution";
import type { TileId } from "../domain/ids";
import type { Tile } from "../domain/tile";
import type { EventEnvelope } from "./event";

export interface AppState {
  tiles: Map<TileId, Tile>;
  execution: Execution;
  timeline: TimelineItemSnapshot[];
  events: EventEnvelope[];
}

export const AppState = {
  initial: (): AppState => ({
    tiles: new Map(),
    execution: Execution.initial(),
    timeline: [],
    events: [],
  }),
};
