import { beforeEach, describe, expect, it, vi } from 'vitest'

const cookieStore: Record<string, { value: string }> = {}

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    get: (n: string) => cookieStore[n],
  })),
}))

import { COOKIE_ID_TOKEN } from '@/lib/cognito/cookies'
import { getIdTokenServer, idTokenProvider } from './access-token'

describe('daemon access-token provider', () => {
  beforeEach(() => {
    for (const k of Object.keys(cookieStore)) delete cookieStore[k]
  })

  it('returns the id_token value from the cookie jar', async () => {
    cookieStore[COOKIE_ID_TOKEN] = { value: 'id-abc' }
    expect(await getIdTokenServer()).toBe('id-abc')
  })

  it('returns null when the id_token cookie is missing', async () => {
    expect(await getIdTokenServer()).toBeNull()
  })

  it('idTokenProvider delegates to getIdTokenServer', async () => {
    cookieStore[COOKIE_ID_TOKEN] = { value: 'id-xyz' }
    expect(await idTokenProvider()).toBe('id-xyz')
  })
})
