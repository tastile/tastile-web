import { NextResponse, type NextRequest } from 'next/server'
import { tryGetCognitoEnv } from '@/lib/cognito/env'
import { normalizeCode, normalizeEmail } from '@/lib/cognito/form'
import { CognitoPublicError, confirmSignUp } from '@/lib/cognito/public-client'
import { getCognitoPublicOrigin } from '@/lib/cognito/public-origin'

export async function POST(request: NextRequest) {
  const env = tryGetCognitoEnv()
  const origin = getCognitoPublicOrigin(env?.callbackUrl)
  if (!env) return NextResponse.redirect(`${origin}/login?error=cognito_not_configured`, 303)

  const form = await request.formData()
  const email = normalizeEmail(form.get('email'))
  const code = normalizeCode(form.get('code'))
  if (!email) return NextResponse.redirect(`${origin}/auth/confirm?error=missing_email`, 303)
  if (!code) return NextResponse.redirect(`${origin}/auth/confirm?email=${encodeURIComponent(email)}&error=missing_code`, 303)

  try {
    await confirmSignUp(env, email, code)
    return NextResponse.redirect(`${origin}/auth/email?email=${encodeURIComponent(email)}&notice=confirmed`, 303)
  } catch (error) {
    if (error instanceof CognitoPublicError) {
      const mapped = error.code === 'CodeMismatchException'
        ? 'invalid_code'
        : error.code === 'ExpiredCodeException'
        ? 'expired_code'
        : 'auth_failed'
      return NextResponse.redirect(`${origin}/auth/confirm?email=${encodeURIComponent(email)}&error=${mapped}`, 303)
    }
    console.error('Confirm signup failed', error)
    return NextResponse.redirect(`${origin}/auth/confirm?email=${encodeURIComponent(email)}&error=auth_failed`, 303)
  }
}

