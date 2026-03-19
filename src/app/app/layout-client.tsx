'use client'

import { AppShell } from '@/components/layout/AppShell'
import { QuickTileCreate } from '@/components/tiles/QuickTileCreate'
import { useEffect } from 'react'
import { useQuickCreateStore } from '@/lib/stores/quick-create-store'

export function AppLayoutClient({
  children,
}: {
  children: React.ReactNode
}) {
  const { open } = useQuickCreateStore()

  // Keyboard shortcut: Cmd+N
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault()
        open()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open])

  return (
    <AppShell quickCreatePanel={<QuickTileCreate />}>
      {children}
    </AppShell>
  )
}
