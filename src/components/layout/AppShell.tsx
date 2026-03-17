'use client'

import { useIsDesktop } from '@/lib/hooks/use-media-query'
import { Header } from './Header'
import { LeftTabs } from './LeftTabs'
import { RightSidebar } from './RightSidebar'
import { MobileBottomTabs } from './MobileBottomTabs'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'

interface AppShellProps {
  children: React.ReactNode
  rightSidebar?: React.ReactNode
  quickCreatePanel?: React.ReactNode
  executionState?: {
    activeTileTitle: string | null
    phaseKind: 'work' | 'break' | 'idle'
    phaseStartedAt: Date | null
    phaseEndsAt: Date | null
  }
}

const RAIL_PINNED_KEY = 'dashboard-left-rail-pinned'

export function AppShell({ children, rightSidebar, quickCreatePanel, executionState }: AppShellProps) {
  const isDesktop = useIsDesktop()
  const [showSidebar, setShowSidebar] = useState(true)
  const [railPinned, setRailPinned] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem(RAIL_PINNED_KEY)
    setRailPinned(stored === '1')
  }, [])

  useEffect(() => {
    window.localStorage.setItem(RAIL_PINNED_KEY, railPinned ? '1' : '0')
  }, [railPinned])

  return (
    <div className="flex h-screen flex-col bg-surface-0">
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
        {/* Left Tabs - Desktop only */}
        {isDesktop && <LeftTabs pinnedOpen={railPinned} />}

        {/* Main Content */}
        <main className="flex-1 overflow-auto rounded-2xl bg-surface-elevated p-6">
          <div className="mx-auto w-full max-w-6xl">
            {children}
          </div>
        </main>

        {isDesktop ? quickCreatePanel : null}

        {/* Right Sidebar - Desktop only */}
        {isDesktop && showSidebar && (rightSidebar ?? <RightSidebar nextTile={null} timelineTiles={[]} loading={false} />)}
      </div>

      {/* Mobile Bottom Tabs */}
      {!isDesktop && <MobileBottomTabs />}

      {!isDesktop ? quickCreatePanel : null}

      {/* Sidebar Toggle - Fixed Bottom Right */}
      {isDesktop && (
        <button
          onClick={() => setShowSidebar(!showSidebar)}
          className="fixed bottom-6 right-0 z-50 flex h-12 w-10 items-center justify-center rounded-l-xl bg-surface-elevated text-foreground-muted transition-all hover:bg-surface-2 hover:text-foreground"
          style={{
            transform: showSidebar ? 'translateX(0)' : 'translateX(4px)',
          }}
        >
          {showSidebar ? <ChevronRight className="h-5 w-5" /> : <ChevronLeft className="h-5 w-5" />}
        </button>
      )}
    </div>
  )
}
