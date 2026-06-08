import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  clearSessionCache,
  getIdTokenClient,
  getSessionClient,
} from './id-token-client'

const SESSION_ENDPOINT = '/api/auth/session'

function makeSession(expiresInSec: number, idToken = 'id-token-abc') {
  return {
    idToken,
    refreshToken: 'refresh-token-xyz',
    sub: 'cognito-sub-1',
    exp: Math.floor(Date.now() / 1000) + expiresInSec,
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

describe('id-token-client', () => {
  let fetchMock: ReturnType<typeof vi.fn>
  let originalFetch: typeof fetch

  beforeEach(() => {
    clearSessionCache()
    fetchMock = vi.fn()
    originalFetch = globalThis.fetch
    globalThis.fetch = fetchMock as unknown as typeof fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
    clearSessionCache()
  })

  it('caches a fresh session and does not refetch within the buffer window', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeSession(3600)))

    const first = await getSessionClient()
    expect(first?.idToken).toBe('id-token-abc')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      SESSION_ENDPOINT,
      expect.objectContaining({
        method: 'GET',
        credentials: 'same-origin',
        cache: 'no-store',
      })
    )

    const second = await getSessionClient()
    expect(second).toEqual(first)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refetches when the cached session is within the refresh buffer', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeSession(30))) // 30s < 60s buffer
      .mockResolvedValueOnce(jsonResponse(makeSession(3600)))

    const first = await getSessionClient()
    expect(first?.idToken).toBe('id-token-abc')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    const second = await getSessionClient()
    expect(second?.idToken).toBe('id-token-abc')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('refetches when force=true is requested', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeSession(3600)))
      .mockResolvedValueOnce(jsonResponse(makeSession(7200, 'id-token-2')))

    await getSessionClient()
    const forced = await getSessionClient(true)
    expect(forced?.idToken).toBe('id-token-2')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('returns null and clears the cache when the server returns 401', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeSession(3600)))
      .mockResolvedValueOnce(jsonResponse({ error: 'not authenticated' }, 401))

    const first = await getSessionClient()
    expect(first?.idToken).toBe('id-token-abc')

    // The buffer check will trigger a refetch, which 401s
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'not authenticated' }, 401)
    )
    clearSessionCache()
    const second = await getSessionClient()
    expect(second).toBeNull()
  })

  it('returns null when the server returns a non-2xx response', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'oops' }, 500))
    const result = await getSessionClient()
    expect(result).toBeNull()
  })

  it('returns null on network error and clears the cache', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network down'))
    const result = await getSessionClient()
    expect(result).toBeNull()

    // After a network failure the next successful call should still work
    fetchMock.mockResolvedValueOnce(jsonResponse(makeSession(3600)))
    const recovered = await getSessionClient()
    expect(recovered?.idToken).toBe('id-token-abc')
  })

  it('returns null on malformed JSON response', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response('not-json', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      })
    )
    const result = await getSessionClient()
    expect(result).toBeNull()
  })

  it('getIdTokenClient returns the idToken from the cached session', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(makeSession(3600)))
    const idToken = await getIdTokenClient()
    expect(idToken).toBe('id-token-abc')
  })

  it('getIdTokenClient returns null when the session is unavailable', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ error: 'not authenticated' }, 401)
    )
    const idToken = await getIdTokenClient()
    expect(idToken).toBeNull()
  })

  it('clearSessionCache forces the next call to refetch', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(makeSession(3600)))
      .mockResolvedValueOnce(jsonResponse(makeSession(7200, 'id-token-2')))

    await getSessionClient()
    clearSessionCache()
    const next = await getSessionClient()
    expect(next?.idToken).toBe('id-token-2')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
