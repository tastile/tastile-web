import { NextResponse, type NextRequest } from 'next/server'
import { verifyCognitoUserEmail } from '@/lib/cognito/account-client'
import { getAccountAccessToken } from '@/lib/cognito/account-session'
import { tryGetCognitoEnv } from '@/lib/cognito/env'
import { normalizeCode } from '@/lib/cognito/form'

export async function POST(request: NextRequest) {
  const env = tryGetCognitoEnv()
  if (!env) return NextResponse.json({ error: 'cognito_not_configured' }, { status: 500 })

  const form = await request.formData()
  const code = normalizeCode(form.get('code'))
  if (!code) return NextResponse.json({ error: 'missing_code' }, { status: 400 })

  const response = NextResponse.json({ ok: true })
  const accessToken = await getAccountAccessToken(response)
  if (!accessToken) return NextResponse.json({ error: 'not_authenticated' }, { status: 401 })

  try {
    await verifyCognitoUserEmail(env, accessToken, code)
    return response
  } catch (error) {
    console.error('Cognito VerifyUserAttribute email failed', error)
    return NextResponse.json({ error: 'email_verify_failed' }, { status: 502 })
  }
}
