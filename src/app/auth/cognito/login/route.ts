import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_OAUTH_STATE, COOKIE_PKCE_VERIFIER } from '@/lib/cognito/cookies'
import { tryGetCognitoEnv } from '@/lib/cognito/env'
import { generatePkcePair, generateState } from '@/lib/cognito/pkce'

export async function GET(request: NextRequest) {
  const env = tryGetCognitoEnv()
  if (!env) {
    return NextResponse.redirect(new URL('/login?error=cognito_not_configured', request.url))
  }
  const { codeVerifier, codeChallenge } = await generatePkcePair()
  const state = generateState()

  const url = new URL(`${env.hostedUiBaseUrl}/oauth2/authorize`)
  url.searchParams.set('client_id', env.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('redirect_uri', env.callbackUrl)
  url.searchParams.set('code_challenge', codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', state)

  const res = NextResponse.redirect(url)
  res.cookies.set(COOKIE_PKCE_VERIFIER, codeVerifier, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  res.cookies.set(COOKIE_OAUTH_STATE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  })
  return res
}
