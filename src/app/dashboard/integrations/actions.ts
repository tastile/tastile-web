'use server'

import { revalidatePath } from 'next/cache'
import {
  DaemonClient,
  type GoogleCalendarIntegrationSettings,
} from '@/lib/daemon/client'
import { idTokenProvider } from '@/lib/daemon/access-token'

const DEFAULT_DAEMON_BASE_URL = 'http://127.0.0.1:3140'

function buildClient(): DaemonClient {
  const baseUrl = process.env.NEXT_PUBLIC_DAEMON_BASE_URL ?? DEFAULT_DAEMON_BASE_URL
  return new DaemonClient({ baseUrl, getAccessToken: idTokenProvider })
}

export async function connectGoogleCalendarAction(): Promise<GoogleCalendarIntegrationSettings> {
  const client = buildClient()
  const next = await client.updateGoogleCalendarIntegration({ connected: true })
  revalidatePath('/dashboard/integrations')
  return next
}

export async function disconnectGoogleCalendarAction(): Promise<GoogleCalendarIntegrationSettings> {
  const client = buildClient()
  const next = await client.updateGoogleCalendarIntegration({
    connected: false,
    accountEmail: null,
  })
  revalidatePath('/dashboard/integrations')
  return next
}

export async function syncNowAction(): Promise<void> {
  const baseUrl = process.env.NEXT_PUBLIC_DAEMON_BASE_URL ?? DEFAULT_DAEMON_BASE_URL
  await fetch(`${baseUrl}/sync/trigger`, { method: 'POST' })
}

export async function updateLastSyncedAtAction(): Promise<GoogleCalendarIntegrationSettings> {
  const client = buildClient()
  const next = await client.updateGoogleCalendarIntegration({
    lastSyncedAt: new Date().toISOString(),
  })
  revalidatePath('/dashboard/integrations')
  return next
}
