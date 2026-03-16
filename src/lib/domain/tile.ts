// src/lib/domain/tile.ts
import { TileId, SegmentId } from './ids'

export enum TileLifecycle {
  Ready = 'ready',
  Started = 'started',
  Deferred = 'deferred',
  Done = 'done',
  Closed = 'closed',
}

export enum SemanticRole {
  Default = 'default',
  Chore = 'chore',
  Deep = 'deep',
  Quick = 'quick',
}

export enum SegmentMode {
  Work = 'work',
  Break = 'break',
}

export enum StartSource {
  Manual = 'manual',
  Cli = 'cli',
  Auto = 'auto',
  Prompt = 'prompt',
}

export interface Segment {
  id: SegmentId
  start_at: Date
  end_at: Date | null
  mode: SegmentMode
  source_tile_id: TileId
}

export interface TileCore {
  id: TileId
  title: string
  next_action: string | null
  done_definition: string | null
  lifecycle: TileLifecycle
}

export interface WorkFacts {
  segments: Segment[]
  workedMinutes: () => number
}

export interface Annotation {
  semantic_role: SemanticRole
}

export interface Tile {
  core: TileCore
  work: WorkFacts
  annotation: Annotation
}

export const Tile = {
  create: (id: TileId, title: string): Tile => ({
    core: {
      id,
      title,
      next_action: null,
      done_definition: null,
      lifecycle: TileLifecycle.Ready,
    },
    work: {
      segments: [],
      workedMinutes() {
        return this.segments.reduce((total, seg) => {
          if (!seg.end_at) return total
          const ms = seg.end_at.getTime() - seg.start_at.getTime()
          return total + Math.floor(ms / 60000)
        }, 0)
      },
    },
    annotation: {
      semantic_role: SemanticRole.Default,
    },
  }),
}
