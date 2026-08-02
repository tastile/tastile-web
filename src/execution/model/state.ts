import type { TileId } from "@/shared/model/ids";
import type { Tile } from "@/tile/model/tile";
import type { EventEnvelope } from "./event";
import { Execution, type TimelineSnapshot } from "./execution";

export interface AppState {
  tiles: Map<TileId, Tile>;
  execution: Execution;
  timeline: TimelineSnapshot[];
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
