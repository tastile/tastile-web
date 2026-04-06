import { DaemonCommandRequest, fromDaemonCommandRequest } from '../core/command'
import { ExecutionSnapshot, ExecutionSyncStatus } from '../domain/execution'
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

export interface DaemonTileView {
  id: string
  title: string
  lifecycle: string
  nextAction: string | null
  doneDefinition: string | null
  workedMinutes: number
  breakMinutes: number
  semanticRole: string
  labels: string[]
  objectiveMode: string | null
  targetWorkMin: number | null
  targetRestMin: number | null
  doneRule: string | null
  resumeNote: string | null
  projectedNextStartAt: string | null
  temporal: {
    releaseAt: string | null
    dueAt: string | null
    fixedStart: string | null
    fixedEnd: string | null
    activeStart: string | null
    activeEnd: string | null
  } | null
}

export interface DaemonTilesResponse {
  tiles: DaemonTileView[]
  nextActionableTileId: string | null
  nextActionableStartAt: string | null
}

export interface DaemonExecutionViewResponse {
  tilesInProgress: DaemonTileView[]
  mainTile: DaemonTileView | null
  isWorking: boolean
  isOnBreak: boolean
  isIdle: boolean
  mainTileStartedAt: string | null
  mainTileEndsAt: string | null
  pendingPromptId: string | null
  tileCount: number
  eventCount: number
}

export interface DaemonPromptActionView {
  id: string
  label: string
}

export interface DaemonPromptView {
  promptId: string
  kind: string
  severity: string
  tileId: string | null
  title: string
  body: string
  why: string
  suggestedMinutes: number | null
  reasons: string[]
  actions: DaemonPromptActionView[]
  createdAt: string | null
  expiresAt: string | null
  stale: boolean
}

export interface DaemonPendingPromptResponse {
  prompt: DaemonPromptView | null
}

export interface DaemonTimelineItemView {
  kind: string
  tileId: string | null
  semanticRole: string | null
  title: string
  startedAt: string
  endedAt: string | null
  durationMin: number
  isActive: boolean
}

export interface DaemonTimelineTodayResponse {
  items: DaemonTimelineItemView[]
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

  async readTiles(params?: { viewMode?: string; lifecycle?: string; limit?: number; search?: string }): Promise<DaemonTilesResponse> {
    const query = new URLSearchParams()
    if (params?.viewMode) query.set('view_mode', params.viewMode)
    if (params?.lifecycle) query.set('lifecycle', params.lifecycle)
    if (typeof params?.limit === 'number' && Number.isFinite(params.limit)) query.set('limit', String(Math.trunc(params.limit)))
    if (params?.search) query.set('search', params.search)
    const suffix = query.size > 0 ? `?${query.toString()}` : ''
    const response = await this.fetchImpl(`${this.baseUrl}/read/tiles${suffix}`, {
      method: 'GET',
      headers: await this.buildHeaders(),
    })
    await assertOk(response, 'Failed to read tiles')
    const payload = (await response.json()) as unknown
    return parseTilesResponse(payload)
  }

  async readExecutionView(): Promise<DaemonExecutionViewResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/read/execution-view`, {
      method: 'GET',
      headers: await this.buildHeaders(),
    })
    await assertOk(response, 'Failed to read execution view')
    const payload = (await response.json()) as unknown
    return parseExecutionView(payload)
  }

  async readPendingPrompt(): Promise<DaemonPendingPromptResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/views/pending-prompt`, {
      method: 'GET',
      headers: await this.buildHeaders(),
    })
    await assertOk(response, 'Failed to read pending prompt')
    const payload = (await response.json()) as unknown
    return parsePendingPrompt(payload)
  }

  async readTodayTimeline(): Promise<DaemonTimelineTodayResponse> {
    const response = await this.fetchImpl(`${this.baseUrl}/views/timeline/today`, {
      method: 'GET',
      headers: await this.buildHeaders(),
    })
    await assertOk(response, 'Failed to read timeline today')
    const payload = (await response.json()) as unknown
    return parseTimelineToday(payload)
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

  async readSyncStatus(): Promise<ExecutionSyncStatus> {
    const response = await this.fetchImpl(`${this.baseUrl}/sync/status`, {
      method: 'GET',
      headers: await this.buildHeaders(),
    })
    await assertOk(response, 'Failed to read sync status')
    const payload = (await response.json()) as unknown
    return parseSyncStatus(payload)
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

function readOptional(source: Record<string, unknown>, key: string): unknown | undefined {
  return key in source ? source[key] : undefined
}

function asArray(value: unknown, field: string): unknown[] {
  if (Array.isArray(value)) return value
  throw new Error(`Invalid ${field}: expected array`)
}

function asNullableNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'number' && Number.isFinite(value)) return value
  throw new Error(`Invalid ${field}: expected number|null`)
}

function toFiniteCounter(value: unknown): number {
  const parsed = Number(value ?? 0)
  if (!Number.isFinite(parsed)) return 0
  if (parsed <= 0) return 0
  return Math.trunc(parsed)
}

function asNullableObject(value: unknown, field: string): Record<string, unknown> | null {
  if (value === null) return null
  if (value && typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  throw new Error(`Invalid ${field}: expected object|null`)
}

function parseSyncStatus(raw: unknown): ExecutionSyncStatus {
  const row = asRecord(raw, 'sync status')
  const inProgressRaw =
    'in_progress' in row ? row.in_progress : 'inProgress' in row ? row.inProgress : false
  const lastAttemptRaw =
    'last_attempt_at' in row ? row.last_attempt_at : 'lastAttemptAt' in row ? row.lastAttemptAt : null
  const lastSuccessRaw =
    'last_success_at' in row ? row.last_success_at : 'lastSuccessAt' in row ? row.lastSuccessAt : null
  const lastErrorRaw = 'last_error' in row ? row.last_error : 'lastError' in row ? row.lastError : null
  const lastResultInput = 'last_result' in row ? row.last_result : 'lastResult' in row ? row.lastResult : null
  const lastResultRaw = asNullableObject(lastResultInput, 'last_result')
  return {
    inProgress: asBoolean(inProgressRaw, 'in_progress'),
    lastAttemptAt: asNullableString(lastAttemptRaw, 'last_attempt_at'),
    lastSuccessAt: asNullableString(lastSuccessRaw, 'last_success_at'),
    lastError: asNullableString(lastErrorRaw, 'last_error'),
    lastResult: lastResultRaw
      ? {
          uploaded: toFiniteCounter(read(lastResultRaw, 'uploaded')),
          downloaded: toFiniteCounter(read(lastResultRaw, 'downloaded')),
          applied: toFiniteCounter(read(lastResultRaw, 'applied')),
          failed: toFiniteCounter(read(lastResultRaw, 'failed')),
          conflicts: toFiniteCounter(read(lastResultRaw, 'conflicts')),
        }
      : null,
  }
}

function parseTilesResponse(raw: unknown): DaemonTilesResponse {
  const row = asRecord(raw, 'tiles response')
  return {
    tiles: asArray(read(row, 'tiles'), 'tiles').map((item, i) => parseTileView(item, `tiles[${i}]`)),
    nextActionableTileId: asNullableString(readOptional(row, 'next_actionable_tile_id') ?? readOptional(row, 'nextActionableTileId') ?? null, 'next_actionable_tile_id'),
    nextActionableStartAt: asNullableString(readOptional(row, 'next_actionable_start_at') ?? readOptional(row, 'nextActionableStartAt') ?? null, 'next_actionable_start_at'),
  }
}

function parseExecutionView(raw: unknown): DaemonExecutionViewResponse {
  const row = asRecord(raw, 'execution view')
  return {
    tilesInProgress: asArray(read(row, 'tiles_in_progress', 'tilesInProgress'), 'tiles_in_progress').map((item, i) => parseTileView(item, `tiles_in_progress[${i}]`)),
    mainTile: toNullableRecord(readOptional(row, 'main_tile') ?? readOptional(row, 'mainTile')) ? parseTileView(read(row, 'main_tile', 'mainTile'), 'main_tile') : null,
    isWorking: asBoolean(read(row, 'is_working', 'isWorking'), 'is_working'),
    isOnBreak: asBoolean(read(row, 'is_on_break', 'isOnBreak'), 'is_on_break'),
    isIdle: asBoolean(read(row, 'is_idle', 'isIdle'), 'is_idle'),
    mainTileStartedAt: asNullableString(readOptional(row, 'main_tile_started_at') ?? readOptional(row, 'mainTileStartedAt') ?? null, 'main_tile_started_at'),
    mainTileEndsAt: asNullableString(readOptional(row, 'main_tile_ends_at') ?? readOptional(row, 'mainTileEndsAt') ?? null, 'main_tile_ends_at'),
    pendingPromptId: asNullableString(readOptional(row, 'pending_prompt_id') ?? readOptional(row, 'pendingPromptId') ?? null, 'pending_prompt_id'),
    tileCount: Number(readOptional(row, 'tile_count') ?? readOptional(row, 'tileCount') ?? 0),
    eventCount: Number(readOptional(row, 'event_count') ?? readOptional(row, 'eventCount') ?? 0),
  }
}

function parsePendingPrompt(raw: unknown): DaemonPendingPromptResponse {
  const row = asRecord(raw, 'pending prompt')
  const promptRaw = readOptional(row, 'prompt')
  const promptRow = toNullableRecord(promptRaw)
  if (!promptRow) return { prompt: null }
  return {
      prompt: {
        promptId: asString(read(promptRow, 'prompt_id', 'promptId'), 'prompt_id'),
        kind: asString(read(promptRow, 'kind'), 'kind'),
        severity: asNullableString(readOptional(promptRow, 'severity') ?? null, 'severity') ?? 'soft',
      tileId: asNullableString(readOptional(promptRow, 'tile_id') ?? readOptional(promptRow, 'tileId') ?? null, 'tile_id'),
      title: asString(read(promptRow, 'title'), 'title'),
      body: asString(read(promptRow, 'body'), 'body'),
      why: asString(read(promptRow, 'why'), 'why'),
      suggestedMinutes: asNullableNumber(readOptional(promptRow, 'suggested_minutes') ?? readOptional(promptRow, 'suggestedMinutes') ?? null, 'suggested_minutes'),
      reasons: asArray(readOptional(promptRow, 'reasons') ?? [], 'reasons').map((item, i) => asString(item, `reasons[${i}]`)),
      actions: asArray(readOptional(promptRow, 'actions') ?? [], 'actions').map((item, i) => parsePromptAction(item, `actions[${i}]`)),
      createdAt: asNullableString(readOptional(promptRow, 'created_at') ?? readOptional(promptRow, 'createdAt') ?? null, 'created_at'),
      expiresAt: asNullableString(readOptional(promptRow, 'expires_at') ?? readOptional(promptRow, 'expiresAt') ?? null, 'expires_at'),
      stale: asBoolean(readOptional(promptRow, 'stale') ?? false, 'stale'),
    },
  }
}

function parseTimelineToday(raw: unknown): DaemonTimelineTodayResponse {
  const row = asRecord(raw, 'timeline today')
  return {
    items: asArray(read(row, 'items'), 'items').map((item, i) => {
      const timeline = asRecord(item, `items[${i}]`)
      return {
        kind: asString(read(timeline, 'kind'), 'kind'),
        tileId: asNullableString(readOptional(timeline, 'tile_id') ?? readOptional(timeline, 'tileId') ?? null, 'tile_id'),
        semanticRole: asNullableString(readOptional(timeline, 'semantic_role') ?? readOptional(timeline, 'semanticRole') ?? null, 'semantic_role'),
        title: asString(read(timeline, 'title'), 'title'),
        startedAt: asString(read(timeline, 'started_at', 'startedAt'), 'started_at'),
        endedAt: asNullableString(readOptional(timeline, 'ended_at') ?? readOptional(timeline, 'endedAt') ?? null, 'ended_at'),
        durationMin: Number(readOptional(timeline, 'duration_min') ?? readOptional(timeline, 'durationMin') ?? 0),
        isActive: asBoolean(readOptional(timeline, 'is_active') ?? readOptional(timeline, 'isActive') ?? false, 'is_active'),
      }
    }),
  }
}

function parseTileView(raw: unknown, field: string): DaemonTileView {
  const row = asRecord(raw, field)
  const temporalRow = toNullableRecord(readOptional(row, 'temporal'))
  const targetWork = asNullableNumber(
    readOptional(row, 'target_work_min') ?? readOptional(row, 'targetWorkMin') ?? null,
    `${field}.target_work_min`
  )
  const workedFallback = Math.max(
    0,
    Math.trunc(Number(readOptional(row, 'worked_minutes') ?? readOptional(row, 'workedMinutes') ?? 0))
  )
  return {
    id: asString(read(row, 'id'), `${field}.id`),
    title: asString(read(row, 'title'), `${field}.title`),
    lifecycle: asString(readOptional(row, 'lifecycle') ?? 'ready', `${field}.lifecycle`),
    nextAction: asNullableString(readOptional(row, 'next_action') ?? readOptional(row, 'nextAction') ?? null, `${field}.next_action`),
    doneDefinition: asNullableString(readOptional(row, 'done_definition') ?? readOptional(row, 'doneDefinition') ?? null, `${field}.done_definition`),
    workedMinutes: Number(readOptional(row, 'worked_minutes') ?? readOptional(row, 'workedMinutes') ?? 0),
    breakMinutes: Number(readOptional(row, 'break_minutes') ?? readOptional(row, 'breakMinutes') ?? 0),
    semanticRole: asString(readOptional(row, 'semantic_role') ?? readOptional(row, 'semanticRole') ?? 'work', `${field}.semantic_role`),
    labels: asArray(readOptional(row, 'labels') ?? [], `${field}.labels`).map((item, i) => asString(item, `${field}.labels[${i}]`)),
    objectiveMode: asNullableString(readOptional(row, 'objective_mode') ?? readOptional(row, 'objectiveMode') ?? null, `${field}.objective_mode`),
    targetWorkMin: targetWork ?? (workedFallback > 0 ? workedFallback : null),
    targetRestMin: asNullableNumber(readOptional(row, 'target_rest_min') ?? readOptional(row, 'targetRestMin') ?? null, `${field}.target_rest_min`),
    doneRule: asNullableString(readOptional(row, 'done_rule') ?? readOptional(row, 'doneRule') ?? null, `${field}.done_rule`),
    resumeNote: asNullableString(readOptional(row, 'resume_note') ?? readOptional(row, 'resumeNote') ?? null, `${field}.resume_note`),
    projectedNextStartAt: asNullableString(readOptional(row, 'projected_next_start_at') ?? readOptional(row, 'projectedNextStartAt') ?? null, `${field}.projected_next_start_at`),
    temporal: temporalRow
      ? {
          releaseAt: asNullableString(readOptional(temporalRow, 'release_at') ?? readOptional(temporalRow, 'releaseAt') ?? null, 'temporal.release_at'),
          dueAt: asNullableString(readOptional(temporalRow, 'due_at') ?? readOptional(temporalRow, 'dueAt') ?? null, 'temporal.due_at'),
          fixedStart: asNullableString(readOptional(temporalRow, 'fixed_start') ?? readOptional(temporalRow, 'fixedStart') ?? null, 'temporal.fixed_start'),
          fixedEnd: asNullableString(readOptional(temporalRow, 'fixed_end') ?? readOptional(temporalRow, 'fixedEnd') ?? null, 'temporal.fixed_end'),
          activeStart: asNullableString(readOptional(temporalRow, 'active_start') ?? readOptional(temporalRow, 'activeStart') ?? null, 'temporal.active_start'),
          activeEnd: asNullableString(readOptional(temporalRow, 'active_end') ?? readOptional(temporalRow, 'activeEnd') ?? null, 'temporal.active_end'),
        }
      : null,
  }
}

function parsePromptAction(raw: unknown, field: string): DaemonPromptActionView {
  if (typeof raw === 'string') {
    return { id: raw, label: raw }
  }
  const row = asRecord(raw, field)
  return {
    id: asString(read(row, 'id'), `${field}.id`),
    label: asString(readOptional(row, 'label') ?? read(row, 'id'), `${field}.label`),
  }
}

function toNullableRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null
  if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>
  return null
}
