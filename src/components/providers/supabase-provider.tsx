'use client'

import { createBrowserClient } from '@supabase/ssr'
import { createContext, useContext, useState } from 'react'
import { tryGetSupabaseEnv } from '@/lib/supabase/env'

const SUPABASE_UNCONFIGURED = Symbol('SUPABASE_UNCONFIGURED')
type SupabaseContextValue = ReturnType<typeof createBrowserClient> | typeof SUPABASE_UNCONFIGURED

const SupabaseContext = createContext<SupabaseContextValue | undefined>(undefined)

export function SupabaseProvider({ children }: { children: React.ReactNode }) {
  const env = tryGetSupabaseEnv()
  const [supabase] = useState(() =>
    env
      ? createBrowserClient(
          env.url,
          env.publishableKey
        )
      : SUPABASE_UNCONFIGURED
  )

  return (
    <SupabaseContext.Provider value={supabase}>
      {children}
    </SupabaseContext.Provider>
  )
}

export const useSupabase = () => {
  const context = useContext(SupabaseContext)
  if (context === undefined) {
    throw new Error('useSupabase must be used within SupabaseProvider')
  }
  if (context === SUPABASE_UNCONFIGURED) {
    throw new Error('Supabase is not configured. Check the required environment variables.')
  }
  return context
}
