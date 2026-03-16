import { describe, it, expect } from 'vitest';
import { Execution, PhaseKind } from './execution';

describe('Execution', () => {
  it('should start in Idle phase', () => {
    const exec = Execution.initial();
    expect(exec.phase_kind).toBe(PhaseKind.Idle);
    expect(exec.active_tile_id).toBeNull();
  });

  it('should track phase timing', () => {
    const exec = Execution.initial();
    const now = new Date();
    const end = new Date(now.getTime() + 25 * 60 * 1000);
    exec.phase_started_at = now;
    exec.phase_ends_at = end;
    expect(exec.phase_started_at).toBe(now);
    expect(exec.phase_ends_at).toBe(end);
  });
});
