export interface SupabaseEnv {
  url: string
  publishableKey: string
}

export function tryGetSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()

  if (!url || !publishableKey) {
    return null
  }

  return { url, publishableKey }
}

export function getSupabaseEnv() {
  const env = tryGetSupabaseEnv()
  if (!env) {
    throw new Error('Missing Supabase environment configuration')
  }
  return env
}
