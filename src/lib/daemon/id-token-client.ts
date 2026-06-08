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
    const raw: unknown = await res.json()
    if (!isValidSession(raw)) {
      cache = null
      return null
    }
    cache = { session: raw, fetchedAt: now }
    return raw
  } catch {
    cache = null
    return null
  }
}

function isValidSession(raw: unknown): raw is CognitoSession {
  if (typeof raw !== 'object' || raw === null) return false
  const s = raw as Partial<CognitoSession>
  return (
    typeof s.idToken === 'string' &&
    typeof s.refreshToken === 'string' &&
    typeof s.sub === 'string' &&
    typeof s.exp === 'number'
  )
}

/** Get just the id_token. Convenience wrapper. */
export async function getIdTokenClient(): Promise<string | null> {
  const session = await getSessionClient()
  return session?.idToken ?? null
}

/** Clear the cache. The logout flow naturally empties this on the next page
 * load (the Hosted UI redirects away and back), so callers don't need to
 * invoke this on sign-out — but it's exposed for in-app state resets. */
export function clearSessionCache(): void {
  cache = null
}
