import { afterEach, describe, expect, it, vi } from 'vitest'
import { exchangeCodeForTokens, parseIdTokenClaims, refreshTokens } from './server'
import type { CognitoTokenSet } from './server'

const FAKE_ENV = {
  userPoolId: 'ap-northeast-1_pwYcPWOyR',
  clientId: 'client',
  hostedUiDomain: 'tastile-beta',
  issuer: 'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_pwYcPWOyR',
  jwksUrl:
    'https://cognito-idp.ap-northeast-1.amazonaws.com/ap-northeast-1_pwYcPWOyR/.well-known/jwks.json',
  hostedUiBaseUrl: 'https://tastile-beta.auth.ap-northeast-1.amazoncognito.com',
  region: 'ap-northeast-1',
  callbackUrl: 'http://localhost:3000/auth/callback',
  logoutUrl: 'http://localhost:3000',
}

const b64url = (s: string) => Buffer.from(s).toString('base64url')

type FetchImpl = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

function makeFetchMock(responder: FetchImpl) {
  return vi.fn(responder)
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('exchangeCodeForTokens', () => {
  it('POSTs to the token endpoint with form-encoded body', async () => {
    const mock = makeFetchMock(async () =>
      new Response(
        JSON.stringify({
          id_token: 'id',
          access_token: 'acc',
          refresh_token: 'ref',
          expires_in: 3600,
        } satisfies CognitoTokenSet),
        { status: 200 }
      )
    )
    await exchangeCodeForTokens({
      env: FAKE_ENV,
      code: 'abc',
      codeVerifier: 'verifier',
      fetchImpl: mock as unknown as typeof fetch,
    })
    expect(mock).toHaveBeenCalledOnce()
    const call = mock.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit?]
    const [url, init] = call
    expect(url).toBe('https://tastile-beta.auth.ap-northeast-1.amazoncognito.com/oauth2/token')
    expect(init?.method).toBe('POST')
    const body = String(init?.body)
    expect(body).toContain('grant_type=authorization_code')
    expect(body).toContain('client_id=client')
    expect(body).toContain('code=abc')
    expect(body).toContain('code_verifier=verifier')
    expect(body).toContain('redirect_uri=' + encodeURIComponent(FAKE_ENV.callbackUrl))
  })

  it('throws on non-2xx', async () => {
    const mock = makeFetchMock(async () => new Response('oops', { status: 400 }))
    await expect(
      exchangeCodeForTokens({
        env: FAKE_ENV,
        code: 'x',
        codeVerifier: 'y',
        fetchImpl: mock as unknown as typeof fetch,
      })
    ).rejects.toThrow(/token exchange failed/)
  })
})

describe('parseIdTokenClaims', () => {
  it('extracts sub/email/exp', () => {
    const header = b64url(JSON.stringify({ alg: 'RS256' }))
    const payload = b64url(JSON.stringify({ sub: 'user-1', email: 'u@v', exp: 99999 }))
    const tok = `${header}.${payload}.sig`
    const c = parseIdTokenClaims(tok)
    expect(c.sub).toBe('user-1')
    expect(c.email).toBe('u@v')
    expect(c.exp).toBe(99999)
  })

  it('rejects malformed input', () => {
    expect(() => parseIdTokenClaims('not.a.jwt.at.all')).toThrow()
    expect(() => parseIdTokenClaims('only.two')).toThrow()
  })

  it('handles tokens without email claim', () => {
    const header = b64url(JSON.stringify({ alg: 'RS256' }))
    const payload = b64url(JSON.stringify({ sub: 'user-2', exp: 1 }))
    const tok = `${header}.${payload}.sig`
    const c = parseIdTokenClaims(tok)
    expect(c.sub).toBe('user-2')
    expect(c.email).toBeUndefined()
    expect(c.exp).toBe(1)
  })
})

describe('refreshTokens', () => {
  it('POSTs with grant_type=refresh_token', async () => {
    const mock = makeFetchMock(async () =>
      new Response(
        JSON.stringify({
          id_token: 'i',
          access_token: 'a',
          refresh_token: null,
          expires_in: 3600,
        } satisfies CognitoTokenSet),
        { status: 200 }
      )
    )
    await refreshTokens({
      env: FAKE_ENV,
      refreshToken: 'old',
      fetchImpl: mock as unknown as typeof fetch,
    })
    const call = mock.mock.calls[0] as unknown as [RequestInfo | URL, RequestInit?]
    const body = String(call[1]?.body)
    expect(body).toContain('grant_type=refresh_token')
    expect(body).toContain('refresh_token=old')
  })

  it('throws on non-2xx', async () => {
    const mock = makeFetchMock(async () => new Response('nope', { status: 401 }))
    await expect(
      refreshTokens({
        env: FAKE_ENV,
        refreshToken: 'old',
        fetchImpl: mock as unknown as typeof fetch,
      })
    ).rejects.toThrow(/refresh failed/)
  })
})
