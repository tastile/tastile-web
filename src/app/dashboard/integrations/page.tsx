'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { DaemonClient, GoogleCalendarIntegrationSettings } from '@/lib/daemon/client'
import { createClient, getBrowserAccessToken } from '@/lib/supabase/client'
import { BUTTON_STYLES } from '@/lib/styles/button-styles'

const DEFAULT_DAEMON_BASE_URL = 'http://127.0.0.1:3140'

export default function IntegrationsPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settings, setSettings] = useState<GoogleCalendarIntegrationSettings | null>(null)
  const supabase = useMemo(() => createClient(), [])
  const baseUrl = useMemo(
    () => process.env.NEXT_PUBLIC_DAEMON_BASE_URL ?? DEFAULT_DAEMON_BASE_URL,
    []
  )
  const client = useMemo(
    () =>
      new DaemonClient({
        baseUrl,
        getAccessToken: async () => getBrowserAccessToken(supabase),
      }),
    [baseUrl, supabase]
  )

  const refreshSettings = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const next = await client.getIntegrationSettings()
      setSettings(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load integration settings')
    } finally {
      setLoading(false)
    }
  }, [client])

  useEffect(() => {
    void refreshSettings()
  }, [refreshSettings])

  async function connectGoogleCalendar() {
    setSaving(true)
    setError(null)
    try {
      const next = await client.updateGoogleCalendarIntegration({
        connected: true,
      })
      setSettings(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to connect google calendar')
    } finally {
      setSaving(false)
    }
  }

  async function disconnectGoogleCalendar() {
    setSaving(true)
    setError(null)
    try {
      const next = await client.updateGoogleCalendarIntegration({
        connected: false,
        accountEmail: null,
      })
      setSettings(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to disconnect google calendar')
    } finally {
      setSaving(false)
    }
  }

  async function syncNow() {
    setSaving(true)
    setError(null)
    try {
      await fetch(`${baseUrl}/sync/trigger`, {
        method: 'POST',
      })
      const next = await client.updateGoogleCalendarIntegration({
        lastSyncedAt: new Date().toISOString(),
      })
      setSettings(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sync integration')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-[590] text-foreground">Integrations</h1>
        <p className="mt-2 text-foreground-muted">Google Calendar の接続状態と同期を管理します</p>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">Google Calendar</h2>
            <p className="text-sm text-foreground-muted">
              状態 {loading ? '読み込み中' : settings?.connected ? '接続済み' : '未接続'}
            </p>
          </div>
          <div className="flex gap-2">
            {settings?.connected ? (
              <button
                type="button"
                className={BUTTON_STYLES.secondary}
                disabled={saving || loading}
                onClick={disconnectGoogleCalendar}
              >
                Disconnect
              </button>
            ) : (
              <button
                type="button"
                className={BUTTON_STYLES.primary}
                disabled={saving || loading}
                onClick={connectGoogleCalendar}
              >
                Connect
              </button>
            )}
            <button
              type="button"
              className={BUTTON_STYLES.ghost}
              disabled={saving || loading || !settings?.connected}
              onClick={syncNow}
            >
              Sync now
            </button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-sm text-foreground-muted">
          <div>Read {settings?.canRead ? 'enabled' : 'disabled'}</div>
          <div>Write {settings?.canWrite ? 'enabled' : 'disabled'}</div>
          <div>Account {settings?.accountEmail ?? 'not linked'}</div>
          <div>Last synced {settings?.lastSyncedAt ?? 'never'}</div>
        </div>

        {error ? <p className="mt-3 text-sm text-red-500">{error}</p> : null}
      </div>
    </div>
  )
}
