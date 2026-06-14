'use client'

import { useState, useTransition } from 'react'
import type { GoogleCalendarIntegrationSettings } from '@/lib/daemon/client'
import { BUTTON_STYLES } from '@/lib/styles/button-styles'
import {
  connectGoogleCalendarAction,
  disconnectGoogleCalendarAction,
  syncNowAction,
  updateLastSyncedAtAction,
} from './actions'

interface IntegrationsControlsProps {
  initialSettings: GoogleCalendarIntegrationSettings | null
  initialError: string | null
}

export function IntegrationsControls({ initialSettings, initialError }: IntegrationsControlsProps) {
  const [settings, setSettings] = useState<GoogleCalendarIntegrationSettings | null>(initialSettings)
  const [error, setError] = useState<string | null>(initialError)
  const [saving, setSaving] = useState(false)
  const [isPending, startTransition] = useTransition()

  const busy = saving || isPending

  function handleConnect() {
    setSaving(true)
    setError(null)
    startTransition(async () => {
      try {
        const next = await connectGoogleCalendarAction()
        setSettings(next)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to connect google calendar')
      } finally {
        setSaving(false)
      }
    })
  }

  function handleDisconnect() {
    setSaving(true)
    setError(null)
    startTransition(async () => {
      try {
        const next = await disconnectGoogleCalendarAction()
        setSettings(next)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to disconnect google calendar')
      } finally {
        setSaving(false)
      }
    })
  }

  async function handleSync() {
    setSaving(true)
    setError(null)
    try {
      await syncNowAction()
      const next = await updateLastSyncedAtAction()
      setSettings(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to sync integration')
    } finally {
      setSaving(false)
    }
  }

  if (!settings) {
    return (
      <>
        <p className="text-sm text-foreground-muted">{error ?? 'Loading...'}</p>
        {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      </>
    )
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Google Calendar</h2>
          <p className="text-sm text-foreground-muted">
            状態 {settings.connected ? '接続済み' : '未接続'}
          </p>
        </div>
        <div className="flex gap-2">
          {settings.connected ? (
            <button
              type="button"
              className={BUTTON_STYLES.secondary}
              disabled={busy}
              onClick={handleDisconnect}
            >
              Disconnect
            </button>
          ) : (
            <button
              type="button"
              className={BUTTON_STYLES.primary}
              disabled={busy}
              onClick={handleConnect}
            >
              Connect
            </button>
          )}
          <button
            type="button"
            className={BUTTON_STYLES.ghost}
            disabled={busy || !settings.connected}
            onClick={handleSync}
          >
            Sync now
          </button>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-sm text-foreground-muted">
        <div>Read {settings.canRead ? 'enabled' : 'disabled'}</div>
        <div>Write {settings.canWrite ? 'enabled' : 'disabled'}</div>
        <div>Account {settings.accountEmail ?? 'not linked'}</div>
        <div>Last synced {settings.lastSyncedAt ?? 'never'}</div>
      </div>

      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
    </>
  )
}
