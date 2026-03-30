import { afterEach, describe, expect, it } from 'vitest'
import { buildSupabaseCallbackUrl, getSupabaseEnv, tryGetSupabaseEnv } from './env'

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL

describe('getSupabaseEnv', () => {
  afterEach(() => {
    if (originalUrl === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl
    }

    if (originalKey === undefined) {
      delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    } else {
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = originalKey
    }

    if (originalAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl
    }
  })

  it('trims trailing newlines from supabase env values', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co\n'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_abc\n'

    const env = getSupabaseEnv()
    expect(env.url).toBe('https://example.supabase.co')
    expect(env.publishableKey).toBe('sb_publishable_abc')
    expect(env.appUrl).toBeNull()
  })

  it('throws when env values are missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    expect(() => getSupabaseEnv()).toThrow('Missing Supabase environment configuration')
  })

  it('returns null from tryGetSupabaseEnv when env values are missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    expect(tryGetSupabaseEnv()).toBeNull()
  })

  it('prefers NEXT_PUBLIC_APP_URL when building oauth callback URL', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://tastile.app/'

    expect(buildSupabaseCallbackUrl('https://preview.tastile.app')).toBe(
      'https://tastile.app/auth/callback'
    )
  })

  it('falls back to current origin when NEXT_PUBLIC_APP_URL is missing', () => {
    delete process.env.NEXT_PUBLIC_APP_URL

    expect(buildSupabaseCallbackUrl('https://preview.tastile.app/')).toBe(
      'https://preview.tastile.app/auth/callback'
    )
  })
})
