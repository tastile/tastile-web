import { describe, expect, it } from 'vitest'

import { resolveCanonicalHostRedirect } from './host-routing'

describe('resolveCanonicalHostRedirect', () => {
  it('keeps app routes on app.tastile.app', () => {
    expect(resolveCanonicalHostRedirect('tastile.app', '/dashboard/account')).toBe('app.tastile.app')
    expect(resolveCanonicalHostRedirect('tastile.app', '/auth/callback')).toBe('app.tastile.app')
    expect(resolveCanonicalHostRedirect('tastile.app', '/login')).toBe('app.tastile.app')
    expect(resolveCanonicalHostRedirect('tastile.app', '/api/account/profile')).toBe('app.tastile.app')
  })

  it('keeps public website routes on tastile.app', () => {
    expect(resolveCanonicalHostRedirect('app.tastile.app', '/')).toBe('tastile.app')
    expect(resolveCanonicalHostRedirect('app.tastile.app', '/pricing')).toBe('tastile.app')
    expect(resolveCanonicalHostRedirect('app.tastile.app', '/download')).toBe('tastile.app')
    expect(resolveCanonicalHostRedirect('app.tastile.app', '/privacy')).toBe('tastile.app')
  })

  it('does not redirect public APIs or already canonical routes', () => {
    expect(resolveCanonicalHostRedirect('tastile.app', '/api/version')).toBeNull()
    expect(resolveCanonicalHostRedirect('tastile.app', '/api/download/windows')).toBeNull()
    expect(resolveCanonicalHostRedirect('app.tastile.app', '/dashboard')).toBeNull()
    expect(resolveCanonicalHostRedirect('tastile.app', '/download')).toBeNull()
  })
})
