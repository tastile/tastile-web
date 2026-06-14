import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_ACCESS_TOKEN, COOKIE_ID_TOKEN, COOKIE_REFRESH_TOKEN, COOKIE_USER_SUB } from '@/lib/cognito/cookies'
import { tryGetCognitoEnv } from '@/lib/cognito/env'
import { parseIdTokenClaims, refreshTokens } from '@/lib/cognito/server'
import { resolveCanonicalHostRedirect } from '@/lib/host-routing'

export default async function middleware(request: NextRequest) {
  const redirectHost = resolveCanonicalHostRedirect(
    request.headers.get('host') ?? '',
    request.nextUrl.pathname,
  )
  if (redirectHost) {
    const url = request.nextUrl.clone()
    url.hostname = redirectHost
    url.protocol = 'https:'
    url.port = ''
    return NextResponse.redirect(url, 308)
  }

  const protectedPaths = ['/dashboard', '/app']
  const isProtected = protectedPaths.some(
    (p) => request.nextUrl.pathname === p || request.nextUrl.pathname.startsWith(`${p}/`)
  )
  if (!isProtected) return NextResponse.next({ request })

  const idToken = request.cookies.get(COOKIE_ID_TOKEN)?.value
  const refresh = request.cookies.get(COOKIE_REFRESH_TOKEN)?.value
  const env = tryGetCognitoEnv()

  // Local dev: when E2E bypass is enabled we skip the Cognito cookie check
  // entirely so the dashboard can talk to a local daemon (which has its own
  // TASTILE_BYPASS_AUTH) without needing a live session. Server-only flag
  // intentionally — the public NEXT_PUBLIC_* variant does not bypass here.
  if (process.env.E2E_BYPASS_AUTH === '1') {
    return NextResponse.next({ request })
  }

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
      res.cookies.set(COOKIE_ACCESS_TOKEN, next.access_token, {
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
      res.cookies.set(COOKIE_USER_SUB, claims.sub, {
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
