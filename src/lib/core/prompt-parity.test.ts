import { describe, expect, it } from 'vitest'
import { AppState } from './state'
import { reduce } from './reducer'
import { Event } from './event'

describe('prompt parity reducer behavior', () => {
  it('stores pending prompt on prompt_scheduled', () => {
    const state = AppState.initial()
    const scheduledAt = new Date('2026-03-26T03:00:00.000Z')

    reduce(
      state,
      {
        type: 'prompt_scheduled',
        prompt_id: 'prompt-1',
        tile_id: null,
        scheduled_at: scheduledAt,
        reason: 'resume',
        kind: 'start_tile',
        severity: 'soft',
        suggested_minutes: 15,
        reasons: ['resume_in_flight'],
        actions: ['start_tile', 'defer_tile', 'dismiss'],
      } satisfies Event
    )

    expect(state.execution.pendingPrompt).toEqual({
      promptId: 'prompt-1',
      tileId: null,
      kind: 'start_tile',
      severity: 'soft',
      suggestedMinutes: 15,
      reasons: ['resume_in_flight'],
      actions: ['start_tile', 'defer_tile', 'dismiss'],
      scheduledAt,
      reason: 'resume',
    })
  })

  it('clears pending prompt on prompt_cleared', () => {
    const state = AppState.initial()

    state.execution.pendingPrompt = {
      promptId: 'prompt-1',
      tileId: null,
      kind: 'start_tile',
      severity: 'soft',
      suggestedMinutes: 15,
      reasons: ['resume_in_flight'],
      actions: ['start_tile', 'defer_tile', 'dismiss'],
      scheduledAt: new Date('2026-03-26T03:00:00.000Z'),
      reason: 'resume',
    }

    reduce(
      state,
      {
        type: 'prompt_cleared',
        prompt_id: 'prompt-1',
        cleared_at: new Date('2026-03-26T03:01:00.000Z'),
        reason: 'handled',
      } satisfies Event
    )

    expect(state.execution.pendingPrompt).toBeNull()
  })
})
