'use client'

export interface CognitoSession {
  idToken: string
  refreshToken: string
  sub: string
  /** Seconds since epoch */
  exp: number
}

interface CacheEntry {
  session: CognitoSession
  /** Milliseconds since epoch */
  fetchedAt: number
}

const REFRESH_BUFFER_MS = 60_000 // refresh 1 min before exp
const SESSION_ENDPOINT = '/api/auth/session'

let cache: CacheEntry | null = null

/**
 * Fetch the current Cognito session. Cached in memory; refreshes when
 * the id_token is within REFRESH_BUFFER_MS of expiry, or after a 401.
 */
export async function getSessionClient(force = false): Promise<CognitoSession | null> {
  const now = Date.now()
  if (!force && cache) {
    const expiresAtMs = cache.session.exp * 1000
    if (expiresAtMs - now > REFRESH_BUFFER_MS) {
      return cache.session
    }
  }
  try {
    const res = await fetch(SESSION_ENDPOINT, {
      method: 'GET',
      credentials: 'same-origin',
      cache: 'no-store',
    })
    if (!res.ok) {
      cache = null
      return null
    }
    const session = (await res.json()) as CognitoSession
    cache = { session, fetchedAt: now }
    return session
  } catch {
    cache = null
    return null
  }
}

/** Get just the id_token. Convenience wrapper. */
export async function getIdTokenClient(): Promise<string | null> {
  const session = await getSessionClient()
  return session?.idToken ?? null
}

/** Clear the cache (used after a 401 forces a refresh). */
export function clearSessionCache(): void {
  cache = null
}
