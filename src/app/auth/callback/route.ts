import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import { setAuthCookies } from '@/lib/cognito/cookies'
import { tryGetCognitoEnv } from '@/lib/cognito/env'
import { exchangeCodeForTokens, parseIdTokenClaims } from '@/lib/cognito/server'

export async function GET(request: NextRequest) {
  const env = tryGetCognitoEnv()
  if (!env) {
    return NextResponse.redirect(new URL('/login?error=cognito_not_configured', request.url))
  }

  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const returnedState = searchParams.get('state')
  const next = searchParams.get('next') ?? '/dashboard'

  if (!code || !returnedState) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const jar = await cookies()
  const expectedState = jar.get('tastile_oauth_state')?.value
  const codeVerifier = jar.get('tastile_pkce_verifier')?.value

  if (!expectedState || expectedState !== returnedState || !codeVerifier) {
    return NextResponse.redirect(`${origin}/login?error=state_mismatch`)
  }

  try {
    const tokens = await exchangeCodeForTokens({ env, code, codeVerifier })
    const claims = parseIdTokenClaims(tokens.id_token)
    await setAuthCookies({
      idToken: tokens.id_token,
      refreshToken: tokens.refresh_token,
      sub: claims.sub,
      expiresIn: tokens.expires_in,
    })
    // Clear PKCE cookies.
    jar.set('tastile_oauth_state', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
    jar.set('tastile_pkce_verifier', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
    return NextResponse.redirect(`${origin}${next}`)
  } catch (e) {
    return NextResponse.redirect(
      `${origin}/login?error=auth_failed&detail=${encodeURIComponent(String(e))}`
    )
  }
}
