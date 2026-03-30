import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('GET /api/download/windows', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
    delete process.env.TASTILE_DESKTOP_MANIFEST_URL
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
  })

  it('redirects to latest desktop installer from manifest', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          latest_version: '0.2.0',
          download_url: 'https://cdn.example.com/tastile-desktop-0.2.0.exe',
          notes: 'latest',
        }),
      })
    )

    const { GET } = await import('./route')
    const response = await GET()

    expect(response.status).toBe(302)
    expect(response.headers.get('location')).toBe('https://cdn.example.com/tastile-desktop-0.2.0.exe')
  })

  it('returns service unavailable when manifest cannot be fetched', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const { GET } = await import('./route')
    const response = await GET()

    expect(response.status).toBe(503)
    const payload = await response.json()
    expect(payload.error).toBe('desktop_download_unavailable')
  })

  it('returns service unavailable when manifest download url is not https', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          latest_version: '0.2.0',
          download_url: 'http://cdn.example.com/tastile-desktop-0.2.0.exe',
        }),
      })
    )

    const { GET } = await import('./route')
    const response = await GET()

    expect(response.status).toBe(503)
    const payload = await response.json()
    expect(payload.error).toBe('desktop_download_unavailable')
  })
})
