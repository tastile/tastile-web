import { NextResponse, type NextRequest } from 'next/server'
import { clearAuthCookies } from '@/lib/cognito/cookies'
import { tryGetCognitoEnv } from '@/lib/cognito/env'

export async function GET(request: NextRequest) {
  const env = tryGetCognitoEnv()
  await clearAuthCookies()
  if (!env) return NextResponse.redirect(new URL('/', request.url))
  const url = new URL(`${env.hostedUiBaseUrl}/logout`)
  url.searchParams.set('client_id', env.clientId)
  url.searchParams.set('logout_uri', env.logoutUrl)
  return NextResponse.redirect(url)
}
