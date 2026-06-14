import type { CognitoEnv } from './env'

export const COGNITO_IDENTITY_PROVIDERS = ['Google', 'SignInWithApple'] as const

export type CognitoIdentityProvider = (typeof COGNITO_IDENTITY_PROVIDERS)[number]

export function getConfiguredCognitoIdentityProviders(): Set<CognitoIdentityProvider> {
  const raw =
    process.env.COGNITO_SUPPORTED_IDENTITY_PROVIDERS ??
    process.env.NEXT_PUBLIC_COGNITO_SUPPORTED_IDENTITY_PROVIDERS ??
    ''
  const configured = new Set<CognitoIdentityProvider>()
  for (const value of raw.split(',').map(item => item.trim()).filter(Boolean)) {
    const provider = parseCognitoIdentityProvider(value)
    if (provider) configured.add(provider)
  }
  return configured
}

export function isConfiguredCognitoIdentityProvider(provider: CognitoIdentityProvider | null): boolean {
  if (!provider) return true
  return getConfiguredCognitoIdentityProviders().has(provider)
}

export function parseCognitoIdentityProvider(value: string | null): CognitoIdentityProvider | null {
  if (!value) return null
  return COGNITO_IDENTITY_PROVIDERS.find(provider => provider === value) ?? null
}

export function safeNextPath(value: string | null): string {
  if (!value) return '/dashboard'
  if (!value.startsWith('/') || value.startsWith('//')) return '/dashboard'
  return value
}

export function safeOAuthRedirectUri(value: string | null, fallback: string): string {
  if (!value) return fallback
  if (value === fallback) return value
  if (value === 'tastile://auth/callback') return value
  return fallback
}

export function safePkceValue(value: string | null): string | null {
  if (!value) return null
  if (!/^[A-Za-z0-9._~-]{16,256}$/.test(value)) return null
  return value
}

export function buildCognitoAuthorizeUrl(args: {
  env: CognitoEnv
  codeChallenge: string
  state: string
  provider: CognitoIdentityProvider | null
  redirectUri?: string
}): URL {
  return buildCognitoOAuthUrl({ ...args, pathname: '/oauth2/authorize' })
}

export function buildCognitoSignupUrl(args: {
  env: CognitoEnv
  codeChallenge: string
  state: string
  provider: CognitoIdentityProvider | null
  redirectUri?: string
}): URL {
  return buildCognitoOAuthUrl({ ...args, pathname: '/signup' })
}

function buildCognitoOAuthUrl(args: {
  env: CognitoEnv
  codeChallenge: string
  state: string
  provider: CognitoIdentityProvider | null
  redirectUri?: string
  pathname: '/oauth2/authorize' | '/signup'
}): URL {
  const url = new URL(`${args.env.hostedUiBaseUrl}${args.pathname}`)
  url.searchParams.set('client_id', args.env.clientId)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('scope', 'openid email profile')
  url.searchParams.set('redirect_uri', args.redirectUri ?? args.env.callbackUrl)
  url.searchParams.set('code_challenge', args.codeChallenge)
  url.searchParams.set('code_challenge_method', 'S256')
  url.searchParams.set('state', args.state)
  if (args.provider) {
    url.searchParams.set('identity_provider', args.provider)
  }
  return url
}
