import { describe, expect, it } from 'vitest'
import { shouldRequireSecurityUnlock } from './security-lock-policy'

describe('shouldRequireSecurityUnlock', () => {
  it('requires unlock when elapsed time is past timeout', () => {
    expect(shouldRequireSecurityUnlock({
      enabled: true,
      timeoutMinutes: 10,
      lastLeftAt: 1_000,
      now: 601_000,
    })).toBe(true)
  })

  it('skips when disabled', () => {
    expect(shouldRequireSecurityUnlock({
      enabled: false,
      timeoutMinutes: 10,
      lastLeftAt: 1_000,
      now: 601_000,
    })).toBe(false)
  })
})
