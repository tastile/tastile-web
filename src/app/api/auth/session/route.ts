import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import {
  COOKIE_ID_TOKEN,
  COOKIE_REFRESH_TOKEN,
  COOKIE_USER_SUB,
} from '@/lib/cognito/cookies'

// Intentionally unauthenticated: this route echoes the same httpOnly cookies
// back to the browser. middleware.ts already gates protected paths, and same-origin
// policy is the only intended consumer.
//
// node-runtime: relies on Buffer for the base64 JWT-payload decode.

export async function GET() {
  const jar = await cookies()
  const idToken = jar.get(COOKIE_ID_TOKEN)?.value
  const refreshToken = jar.get(COOKIE_REFRESH_TOKEN)?.value
  const sub = jar.get(COOKIE_USER_SUB)?.value
  if (!idToken || !refreshToken || !sub) {
    return NextResponse.json({ error: 'not authenticated' }, { status: 401 })
  }
  // Decode the JWT exp claim so the client knows when to refresh.
  // We don't verify the signature server-side here — the cookie was set
  // by our own /auth/callback route, and the daemon validates it on the
  // other end. This is a passthrough.
  const parts = idToken.split('.')
  if (parts.length !== 3) {
    return NextResponse.json({ error: 'malformed id_token' }, { status: 401 })
  }
  let exp: number
  try {
    const payload = JSON.parse(
      Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
    ) as { exp?: unknown }
    exp = typeof payload.exp === 'number' ? payload.exp : 0
  } catch {
    return NextResponse.json({ error: 'malformed id_token payload' }, { status: 401 })
  }
  return NextResponse.json({ idToken, refreshToken, sub, exp })
}
