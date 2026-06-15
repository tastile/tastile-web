import { SegmentId, TileId } from './ids'

export type StartSource = 'manual' | 'auto' | 'prompt' | 'system'
export type SegmentMode = 'work' | 'break'
export type TileLifecycle = 'ready' | 'started' | 'done'
export type ObjectiveMode = 'finish_once' | 'recurring' | 'maximize_within_interval' | 'label_only'
export type DoneRule = 'manual' | 'time_reached' | 'interval_end'
export type SemanticRole = 'work' | 'break' | 'label'
export interface RecurrenceModel {
  generator: {
    stepMin: number
    anchorEpochMin: number | null
  }
  window: {
    startOffsetMin: number
    endOffsetMin: number
  }
  selector: {
    expression: string | null
  }
}

export interface Segment {
  id: SegmentId
  startAt: Date
  endAt: Date | null
  expectedEndAt?: Date | null
  mode: SegmentMode
  sourceTileId: TileId
}

export interface TileCore {
  id: TileId
  title: string
  nextAction: string | null
  doneDefinition: string | null
  startedAt: Date | null
  completedAt: Date | null
}

export interface Tile {
  core: TileCore
  work: {
    segments: Segment[]
  }
  temporal: {
    /** IANA timezone name (e.g. "Asia/Tokyo") for displaying this
     *  tile's instants. `null` means UTC. */
    tz: string | null
    releaseAt: Date | null
    dueAt: Date | null
    fixedStart: Date | null
    fixedEnd: Date | null
    activeStart: Date | null
    activeEnd: Date | null
  }
  objective: {
    objectiveMode: ObjectiveMode
    targetWorkMin: number | null
    targetRestMin: number | null
    doneRule: DoneRule | null
    recurrence: RecurrenceModel | null
  }
  interruption: {
    interruptPenalty: number
    resumePenalty: number
    breakSplitsWork: boolean
    externalInterruptOnly: boolean
  }
  automation: {
    promptOnStart: boolean
    promptOnEnd: boolean
    autoStartAllowed: boolean
    autoEndAllowed: boolean
  }
  annotation: {
    semanticRole: SemanticRole
    labels: string[]
    timedLabels: Array<{
      label: string
      startAt: Date | null
      endAt: Date | null
    }>
  }
}

export const Tile = {
  create: (id: TileId, title: string): Tile => ({
    core: {
      id,
      title,
      nextAction: null,
      doneDefinition: null,
      startedAt: null,
      completedAt: null,
    },
    work: {
      segments: [],
    },
    temporal: {
      tz: null,
      releaseAt: null,
      dueAt: null,
      fixedStart: null,
      fixedEnd: null,
      activeStart: null,
      activeEnd: null,
    },
    objective: {
      objectiveMode: 'finish_once',
      targetWorkMin: null,
      targetRestMin: null,
      doneRule: 'manual',
      recurrence: null,
    },
    interruption: {
      interruptPenalty: 3,
      resumePenalty: 3,
      breakSplitsWork: true,
      externalInterruptOnly: false,
    },
    automation: {
      promptOnStart: false,
      promptOnEnd: true,
      autoStartAllowed: false,
      autoEndAllowed: false,
    },
    annotation: {
      semanticRole: 'work',
      labels: [],
      timedLabels: [],
    },
  }),
}

export function getTileLifecycle(tile: Tile): TileLifecycle {
  if (tile.core.completedAt) return 'done'
  if (tile.core.startedAt) return 'started'
  return 'ready'
}
