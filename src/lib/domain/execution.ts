import { TileId } from './ids'

export type PhaseKind = 'work' | 'break' | 'idle'

export interface Execution {
  activeTileId: TileId | null
  phaseKind: PhaseKind
  phaseStartedAt: Date | null
  phaseEndsAt: Date | null
}

export const Execution = {
  initial: (): Execution => ({
    activeTileId: null,
    phaseKind: 'idle',
    phaseStartedAt: null,
    phaseEndsAt: null,
  }),
}
