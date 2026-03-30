import { DaemonCommandRequest, fromDaemonCommandRequest } from '../core/command'
import { ExecutionSnapshot } from '../domain/execution'
import { parseExecutionSnapshot } from './contracts'

export type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>
export type AccessTokenProvider = () => Promise<string | null>

export interface DaemonClientOptions {
  baseUrl: string
  fetchImpl?: FetchLike
  getAccessToken?: AccessTokenProvider
}

export interface DaemonSessionRestoreRequest {
  userId: string
  email: string
  accessToken: string
  refreshToken: string
  expiresAt?: string | null
}

export interface GoogleCalendarIntegrationSettings {
  connected: boolean
  canRead: boolean
  canWrite: boolean
  accountEmail: string | null
  lastSyncedAt: string | null
}

export interface CommandAcceptedEnvelope {
  accepted: true
  commandId: string
  requestId: string | null
}

export class DaemonClient {
  private readonly baseUrl: string
  private readonly fetchImpl: FetchLike
  private readonly getAccessToken?: AccessTokenProvider

  constructor({ baseUrl, fetchImpl = fetch, getAccessToken }: DaemonClientOptions) {
    this.baseUrl = trimTrailingSlash(baseUrl)
    this.fetchImpl = (...args) => fetchImpl(...args)
    this.getAccessToken = getAccessToken
  }

  async readSnapshot(): Promise<ExecutionSnapshot> {
    const response = await this.fetchImpl(`${this.baseUrl}/execution/snapshot`, {
      method: 'GET',
      headers: await this.buildHeaders(),
    })
    await assertOk(response, 'Failed to read execution snapshot')
    const payload = (await response.json()) as unknown
    return parseExecutionSnapshot(payload)
  }

  async sendCommand(command: DaemonCommandRequest): Promise<CommandAcceptedEnvelope> {
    const response = await this.fetchImpl(`${this.baseUrl}/commands`, {
      method: 'POST',
      headers: await this.buildHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify(fromDaemonCommandRequest(command), jsonReplacer),
    })
    await assertOk(response, 'Failed to send daemon command')
    const payload = (await response.json()) as unknown
    return parseAcceptedEnvelope(payload)
  }

  async restoreSession(session: DaemonSessionRestoreRequest): Promise<void> {
    const response = await this.fetchImpl(`${this.baseUrl}/auth/session/restore`, {
      method: 'POST',
      headers: await this.buildHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        user_id: session.userId,
        email: session.email,
        access_token: session.accessToken,
        refresh_token: session.refreshToken,
        expires_at: session.expiresAt ?? null,
      }),
    })
    await assertOk(response, 'Failed to restore daemon session')
  }

  async getIntegrationSettings(): Promise<GoogleCalendarIntegrationSettings> {
    const response = await this.fetchImpl(`${this.baseUrl}/auth/integrations/settings`, {
      method: 'GET',
      headers: await this.buildHeaders(),
    })
    await assertOk(response, 'Failed to get integration settings')
    const payload = (await response.json()) as unknown
    return parseIntegrationSettings(payload)
  }

  async updateGoogleCalendarIntegration(
    patch: Partial<GoogleCalendarIntegrationSettings>
  ): Promise<GoogleCalendarIntegrationSettings> {
    const response = await this.fetchImpl(`${this.baseUrl}/auth/integrations/settings`, {
      method: 'POST',
      headers: await this.buildHeaders({ 'content-type': 'application/json' }),
      body: JSON.stringify({
        google_calendar: {
          ...(patch.connected !== undefined ? { connected: patch.connected } : {}),
          ...(patch.canRead !== undefined ? { can_read: patch.canRead } : {}),
          ...(patch.canWrite !== undefined ? { can_write: patch.canWrite } : {}),
          ...(patch.accountEmail !== undefined ? { account_email: patch.accountEmail } : {}),
          ...(patch.lastSyncedAt !== undefined ? { last_synced_at: patch.lastSyncedAt } : {}),
        },
      }),
    })
    await assertOk(response, 'Failed to update integration settings')
    const payload = (await response.json()) as unknown
    return parseIntegrationSettings(payload)
  }

  private async buildHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
    const headers: Record<string, string> = { ...(extra ?? {}) }
    const token = this.getAccessToken ? await this.getAccessToken() : null
    if (token) {
      headers.authorization = `Bearer ${token}`
    }
    return headers
  }
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function jsonReplacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) return value.toISOString()
  return value
}

async function assertOk(response: Response, message: string): Promise<void> {
  if (!response.ok) {
    const body = await response.text().catch(() => '')
    const snippet = body.slice(0, 240)
    throw new Error(`${message}: ${response.status}${snippet ? ` ${snippet}` : ''}`)
  }
}

function parseAcceptedEnvelope(raw: unknown): CommandAcceptedEnvelope {
  const row = asRecord(raw, 'accepted envelope')
  const accepted = read(row, 'accepted')
  if (accepted !== true) {
    throw new Error('Invalid accepted envelope: accepted must be true')
  }

  return {
    accepted: true,
    commandId: asString(read(row, 'command_id', 'commandId'), 'command_id'),
    requestId: asNullableString(read(row, 'request_id', 'requestId'), 'request_id'),
  }
}

function asRecord(value: unknown, field: string): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  throw new Error(`Invalid ${field}: expected object`)
}

function read(source: Record<string, unknown>, ...keys: string[]): unknown {
  for (const key of keys) {
    if (key in source) return source[key]
  }
  throw new Error(`Missing required field: ${keys[0]}`)
}

function asString(value: unknown, field: string): string {
  if (typeof value === 'string') return value
  throw new Error(`Invalid ${field}: expected string`)
}

function asNullableString(value: unknown, field: string): string | null {
  if (value === null) return null
  return asString(value, field)
}

function parseIntegrationSettings(raw: unknown): GoogleCalendarIntegrationSettings {
  const row = asRecord(raw, 'integration settings')
  const gc = asRecord(read(row, 'google_calendar', 'googleCalendar'), 'google_calendar')
  return {
    connected: asBoolean(read(gc, 'connected'), 'google_calendar.connected'),
    canRead: asBoolean(read(gc, 'can_read', 'canRead'), 'google_calendar.can_read'),
    canWrite: asBoolean(read(gc, 'can_write', 'canWrite'), 'google_calendar.can_write'),
    accountEmail: asNullableString(read(gc, 'account_email', 'accountEmail'), 'google_calendar.account_email'),
    lastSyncedAt: asNullableString(read(gc, 'last_synced_at', 'lastSyncedAt'), 'google_calendar.last_synced_at'),
  }
}

function asBoolean(value: unknown, field: string): boolean {
  if (typeof value === 'boolean') return value
  throw new Error(`Invalid ${field}: expected boolean`)
}
