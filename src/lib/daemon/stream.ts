export interface DaemonExecutionEvent {
  eventId: string
  payload: unknown
}

export interface StreamOptions {
  baseUrl: string
  getAccessToken?: () => Promise<string | null>
  onEvent: (event: DaemonExecutionEvent) => void
  connectImpl?: (url: string, token: string | null) => Promise<StreamConnection>
  reconnectDelayMs?: number
}

export interface StreamConnection {
  onmessage: ((event: { data: string }) => void) | null
  onerror: ((event: Event) => void) | null
  close(): void
}

export function openExecutionStream({
  baseUrl,
  getAccessToken,
  onEvent,
  connectImpl = defaultConnect,
  reconnectDelayMs = 1_000,
}: StreamOptions): { close(): void } {
  let closed = false
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let connection: StreamConnection | null = null
  const seenEventIds = new Set<string>()
  const normalizedBaseUrl = trimTrailingSlash(baseUrl)

  void connect()

  return {
    close() {
      closed = true
      if (reconnectTimer) {
        clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      if (connection) {
        connection.close()
        connection = null
      }
    },
  }

  async function connect(): Promise<void> {
    if (closed) return
    try {
      const token = getAccessToken ? await getAccessToken() : null
      const nextConnection = await connectImpl(`${normalizedBaseUrl}/execution/stream`, token)
      if (closed) {
        nextConnection.close()
        return
      }
      connection = nextConnection
      nextConnection.onmessage = event => {
        const parsed = parseExecutionEvent(event.data)
        if (!parsed) return
        if (seenEventIds.has(parsed.eventId)) return
        seenEventIds.add(parsed.eventId)
        onEvent(parsed)
      }
      nextConnection.onerror = () => {
        if (closed) return
        if (connection) {
          connection.close()
          connection = null
        }
        if (reconnectTimer) return
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null
          void connect()
        }, reconnectDelayMs)
      }
    } catch {
      if (closed) return
      if (reconnectTimer) return
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null
        void connect()
      }, reconnectDelayMs)
    }
  }
}

function trimTrailingSlash(value: string): string {
  return value.endsWith('/') ? value.slice(0, -1) : value
}

function parseExecutionEvent(raw: string): DaemonExecutionEvent | null {
  try {
    const value = JSON.parse(raw) as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    const row = value as Record<string, unknown>
    const eventIdRaw = row.event_id ?? row.eventId
    if (typeof eventIdRaw !== 'string') return null
    return {
      eventId: eventIdRaw,
      payload: row.payload ?? row.event ?? null,
    }
  } catch {
    return null
  }
}

async function defaultConnect(url: string, token: string | null): Promise<StreamConnection> {
  const streamUrl = token
    ? `${url}${url.includes('?') ? '&' : '?'}access_token=${encodeURIComponent(token)}`
    : url
  const eventSource = new EventSource(streamUrl) as unknown as StreamConnection
  return eventSource
}
