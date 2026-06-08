import { cookies } from 'next/headers'

export const COOKIE_ID_TOKEN = 'tastile_id_token'
export const COOKIE_REFRESH_TOKEN = 'tastile_refresh_token'
export const COOKIE_USER_SUB = 'tastile_user_sub'
export const COOKIE_PKCE_VERIFIER = 'tastile_pkce_verifier'
export const COOKIE_OAUTH_STATE = 'tastile_oauth_state'

const REFRESH_MAX_AGE = 60 * 60 * 24 * 30 // 30 days

export interface SetAuthCookiesArgs {
  idToken: string
  refreshToken: string | null
  sub: string
  expiresIn: number
}

export async function setAuthCookies(args: SetAuthCookiesArgs): Promise<void> {
  const jar = await cookies()
  const isProd = process.env.NODE_ENV === 'production'
  const baseOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
  }
  jar.set(COOKIE_ID_TOKEN, args.idToken, { ...baseOptions, maxAge: args.expiresIn })
  if (args.refreshToken) {
    jar.set(COOKIE_REFRESH_TOKEN, args.refreshToken, { ...baseOptions, maxAge: REFRESH_MAX_AGE })
  }
  jar.set(COOKIE_USER_SUB, args.sub, { ...baseOptions, maxAge: REFRESH_MAX_AGE })
}

export async function clearAuthCookies(): Promise<void> {
  const jar = await cookies()
  const isProd = process.env.NODE_ENV === 'production'
  const baseOptions = {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax' as const,
    path: '/',
    maxAge: 0,
  }
  for (const name of [COOKIE_ID_TOKEN, COOKIE_REFRESH_TOKEN, COOKIE_USER_SUB]) {
    jar.set(name, '', baseOptions)
  }
}

export async function getIdTokenFromCookies(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(COOKIE_ID_TOKEN)?.value ?? null
}

export async function getRefreshTokenFromCookies(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(COOKIE_REFRESH_TOKEN)?.value ?? null
}

export async function getUserSubFromCookies(): Promise<string | null> {
  const jar = await cookies()
  return jar.get(COOKIE_USER_SUB)?.value ?? null
}
