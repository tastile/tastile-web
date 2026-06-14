import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import {
  COOKIE_OAUTH_STATE,
  COOKIE_OAUTH_NEXT,
  COOKIE_PKCE_VERIFIER,
  setAuthCookies,
} from '@/lib/cognito/cookies'
import { tryGetCognitoEnv } from '@/lib/cognito/env'
import { exchangeCodeForTokens, parseIdTokenClaims } from '@/lib/cognito/server'

export async function GET(request: NextRequest) {
  const env = tryGetCognitoEnv()
  const requestOrigin = new URL(request.url).origin
  if (!env) {
    return NextResponse.redirect(`${requestOrigin}/login?error=cognito_not_configured`)
  }

  const { searchParams } = new URL(request.url)
  const origin = publicOriginFromCallbackUrl(env.callbackUrl)
  const code = searchParams.get('code')
  const returnedState = searchParams.get('state')
  const next = jarSafeNextPath(searchParams.get('next'))

  if (!code || !returnedState) {
    return callbackHtmlResponse({
      title: '認証を開始してください',
      message: '認証コードが見つかりませんでした。アカウント画面からもう一度続行してください。',
      destination: `${origin}/login?error=missing_code`,
      tone: 'error',
    })
  }

  const jar = await cookies()
  const expectedState = jar.get(COOKIE_OAUTH_STATE)?.value
  const codeVerifier = jar.get(COOKIE_PKCE_VERIFIER)?.value
  const cookieNext = jarSafeNextPath(jar.get(COOKIE_OAUTH_NEXT)?.value)

  if (!expectedState || expectedState !== returnedState || !codeVerifier) {
    return callbackHtmlResponse({
      title: '認証セッションを確認できませんでした',
      message: '認証の状態が一致しませんでした。アカウント画面からもう一度続行してください。',
      destination: `${origin}/login?error=state_mismatch`,
      tone: 'error',
    })
  }

  try {
    const tokens = await exchangeCodeForTokens({ env, code, codeVerifier })
    const claims = parseIdTokenClaims(tokens.id_token)
    const response = callbackHtmlResponse({
      title: 'Tastile に接続しました',
      message: '認証が完了しました。実行ダッシュボードを開いています。',
      destination: `${origin}${next === '/dashboard' ? cookieNext : next}`,
      tone: 'success',
    })
    await setAuthCookies({
      idToken: tokens.id_token,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      sub: claims.sub,
      expiresIn: tokens.expires_in,
    }, response)
    // Clear PKCE cookies.
    response.cookies.set(COOKIE_OAUTH_STATE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
    response.cookies.set(COOKIE_PKCE_VERIFIER, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
    response.cookies.set(COOKIE_OAUTH_NEXT, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    })
    return response
  } catch (e) {
    console.error('Cognito callback failed', e)
    return callbackHtmlResponse({
      title: '認証を完了できませんでした',
      message: 'セッションを確定できませんでした。もう一度アカウント画面から続行してください。',
      destination: `${origin}/login?error=auth_failed`,
      tone: 'error',
    })
  }
}

function publicOriginFromCallbackUrl(callbackUrl: string): string {
  return new URL(callbackUrl).origin
}

function jarSafeNextPath(value: string | null | undefined): string {
  if (!value) return '/dashboard'
  if (!value.startsWith('/') || value.startsWith('//')) return '/dashboard'
  return value
}

function callbackHtmlResponse(args: {
  title: string
  message: string
  destination: string
  tone: 'success' | 'error'
}) {
  const accent = args.tone === 'success' ? '#5e6ad2' : '#ef4444'
  const escapedDestination = escapeHtml(args.destination)
  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta http-equiv="refresh" content="1.2;url=${escapedDestination}" />
  <title>${escapeHtml(args.title)} | Tastile</title>
  <style>
    :root { color-scheme: light dark; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f7f8f8; color: #111217; }
    @media (prefers-color-scheme: dark) { body { background: #08090a; color: #f7f8f8; } .panel { background: #191a1b; } .muted { color: #8a8f98; } }
    .panel { width: min(520px, calc(100vw - 32px)); background: #fff; border-radius: 12px; padding: 32px; box-sizing: border-box; }
    .mark { width: 52px; height: 52px; border-radius: 14px; display: grid; place-items: center; background: ${accent}; color: #fff; font-weight: 700; font-size: 24px; }
    h1 { margin: 22px 0 10px; font-size: 28px; line-height: 1.15; letter-spacing: 0; }
    p { margin: 0; line-height: 1.65; }
    .muted { color: #6e7581; }
    .bar { margin-top: 26px; height: 4px; border-radius: 999px; overflow: hidden; background: rgba(94,106,210,.18); }
    .bar span { display: block; width: 45%; height: 100%; background: ${accent}; animation: slide 1.2s ease-in-out infinite; border-radius: inherit; }
    a { color: ${accent}; text-decoration: none; }
    @keyframes slide { 0% { transform: translateX(-120%); } 100% { transform: translateX(240%); } }
  </style>
</head>
<body>
  <main class="panel">
    <div class="mark">T</div>
    <h1>${escapeHtml(args.title)}</h1>
    <p class="muted">${escapeHtml(args.message)}</p>
    <div class="bar" aria-hidden="true"><span></span></div>
    <p class="muted" style="margin-top:18px;font-size:14px;">自動で移動しない場合は <a href="${escapedDestination}">こちら</a> を開いてください。</p>
  </main>
  <script>setTimeout(function(){ window.location.replace(${JSON.stringify(args.destination)}); }, 900);</script>
</body>
</html>`

  return new NextResponse(html, {
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}
