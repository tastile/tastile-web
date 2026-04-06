/** @vitest-environment jsdom */

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { GlobalPromptBanner } from './GlobalPromptBanner'
import { AppShell } from '@/components/layout/AppShell'
import { TileId } from '@/lib/domain/ids'

vi.mock('@/lib/i18n/use-translation', () => ({
  useTranslation: () => ({ t: (key: string) => key, locale: 'ja' as const }),
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

  it('opens defer options first then sends defer action with selected minutes', () => {
    const onAction = vi.fn()
    render(
      <GlobalPromptBanner
        prompt={{
          promptId: 'p-defer-menu',
          tileId: TileId.fromString('tile-1'),
          kind: 'start_tile',
          severity: 'soft',
          suggestedMinutes: null,
          reasons: ['user_requested'],
          actions: ['defer_tile', 'dismiss'],
          scheduledAt: new Date('2026-03-26T03:00:00.000Z'),
          reason: 'defer',
        }}
        onAction={onAction}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: 'tiles.actions.defer' }))
    expect(onAction).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: '30分' }))
    expect(onAction).toHaveBeenCalledWith('defer_tile', { deferMinutes: 30 })
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

  it('AppShell does not render sync indicator text', () => {
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

    expect(screen.queryByTestId('sync-status-indicator')).toBeNull()

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

    expect(screen.queryByTestId('sync-status-indicator')).toBeNull()
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

  it('AppShell maps defer prompt action to defer_tile with computed next_start_at', async () => {
    executeMock.mockReset()
    executeMock.mockResolvedValue(undefined)
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: vi.fn(() => null), setItem: vi.fn() },
      configurable: true,
    })
    const clickedAt = Date.now()

    render(
      <AppShell
        executionState={{
          activeTileTitle: 'Deep Work',
          phaseKind: 'work',
          phaseStartedAt: new Date('2026-03-26T09:00:00.000Z'),
          phaseEndsAt: new Date('2026-03-26T09:25:00.000Z'),
          pendingPrompt: {
            promptId: 'p-defer',
            tileId: TileId.fromString('tile-defer'),
            kind: 'end_tile',
            severity: 'soft',
            suggestedMinutes: 30,
            reasons: ['work_phase_expired'],
            actions: ['defer_tile', 'dismiss'],
            scheduledAt: new Date('2026-03-26T09:25:00.000Z'),
            reason: 'work_phase_expired',
          },
        }}
      >
        <div>Child</div>
      </AppShell>
    )

    fireEvent.click(screen.getByRole('button', { name: 'tiles.actions.defer' }))
    expect(executeMock).toHaveBeenCalledTimes(0)
    fireEvent.click(screen.getByRole('button', { name: '30分' }))
    await waitFor(() => expect(executeMock).toHaveBeenCalledTimes(2))

    const [firstCommand] = executeMock.mock.calls[0]
    expect(firstCommand).toMatchObject({ type: 'defer_tile', tile_id: 'tile-defer' })
    expect(firstCommand.deferred_at).toBeInstanceOf(Date)
    expect(firstCommand.next_start_at).toBeInstanceOf(Date)
    const deferDeltaMin = Math.floor((firstCommand.next_start_at.getTime() - clickedAt) / 60000)
    expect(deferDeltaMin).toBeGreaterThanOrEqual(29)
    expect(deferDeltaMin).toBeLessThanOrEqual(30)
  })

  it('AppShell sends respond_startup_recovery confirm_continue then clears prompt', async () => {
    executeMock.mockReset()
    executeMock.mockResolvedValue(undefined)
    Object.defineProperty(window, 'localStorage', {
      value: { getItem: vi.fn(() => null), setItem: vi.fn() },
      configurable: true,
    })

    render(
      <AppShell
        executionState={{
          activeTileTitle: 'Recovery tile',
          phaseKind: 'work',
          phaseStartedAt: new Date('2026-03-26T09:00:00.000Z'),
          phaseEndsAt: new Date('2026-03-26T09:25:00.000Z'),
          pendingPrompt: {
            promptId: 'p-recovery',
            tileId: TileId.fromString('tile-recovery'),
            kind: 'start_tile',
            severity: 'critical',
            suggestedMinutes: null,
            reasons: ['startup_recovery'],
            actions: ['confirm_continue', 'dismiss'],
            scheduledAt: new Date('2026-03-26T09:25:00.000Z'),
            reason: 'startup_recovery',
          },
        }}
      >
        <div>Child</div>
      </AppShell>
    )

    fireEvent.click(screen.getByRole('button', { name: 'prompt.actions.confirmContinue' }))
    await waitFor(() => expect(executeMock).toHaveBeenCalledTimes(2))
    expect(executeMock).toHaveBeenNthCalledWith(
      1,
      {
        type: 'respond_startup_recovery',
        prompt_id: 'p-recovery',
        tile_id: 'tile-recovery',
        action: 'confirm_continue',
        stop_at: null,
      },
      expect.objectContaining({ type: 'human' })
    )
  })
})
