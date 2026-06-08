import { cookies } from 'next/headers'
import { COOKIE_ID_TOKEN } from '@/lib/cognito/cookies'
import type { AccessTokenProvider } from './client'

/** Server-side: read the id_token cookie. Returns null if missing. */
export async function getIdTokenServer(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(COOKIE_ID_TOKEN)?.value ?? null
}

/** Build an `AccessTokenProvider` for `DaemonClient`. */
export const idTokenProvider: AccessTokenProvider = async () => getIdTokenServer()
