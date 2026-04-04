import { describe, expect, it, vi } from 'vitest'
import { TileId } from '../domain/ids'
import { DaemonClient } from './client'

describe('DaemonClient', () => {
  it('does not throw illegal invocation when using global fetch reference', async () => {
    const originalFetch = globalThis.fetch
    const fakeFetch = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          in_progress_tiles: [],
          prompt_queue: [],
          timeline: [],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    })

    globalThis.fetch = fakeFetch as unknown as typeof fetch
    try {
      const client = new DaemonClient({
        baseUrl: 'https://daemon.example',
      })
      const snapshot = await client.readSnapshot()
      expect(snapshot.timeline).toEqual([])
      expect(fakeFetch).toHaveBeenCalledTimes(1)
    } finally {
      globalThis.fetch = originalFetch
    }
  })

  it('reads snapshot with auth header', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          in_progress_tiles: [],
          prompt_queue: [],
          timeline: [],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    })
    const client = new DaemonClient({
      baseUrl: 'https://daemon.example',
      fetchImpl,
      getAccessToken: async () => 'access-token-1',
    })

    const snapshot = await client.readSnapshot()

    expect(snapshot).toEqual({
      inProgressTiles: [],
      promptQueue: [],
      timeline: [],
    })
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://daemon.example/execution/snapshot',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          authorization: 'Bearer access-token-1',
        }),
      })
    )
  })

  it('sends command with auth header and receives accepted envelope', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          accepted: true,
          command_id: 'cmd-1',
          request_id: 'req-1',
        }),
        {
          status: 202,
          headers: { 'content-type': 'application/json' },
        }
      )
    })

    const client = new DaemonClient({
      baseUrl: 'https://daemon.example',
      fetchImpl,
      getAccessToken: async () => 'access-token-1',
    })

    const result = await client.sendCommand({
      type: 'start_tile',
      tileId: TileId.fromString('tile-1'),
      startedAt: new Date('2026-03-26T09:00:00.000Z'),
      source: 'manual',
    })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://daemon.example/commands',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          authorization: 'Bearer access-token-1',
          'content-type': 'application/json',
        }),
      })
    )
    expect(result).toEqual({
      accepted: true,
      commandId: 'cmd-1',
      requestId: 'req-1',
    })
  })

  it('restores daemon session from supabase session payload', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          user_id: 'user-1',
          email: 'user@example.com',
          access_token: 'access-token-1',
          refresh_token: 'refresh-token-1',
          expires_at: '2026-03-28T14:00:00.000Z',
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    })

    const client = new DaemonClient({
      baseUrl: 'https://daemon.example',
      fetchImpl,
    })

    await client.restoreSession({
      userId: 'user-1',
      email: 'user@example.com',
      accessToken: 'access-token-1',
      refreshToken: 'refresh-token-1',
      expiresAt: '2026-03-28T14:00:00.000Z',
    })

    expect(fetchImpl).toHaveBeenCalledWith(
      'https://daemon.example/auth/session/restore',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'content-type': 'application/json',
        }),
        body: JSON.stringify({
          user_id: 'user-1',
          email: 'user@example.com',
          access_token: 'access-token-1',
          refresh_token: 'refresh-token-1',
          expires_at: '2026-03-28T14:00:00.000Z',
        }),
      })
    )
  })

  it('gets integration settings for google calendar', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          google_calendar: {
            connected: true,
            can_read: true,
            can_write: true,
            account_email: 'user@example.com',
            last_synced_at: '2026-03-30T04:00:00.000Z',
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    })
    const client = new DaemonClient({
      baseUrl: 'https://daemon.example',
      fetchImpl,
    })

    const settings = await client.getIntegrationSettings()
    expect(settings.connected).toBe(true)
    expect(settings.accountEmail).toBe('user@example.com')
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://daemon.example/auth/integrations/settings',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('updates google calendar integration settings', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          google_calendar: {
            connected: false,
            can_read: true,
            can_write: true,
            account_email: null,
            last_synced_at: null,
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    })
    const client = new DaemonClient({
      baseUrl: 'https://daemon.example',
      fetchImpl,
    })

    const settings = await client.updateGoogleCalendarIntegration({
      connected: false,
      accountEmail: null,
      lastSyncedAt: null,
    })
    expect(settings.connected).toBe(false)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://daemon.example/auth/integrations/settings',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          google_calendar: {
            connected: false,
            account_email: null,
            last_synced_at: null,
          },
        }),
      })
    )
  })

  it('reads daemon sync status', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          in_progress: false,
          last_attempt_at: '2026-04-04T00:00:00.000Z',
          last_success_at: '2026-04-04T00:00:01.000Z',
          last_error: null,
          last_result: {
            uploaded: 1,
            downloaded: 2,
            applied: 2,
            failed: 0,
            conflicts: 0,
          },
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    })

    const client = new DaemonClient({
      baseUrl: 'https://daemon.example',
      fetchImpl,
    })

    const status = await client.readSyncStatus()
    expect(status.inProgress).toBe(false)
    expect(status.lastResult?.downloaded).toBe(2)
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://daemon.example/sync/status',
      expect.objectContaining({ method: 'GET' })
    )
  })

  it('reads daemon sync status when optional fields are missing', async () => {
    const fetchImpl = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          in_progress: true,
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }
      )
    })

    const client = new DaemonClient({
      baseUrl: 'https://daemon.example',
      fetchImpl,
    })

    const status = await client.readSyncStatus()
    expect(status).toEqual({
      inProgress: true,
      lastAttemptAt: null,
      lastSuccessAt: null,
      lastError: null,
      lastResult: null,
    })
  })
})
