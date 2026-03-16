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

  it('should initialize with null pending_prompt_id', () => {
    const exec = Execution.initial();
    expect(exec.pending_prompt_id).toBeNull();
  });

  it('should support all PhaseKind enum values', () => {
    // Verify all enum values exist and are distinct
    const phaseKinds = [PhaseKind.Work, PhaseKind.Break, PhaseKind.Idle];
    const uniqueValues = new Set(phaseKinds);
    expect(uniqueValues.size).toBe(3);
    expect(phaseKinds).toContain('work');
    expect(phaseKinds).toContain('break');
    expect(phaseKinds).toContain('idle');
  });
});
