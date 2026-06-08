import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_ID_TOKEN, COOKIE_REFRESH_TOKEN } from '@/lib/cognito/cookies'
import { tryGetCognitoEnv } from '@/lib/cognito/env'
import { parseIdTokenClaims, refreshTokens } from '@/lib/cognito/server'

export async function proxy(request: NextRequest) {
  const protectedPaths = ['/dashboard', '/app']
  const isProtected = protectedPaths.some(
    (p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(`${p}/`)
  )
  if (!isProtected) return NextResponse.next({ request })

  const idToken = request.cookies.get(COOKIE_ID_TOKEN)?.value
  const refresh = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value
  const env = tryGetCognitoEnv()

  if (idToken) {
    try {
      const claims = parseIdTokenClaims(idToken)
      if (claims.exp * 1000 > Date.now()) {
        return NextResponse.next({ request })
      }
    } catch {
      // fall through to refresh
    }
  }

  if (refresh && env) {
    try {
      const next = await refreshTokens({ env, refreshToken: refresh })
      const claims = parseIdTokenClaims(next.id_token)
      const res = NextResponse.next({ request })
      res.cookies.set(COOKIE_ID_TOKEN, next.id_token, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: next.expires_in,
      })
      if (next.refresh_token) {
        res.cookies.set(COOKIE_REFRESH_TOKEN, next.refresh_token, {
          httpOnly: true,
          secure: true,
          sameSite: 'lax',
          path: '/',
          maxAge: 60 * 60 * 24 * 30,
        })
      }
      res.cookies.set('tastile_user_sub', claims.sub, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 30,
      })
      return res
    } catch {
      // fall through to redirect
    }
  }

  const url = new URL('/login', request.url)
  url.searchParams.set('error', idToken ? 'session_expired' : 'no_session')
  return NextResponse.redirect(url)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
