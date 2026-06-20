export interface DaemonExecutionEvent {
  eventId: string;
  payload: unknown;
}

export interface StreamOptions {
  baseUrl: string;
  ssePath?: string;
  getAccessToken?: () => Promise<string | null>;
  onEvent: (event: DaemonExecutionEvent) => void;
  connectImpl?: (url: string, token: string | null) => Promise<StreamConnection>;
  reconnectDelayMs?: number;
  maxReconnectDelayMs?: number;
}

export interface StreamConnection {
  onmessage: ((event: { data: string }) => void) | null;
  onerror: ((event: Event) => void) | null;
  close(): void;
}

const MAX_SEEN_EVENT_IDS = 10_000;

export function openExecutionStream({
  baseUrl,
  ssePath = "/read/events/state",
  getAccessToken,
  onEvent,
  connectImpl = defaultConnect,
  reconnectDelayMs = 1_000,
  maxReconnectDelayMs = 30_000,
}: StreamOptions): { close(): void } {
  let closed = false;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let connection: StreamConnection | null = null;
  let consecutiveFailures = 0;
  const seenEventIds = new Set<string>();
  const normalizedBaseUrl = trimTrailingSlash(baseUrl);

  void connect();

  return {
    close() {
      closed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (connection) {
        connection.close();
        connection = null;
      }
    },
  };

  function getReconnectDelay(): number {
    return Math.min(reconnectDelayMs * 2 ** consecutiveFailures, maxReconnectDelayMs);
  }

  async function connect(): Promise<void> {
    if (closed) return;
    try {
      const token = getAccessToken ? await getAccessToken() : null;
      const nextConnection = await connectImpl(`${normalizedBaseUrl}${ssePath}`, token);
      if (closed) {
        nextConnection.close();
        return;
      }
      connection = nextConnection;
      consecutiveFailures = 0;
      nextConnection.onmessage = (event) => {
        const parsed = parseExecutionEvent(event.data);
        if (!parsed) return;
        if (parsed.eventId === "state-connected") return;
        if (seenEventIds.has(parsed.eventId)) return;
        addSeenEventId(parsed.eventId);
        onEvent(parsed);
      };
      nextConnection.onerror = () => {
        if (closed) return;
        if (connection) {
          connection.close();
          connection = null;
        }
        consecutiveFailures++;
        if (reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          void connect();
        }, getReconnectDelay());
      };
    } catch {
      if (closed) return;
      consecutiveFailures++;
      if (reconnectTimer) return;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        void connect();
      }, getReconnectDelay());
    }
  }

  function addSeenEventId(eventId: string) {
    seenEventIds.add(eventId);
    if (seenEventIds.size <= MAX_SEEN_EVENT_IDS) return;
    const oldest = seenEventIds.values().next().value;
    if (oldest) {
      seenEventIds.delete(oldest);
    }
  }
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

let fallbackEventCounter = 0;

function parseExecutionEvent(raw: string): DaemonExecutionEvent | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    const eventIdRaw = row.event_id ?? row.eventId;
    const eventId = typeof eventIdRaw === "string" ? eventIdRaw : `state-${++fallbackEventCounter}`;
    return {
      eventId,
      payload: row.payload ?? row.event ?? null,
    };
  } catch {
    return {
      eventId: `state-${++fallbackEventCounter}`,
      payload: raw,
    };
  }
}

async function defaultConnect(url: string, token: string | null): Promise<StreamConnection> {
  // Native EventSource cannot send Authorization headers. The query-param token
  // preserves the current SSE path, but it exposes credentials to URL surfaces
  // like logs/history/devtools. Prefer short-lived tokens here, or switch this
  // stream to a fetch-based SSE client if header-based auth becomes necessary.
  const streamUrl = token
    ? `${url}${url.includes("?") ? "&" : "?"}access_token=${encodeURIComponent(token)}`
    : url;
  const eventSource = new EventSource(streamUrl) as unknown as StreamConnection;
  return eventSource;
}
