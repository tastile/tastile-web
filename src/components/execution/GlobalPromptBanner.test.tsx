/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GlobalPromptBanner } from './GlobalPromptBanner'
import { AppShell } from '@/components/layout/AppShell'
import { TileId } from '@/lib/domain/ids'

vi.mock('@/lib/i18n/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}))
vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
    },
  }),
}))

const executeMock = vi.fn()
vi.mock('@/lib/hooks/execution-engine-context', () => ({
  useExecutionEngineContext: () => ({
    execute: executeMock,
    state: { execution: { activeTileId: null } },
    loading: false,
  }),
}))

describe('GlobalPromptBanner', () => {
  it('renders prompt details and action buttons', () => {
    render(
      <GlobalPromptBanner
        prompt={{
          promptId: 'p1',
          tileId: null,
          kind: 'start_tile',
          severity: 'soft',
          title: 'Resume Deep work',
          body: 'Draft the outline',
          why: 'This tile was already in flight and is the best resume candidate.',
          suggestedMinutes: 15,
          reasons: ['resume_in_flight'],
          actions: ['start_tile', 'defer_tile', 'dismiss'],
          scheduledAt: new Date('2026-03-26T03:00:00.000Z'),
          reason: 'resume',
        }}
        onDismiss={vi.fn()}
      />
    )

    expect(screen.getByText('Resume Deep work')).toBeTruthy()
    expect(screen.getByText('Draft the outline')).toBeTruthy()
    expect(screen.getByText('This tile was already in flight and is the best resume candidate.')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'tiles.actions.start' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'tiles.actions.defer' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'common.close' })).toBeTruthy()
  })

  it('does not render dismiss control when the prompt is not dismissible', () => {
    render(
      <GlobalPromptBanner
        prompt={{
          promptId: 'p2',
          tileId: TileId.fromString('tile-2'),
          kind: 'end_tile',
          severity: 'critical',
          title: 'Close Deep work',
          body: 'Decide whether to complete, extend, or defer the current tile.',
          why: 'The current work phase reached its planned end.',
          suggestedMinutes: null,
          reasons: ['work_phase_expired'],
          actions: ['complete_tile', 'extend_phase', 'defer_tile'],
          scheduledAt: new Date('2026-03-26T03:10:00.000Z'),
          reason: 'work_phase_expired',
        }}
      />
    )

    expect(screen.queryByRole('button', { name: 'common.close' })).toBeNull()
  })

  it('calls handlers for prompt actions', () => {
    const onAction = vi.fn()
    const onDismiss = vi.fn()
    render(
      <GlobalPromptBanner
        prompt={{
          promptId: 'p1',
          tileId: null,
          kind: 'end_tile',
          severity: 'critical',
          suggestedMinutes: null,
          reasons: ['work_phase_expired'],
          actions: ['complete_tile', 'extend_phase', 'dismiss'],
          scheduledAt: new Date('2026-03-26T03:00:00.000Z'),
          reason: 'expired',
        }}
        onAction={onAction}
        onDismiss={onDismiss}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'tiles.actions.complete' }))
    fireEvent.click(screen.getByRole('button', { name: 'prompt.actions.extend' }))
    fireEvent.click(screen.getByRole('button', { name: 'common.close' }))

    expect(onAction).toHaveBeenCalledWith('complete_tile')
    expect(onAction).toHaveBeenCalledWith('extend_phase')
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('AppShell sends prompt action command then clears prompt', async () => {
    executeMock.mockReset()
    executeMock.mockResolvedValue(undefined)
    const localStorageMock = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
    }
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      configurable: true,
    })

    render(
      <AppShell
        executionState={{
          activeTileTitle: 'Deep Work',
          phaseKind: 'work',
          phaseStartedAt: new Date('2026-03-26T09:00:00.000Z'),
          phaseEndsAt: new Date('2026-03-26T09:25:00.000Z'),
          syncStatus: {
            inProgress: false,
            lastAttemptAt: null,
            lastSuccessAt: null,
            lastError: null,
            lastResult: { uploaded: 1, downloaded: 2, applied: 2, failed: 0, conflicts: 0 },
          },
          pendingPrompt: {
            promptId: 'p-start',
            tileId: TileId.fromString('tile-1'),
            kind: 'start_tile',
            severity: 'soft',
            suggestedMinutes: 25,
            reasons: ['resume_in_flight'],
            actions: ['start_tile', 'dismiss'],
            scheduledAt: new Date('2026-03-26T09:00:00.000Z'),
            reason: 'resume',
          },
        }}
      >
        <div>Child</div>
      </AppShell>
    )

    fireEvent.click(screen.getByRole('button', { name: 'tiles.actions.start' }))
    expect(screen.getByTestId('sync-status-indicator').textContent).toContain('d:2')

    await waitFor(() => expect(executeMock).toHaveBeenCalledTimes(2))

    expect(executeMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ type: 'start_tile', tile_id: 'tile-1', source: 'prompt' }),
      expect.objectContaining({ type: 'human' })
    )
    expect(executeMock).toHaveBeenNthCalledWith(
      2,
      { type: 'clear_prompt', prompt_id: 'p-start', reason: 'actioned' },
      expect.objectContaining({ type: 'human' })
    )
  })

  it('AppShell renders sync indicator for in-progress and error statuses', () => {
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: vi.fn(() => null), setItem: vi.fn() },
      configurable: true,
    })

    const { rerender } = render(
      <AppShell
        executionState={{
          activeTileTitle: 'Deep Work',
          phaseKind: 'work',
          phaseStartedAt: new Date('2026-03-26T09:00:00.000Z'),
          phaseEndsAt: new Date('2026-03-26T09:25:00.000Z'),
          syncStatus: {
            inProgress: true,
            lastAttemptAt: null,
            lastSuccessAt: null,
            lastError: null,
            lastResult: null,
          },
          pendingPrompt: null,
        }}
      >
        <div>Child</div>
      </AppShell>
    )

    expect(screen.getByTestId('sync-status-indicator').textContent).toContain('sync in progress')

    rerender(
      <AppShell
        executionState={{
          activeTileTitle: 'Deep Work',
          phaseKind: 'work',
          phaseStartedAt: new Date('2026-03-26T09:00:00.000Z'),
          phaseEndsAt: new Date('2026-03-26T09:25:00.000Z'),
          syncStatus: {
            inProgress: false,
            lastAttemptAt: null,
            lastSuccessAt: null,
            lastError: 'connection failed',
            lastResult: null,
          },
          pendingPrompt: null,
        }}
      >
        <div>Child</div>
      </AppShell>
    )

    expect(screen.getByTestId('sync-status-indicator').textContent).toContain('sync error: connection failed')
  })

  it('AppShell maps action without tileId to dismissed clear prompt only', async () => {
    executeMock.mockReset()
    executeMock.mockResolvedValue(undefined)
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: vi.fn(() => null), setItem: vi.fn() },
      configurable: true,
    })

    render(
      <AppShell
        executionState={{
          activeTileTitle: 'Deep Work',
          phaseKind: 'work',
          phaseStartedAt: new Date('2026-03-26T09:00:00.000Z'),
          phaseEndsAt: new Date('2026-03-26T09:25:00.000Z'),
          pendingPrompt: {
            promptId: 'p-missing',
            tileId: null,
            kind: 'start_tile',
            severity: 'soft',
            suggestedMinutes: 25,
            reasons: ['resume_in_flight'],
            actions: ['start_tile', 'dismiss'],
            scheduledAt: new Date('2026-03-26T09:00:00.000Z'),
            reason: 'resume',
          },
        }}
      >
        <div>Child</div>
      </AppShell>
    )

    fireEvent.click(screen.getByRole('button', { name: 'tiles.actions.start' }))
    await waitFor(() => expect(executeMock).toHaveBeenCalledTimes(1))
    expect(executeMock).toHaveBeenCalledWith(
      { type: 'clear_prompt', prompt_id: 'p-missing', reason: 'dismissed' },
      expect.objectContaining({ type: 'human' })
    )
  })

  it('AppShell uses suggested prompt minutes when extending a phase', async () => {
    executeMock.mockReset()
    executeMock.mockResolvedValue(undefined)
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: vi.fn(() => null), setItem: vi.fn() },
      configurable: true,
    })

    render(
      <AppShell
        executionState={{
          activeTileTitle: 'Deep Work',
          phaseKind: 'work',
          phaseStartedAt: new Date('2026-03-26T09:00:00.000Z'),
          phaseEndsAt: new Date('2026-03-26T09:25:00.000Z'),
          pendingPrompt: {
            promptId: 'p-extend',
            tileId: TileId.fromString('tile-extend'),
            kind: 'end_tile',
            severity: 'critical',
            suggestedMinutes: 15,
            reasons: ['work_phase_expired'],
            actions: ['extend_phase', 'dismiss'],
            scheduledAt: new Date('2026-03-26T09:25:00.000Z'),
            reason: 'expired',
          },
        }}
      >
        <div>Child</div>
      </AppShell>
    )

    fireEvent.click(screen.getByRole('button', { name: 'prompt.actions.extend' }))

    await waitFor(() => expect(executeMock).toHaveBeenCalledTimes(2))
    expect(executeMock).toHaveBeenNthCalledWith(
      1,
      { type: 'extend_phase', tile_id: 'tile-extend', delta_min: 15 },
      expect.objectContaining({ type: 'human' })
    )
  })
})
