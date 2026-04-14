'use client'

import { Header } from './Header'
import { LeftTabs } from './LeftTabs'
import { RightSidebar } from './RightSidebar'
import { MobileBottomTabs } from './MobileBottomTabs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { ExecutionSyncStatus, PendingPrompt, PromptAction } from '@/lib/domain/execution'
import { GlobalPromptBanner } from '@/components/execution/GlobalPromptBanner'
import { useExecutionEngineContext } from '@/lib/hooks/execution-engine-context'
import { Actor } from '@/lib/domain/actor'
import { Command } from '@/lib/core/command'

interface AppShellProps {
  children: React.ReactNode
  rightSidebar?: React.ReactNode
  quickCreatePanel?: React.ReactNode
  executionState?: {
    activeTileTitle: string | null
    phaseKind: 'work' | 'break' | 'idle'
    phaseStartedAt: Date | null
    phaseEndsAt: Date | null
    nextActionableStartAt?: Date | null
    pendingPrompt?: PendingPrompt | null
    syncStatus?: ExecutionSyncStatus | null
  }
}

const RAIL_PINNED_KEY = 'dashboard-left-rail-pinned'
const DEFAULT_PROMPT_EXTENSION_MINUTES = 5
const DEFAULT_PROMPT_DEFER_MINUTES = 30

export function AppShell({ children, rightSidebar, quickCreatePanel, executionState }: AppShellProps) {
  const { execute } = useExecutionEngineContext()
  const [showSidebar, setShowSidebar] = useState(true)
  const [handlingPromptAction, setHandlingPromptAction] = useState(false)
  const [startupRecoveryStopAt, setStartupRecoveryStopAt] = useState(() => toLocalDateTimeValue(new Date()))
  const [railPinned, setRailPinned] = useState(() => {
    if (typeof window === 'undefined') {
      return false
    }
    return window.localStorage.getItem(RAIL_PINNED_KEY) === '1'
  })

  useEffect(() => {
    window.localStorage.setItem(RAIL_PINNED_KEY, railPinned ? '1' : '0')
  }, [railPinned])

  return (
    <div className="flex h-screen flex-col bg-background">
      {executionState?.pendingPrompt ? (
        <div className="fixed inset-0 z-[68] bg-black/25 backdrop-blur-[1px]" aria-hidden="true" />
      ) : null}
      <GlobalPromptBanner
        prompt={executionState?.pendingPrompt ?? null}
        onDismiss={() => {
          const prompt = executionState?.pendingPrompt
          if (!prompt) return
          void execute({ type: 'clear_prompt', prompt_id: prompt.promptId, reason: 'dismissed' }, Actor.human('self'))
        }}
        onAction={(action, payload) => {
          const prompt = executionState?.pendingPrompt
          if (!prompt || handlingPromptAction) return
          void (async () => {
            setHandlingPromptAction(true)
            try {
              const command = toPromptActionCommand(action, prompt, startupRecoveryStopAt, payload?.deferMinutes)
              if (command) {
                await execute(command, Actor.human('self'))
                await execute({ type: 'clear_prompt', prompt_id: prompt.promptId, reason: 'actioned' }, Actor.human('self'))
              } else if (action === 'dismiss') {
                await execute({ type: 'clear_prompt', prompt_id: prompt.promptId, reason: 'dismissed' }, Actor.human('self'))
              } else {
                await execute({ type: 'clear_prompt', prompt_id: prompt.promptId, reason: 'dismissed' }, Actor.human('self'))
              }
            } finally {
              setHandlingPromptAction(false)
            }
          })()
        }}
      />
      {executionState?.pendingPrompt?.actions.includes('confirm_stop_at') ? (
        <div className="fixed top-28 left-1/2 z-[69] w-[min(96vw,820px)] -translate-x-1/2 rounded-xl border border-border bg-surface-elevated p-3 shadow-[rgba(0,0,0,0.4)_0px_2px_4px] backdrop-blur">
          <label className="flex flex-col gap-1 text-xs font-semibold text-foreground-muted">
            Stop at
            <input
              type="datetime-local"
              value={startupRecoveryStopAt}
              onChange={(event) => setStartupRecoveryStopAt(event.target.value)}
              className="themed-datetime-input rounded-lg border border-border bg-surface-0 px-3 py-2 text-sm text-foreground"
            />
          </label>
        </div>
      ) : null}

      {/* Header */}
      <div className="border-b border-border px-3 py-2">
        <Header
          railPinned={railPinned}
          onToggleRail={() => setRailPinned(prev => !prev)}
          executionState={executionState}
        />
      </div>

      {/* Main Layout */}
      <div className={`flex flex-1 gap-3 overflow-hidden px-3 py-3 ${executionState?.pendingPrompt ? 'pointer-events-none' : ''}`}>
        <div className="hidden lg:block">
          <LeftTabs pinnedOpen={railPinned} />
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-auto rounded-xl border border-border bg-surface-elevated p-6">
          <div className="mx-auto w-full max-w-6xl">
            {children}
          </div>
        </main>

        <div className="hidden lg:block">{quickCreatePanel}</div>

        <div className="hidden lg:block">
          {showSidebar && (rightSidebar ?? <RightSidebar nextTile={null} timelineItems={[]} />)}
        </div>
      </div>

      <MobileBottomTabs />

      <div className="lg:hidden">{quickCreatePanel}</div>

      {/* Sidebar Toggle - Fixed Bottom Right */}
      <button
        onClick={() => setShowSidebar(!showSidebar)}
        className="fixed bottom-6 right-0 z-50 hidden h-12 w-10 items-center justify-center rounded-l-xl border border-border bg-surface-elevated text-foreground-muted transition-all hover:bg-surface-2 hover:text-foreground lg:flex"
        style={{
          transform: showSidebar ? 'translateX(0)' : 'translateX(4px)',
        }}
      >
        {showSidebar ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
      </button>
    </div>
  )
}

function toPromptActionCommand(
  action: PromptAction,
  prompt: PendingPrompt,
  startupRecoveryStopAt: string,
  deferMinutes?: number
): Command | null {
  const tileId = prompt.tileId
  if (action === 'dismiss') return null
  if (action === 'start_tile' && tileId) {
    return { type: 'start_tile', tile_id: tileId, started_at: new Date(), source: 'prompt' }
  }
  if (action === 'complete_tile' && tileId) {
    return {
      type: 'complete_tile',
      tile_id: tileId,
      completed_at: new Date(),
      next_tile_id: null,
      scope: 'tile',
    }
  }
  if (action === 'complete_phase' && tileId) {
    return {
      type: 'complete_tile',
      tile_id: tileId,
      completed_at: new Date(),
      next_tile_id: null,
      scope: 'phase',
    }
  }
  if (action === 'start_break_parallel' || action === 'start_break_split') {
    return { type: 'start_break', linked_tile_id: tileId, break_min: DEFAULT_PROMPT_EXTENSION_MINUTES, reason: action }
  }
  if (action === 'start_break_split_and_extend') {
    return {
      type: 'start_break',
      linked_tile_id: tileId,
      break_min: prompt.suggestedMinutes ?? DEFAULT_PROMPT_EXTENSION_MINUTES,
      reason: action,
    }
  }
  if (action === 'complete_phase' && tileId) {
    return { type: 'complete_tile', tile_id: tileId, completed_at: new Date(), next_tile_id: null }
  }
  if (action === 'start_break_parallel' || action === 'start_break_split') {
    return { type: 'start_break', linked_tile_id: tileId, break_min: DEFAULT_PROMPT_EXTENSION_MINUTES, reason: action }
  }
  if (action === 'start_break_split_and_extend') {
    return {
      type: 'start_break',
      linked_tile_id: tileId,
      break_min: prompt.suggestedMinutes ?? DEFAULT_PROMPT_EXTENSION_MINUTES,
      reason: action,
    }
  }
  if (action === 'defer_tile' && tileId) {
    return {
      type: 'defer_tile',
      tile_id: tileId,
      deferred_at: new Date(),
      next_start_at: resolvePromptDeferStartAt(prompt, deferMinutes),
    }
  }
  if (action === 'extend_phase' && tileId) {
    return {
      type: 'extend_phase',
      tile_id: tileId,
      delta_min: prompt.suggestedMinutes ?? DEFAULT_PROMPT_EXTENSION_MINUTES,
    }
  }
  if (action === 'end_break') {
    return { type: 'end_break', tile_id: tileId, ended_at: new Date() }
  }
  if (
    (action === 'confirm_continue' ||
      action === 'confirm_stop_at' ||
      action === 'confirm_executed' ||
      action === 'confirm_skipped') &&
    tileId
  ) {
    return {
      type: 'respond_startup_recovery',
      prompt_id: prompt.promptId,
      tile_id: tileId,
      action,
      stop_at: action === 'confirm_stop_at' ? parseLocalDateTime(startupRecoveryStopAt) : null,
    }
  }
  return null
}

function parseLocalDateTime(value: string): Date | null {
  const trimmed = value.trim()
  if (!trimmed) return null
  const parsed = new Date(trimmed)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function toLocalDateTimeValue(date: Date): string {
  const pad2 = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`
}

function resolvePromptDeferStartAt(prompt: PendingPrompt, explicitDeferMinutes?: number): Date {
  const deferMin = typeof explicitDeferMinutes === 'number' && explicitDeferMinutes > 0
    ? explicitDeferMinutes
    : typeof prompt.suggestedMinutes === 'number' && prompt.suggestedMinutes > 0
      ? prompt.suggestedMinutes
      : DEFAULT_PROMPT_DEFER_MINUTES
  return new Date(Date.now() + deferMin * 60 * 1000)
}
