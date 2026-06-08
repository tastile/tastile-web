import { DaemonClient, type GoogleCalendarIntegrationSettings } from '@/lib/daemon/client'
import { idTokenProvider } from '@/lib/daemon/access-token'
import { IntegrationsControls } from './integrations-controls'

const DEFAULT_DAEMON_BASE_URL = 'http://127.0.0.1:3140'

async function loadSettings(): Promise<{
  settings: GoogleCalendarIntegrationSettings | null
  error: string | null
}> {
  const baseUrl = process.env.NEXT_PUBLIC_DAEMON_BASE_URL ?? DEFAULT_DAEMON_BASE_URL
  try {
    const client = new DaemonClient({ baseUrl, getAccessToken: idTokenProvider })
    const settings = await client.getIntegrationSettings()
    return { settings, error: null }
  } catch (e) {
    return { settings: null, error: e instanceof Error ? e.message : 'Failed to load integration settings' }
  }
}

export default async function IntegrationsPage() {
  const { settings, error } = await loadSettings()

  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-[590] text-foreground">Integrations</h1>
        <p className="mt-2 text-foreground-muted">Google Calendar の接続状態と同期を管理します</p>
      </div>

      <div className="rounded-xl border border-border bg-surface-elevated p-5">
        <IntegrationsControls initialSettings={settings} initialError={error} />
      </div>
    </div>
  )
}
