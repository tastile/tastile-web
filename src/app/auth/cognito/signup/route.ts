import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE_OAUTH_NEXT, COOKIE_OAUTH_STATE, COOKIE_PKCE_VERIFIER } from '@/lib/cognito/cookies'
import { tryGetCognitoEnv } from '@/lib/cognito/env'
import {
  buildCognitoSignupUrl,
  isConfiguredCognitoIdentityProvider,
  parseCognitoIdentityProvider,
  safeOAuthRedirectUri,
  safeNextPath,
  safePkceValue,
} from '@/lib/cognito/login-url'
import { getCognitoPublicOrigin } from '@/lib/cognito/public-origin'
import { generatePkcePair, generateState } from '@/lib/cognito/pkce'

export async function GET(request: NextRequest) {
  const env = tryGetCognitoEnv()
  const origin = getCognitoPublicOrigin(env?.callbackUrl)
  if (!env) {
    return NextResponse.redirect(`${origin}/login?error=cognito_not_configured`)
  }
  const providerParam = request.nextUrl.searchParams.get('provider')
  const provider = parseCognitoIdentityProvider(providerParam)
  if (providerParam && !provider) {
    return NextResponse.redirect(`${origin}/login?error=unsupported_provider`)
  }
  if (!isConfiguredCognitoIdentityProvider(provider)) {
    return NextResponse.redirect(`${origin}/login?error=provider_not_configured`)
  }

  const next = safeNextPath(request.nextUrl.searchParams.get('next'))
  const redirectUri = safeOAuthRedirectUri(request.nextUrl.searchParams.get('redirect_uri'), env.callbackUrl)
  const externalCodeChallenge = safePkceValue(request.nextUrl.searchParams.get('code_challenge'))
  const externalState = safePkceValue(request.nextUrl.searchParams.get('state'))
  const usesExternalPkce = redirectUri !== env.callbackUrl && !!externalCodeChallenge && !!externalState
  const { codeVerifier, codeChallenge } = usesExternalPkce
    ? { codeVerifier: '', codeChallenge: externalCodeChallenge }
    : await generatePkcePair()
  const state = usesExternalPkce ? externalState : generateState()
  const url = buildCognitoSignupUrl({ env, codeChallenge, state, provider, redirectUri })

  const res = NextResponse.redirect(url)
  if (!usesExternalPkce) {
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
    res.cookies.set(COOKIE_OAUTH_NEXT, next, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 600,
    })
  }
  return res
}
