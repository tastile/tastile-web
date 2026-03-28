'use client'

import { Header } from './Header'
import { LeftTabs } from './LeftTabs'
import { RightSidebar } from './RightSidebar'
import { MobileBottomTabs } from './MobileBottomTabs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { PendingPrompt, PromptAction } from '@/lib/domain/execution'
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
    pendingPrompt?: PendingPrompt | null
  }
}

const RAIL_PINNED_KEY = 'dashboard-left-rail-pinned'
const DEFAULT_PROMPT_EXTENSION_MINUTES = 5

export function AppShell({ children, rightSidebar, quickCreatePanel, executionState }: AppShellProps) {
  const { execute } = useExecutionEngineContext()
  const [showSidebar, setShowSidebar] = useState(true)
  const [handlingPromptAction, setHandlingPromptAction] = useState(false)
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
    <div className="flex h-screen flex-col bg-surface-0">
      <GlobalPromptBanner
        prompt={executionState?.pendingPrompt ?? null}
        onDismiss={() => {
          const prompt = executionState?.pendingPrompt
          if (!prompt) return
          void execute({ type: 'clear_prompt', prompt_id: prompt.promptId, reason: 'dismissed' }, Actor.human('self'))
        }}
        onAction={(action) => {
          const prompt = executionState?.pendingPrompt
          if (!prompt || handlingPromptAction) return
          void (async () => {
            setHandlingPromptAction(true)
            try {
              const command = toPromptActionCommand(action, prompt)
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

      {/* Header */}
      <div className="p-3">
        <Header
          railPinned={railPinned}
          onToggleRail={() => setRailPinned(prev => !prev)}
          executionState={executionState}
        />
      </div>

      {/* Main Layout */}
      <div className="flex flex-1 gap-3 overflow-hidden px-3 pb-3">
        <div className="hidden lg:block">
          <LeftTabs pinnedOpen={railPinned} />
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-auto rounded-2xl bg-surface-elevated p-6">
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
        className="fixed bottom-6 right-0 z-50 hidden h-12 w-10 items-center justify-center rounded-l-xl bg-surface-elevated text-foreground-muted transition-all hover:bg-surface-2 hover:text-foreground lg:flex"
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
  prompt: PendingPrompt
): Command | null {
  const tileId = prompt.tileId
  if (action === 'dismiss') return null
  if (action === 'start_tile' && tileId) {
    return { type: 'start_tile', tile_id: tileId, started_at: new Date(), source: 'prompt' }
  }
  if (action === 'complete_tile' && tileId) {
    return { type: 'complete_tile', tile_id: tileId, completed_at: new Date(), next_tile_id: null }
  }
  if (action === 'defer_tile' && tileId) {
    return { type: 'defer_tile', tile_id: tileId, deferred_at: new Date(), next_start_at: null }
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
  return null
}
