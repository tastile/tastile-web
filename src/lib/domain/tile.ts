import { TileId } from './ids'

export interface TileCore {
  id: TileId
  title: string
  nextAction: string | null
  doneDefinition: string | null
}

export interface Tile {
  core: TileCore
}

// Helper to derive lifecycle state (NO stored status field!)
export function getTileLifecycle(tile: Tile): 'ready' | 'started' | 'done' {
  // For Phase 1, we don't have startedAt/completedAt yet
  // So all tiles are 'ready'
  return 'ready'
}
