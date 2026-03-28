import { afterEach, describe, expect, it } from 'vitest'
import { getSupabaseEnv } from './env'

const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const originalKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

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
  })

  it('trims trailing newlines from supabase env values', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co\n'
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_abc\n'

    const env = getSupabaseEnv()
    expect(env.url).toBe('https://example.supabase.co')
    expect(env.publishableKey).toBe('sb_publishable_abc')
  })

  it('throws when env values are missing', () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL
    delete process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    expect(() => getSupabaseEnv()).toThrow('Missing Supabase environment configuration')
  })
})
