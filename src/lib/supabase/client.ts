import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseEnv } from './env'
import type { SupabaseClient } from '@supabase/supabase-js'

export function createClient() {
  const { url, publishableKey } = getSupabaseEnv()
  return createBrowserClient(
    url,
    publishableKey
  )
}

export async function getBrowserAccessToken(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession()
  if (error) return null
  return data.session?.access_token ?? null
}
