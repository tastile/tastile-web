'use client'

import { createBrowserClient } from '@supabase/ssr'
import { createContext, useContext, useState } from 'react'
import { tryGetSupabaseEnv } from '@/lib/supabase/env'

const SupabaseContext = createContext<ReturnType<typeof createBrowserClient> | undefined>(undefined)

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const env = tryGetSupabaseEnv()
  const [supabase] = useState(() =>
    env
      ? createBrowserClient(
          env.url,
          env.publishableKey
        )
      : undefined
  )

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  )
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (!context) {
    throw new Error('useSupabase must be used within SupabaseProvider')
  }
  return context
}
