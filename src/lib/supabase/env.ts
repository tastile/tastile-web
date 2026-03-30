export interface SupabaseEnv {
  url: string
  publishableKey: string
  appUrl: string | null
}

export function tryGetSupabaseEnv(): SupabaseEnv | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim()
  const appUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL)

  if (!url || !publishableKey) {
    return null
  }

  return { url, publishableKey, appUrl }
}

export function getSupabaseEnv() {
  const env = tryGetSupabaseEnv()
  if (!env) {
    throw new Error('Missing Supabase environment configuration')
  }
  return env
}

export function buildSupabaseCallbackUrl(currentOrigin?: string): string {
  const configuredAppUrl = normalizeAppUrl(process.env.NEXT_PUBLIC_APP_URL)
  const baseUrl = configuredAppUrl ?? normalizeAppUrl(currentOrigin) ?? currentOrigin

  if (!baseUrl) {
    throw new Error('Missing application URL for Supabase callback')
  }

  return `${baseUrl.replace(/\/$/, '')}/auth/callback`
}

function normalizeAppUrl(raw: string | undefined): string | null {
  const trimmed = raw?.trim()
  if (!trimmed) {
    return null
  }

  return trimmed.replace(/\/$/, '')
}
