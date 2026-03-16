import { TileId, PromptId } from './ids';

export enum PhaseKind {
  Work = 'work',
  Break = 'break',
  Idle = 'idle',
}

export interface Execution {
  active_tile_id: TileId | null;
  phase_kind: PhaseKind;
  phase_started_at: Date | null;
  phase_ends_at: Date | null;
  pending_prompt_id: PromptId | null;
}

export const Execution = {
  initial: (): Execution => ({
    active_tile_id: null,
    phase_kind: PhaseKind.Idle,
    phase_started_at: null,
    phase_ends_at: null,
    pending_prompt_id: null,
  }),
};
