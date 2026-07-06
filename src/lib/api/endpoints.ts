/**
 * Tastile Core API client — typed wrapper for all 40+ endpoints
 * declared in `public/openapi.yaml`.
 *
 * The client is intentionally transport-agnostic: it returns a
 * `Result<T, ApiError>` rather than throwing, so the UI can render
 * structured failure states (conflict, not found, unauthenticated).
 *
 * Auth: browser code must NEVER receive or depend on Cognito
 * id_token / refresh_token. When `useProxyBridge` is true, all calls
 * go through `/api/proxy` which attaches the v1 bearer token (or the
 * web-bridge headers) server-side from the httpOnly cookie. When the
 * client targets the local v1 daemon directly (e.g. E2E bypass mode)
 * the server is configured to trust unauthenticated dev actors, so
 * no client-side bearer token is sent. The legacy `tokenProvider`
 * hook is retained only for forward-compatibility and always returns
 * null in browser code.
 */

export type ApiErrorKind =
  | "unauthorized"
  | "not_found"
  | "conflict"
  | "validation"
  | "server"
  | "network";

export interface ApiError {
  kind: ApiErrorKind;
  status: number;
  message: string;
  body: unknown;
}

export type Result<T> =
  | { ok: true; data: T; status: number; latencyMs: number }
  | { ok: false; error: ApiError };

export type ApiTag = "Public" | "Auth" | "Commands" | "Read" | "Views" | "Prompts" | "Debug";

export interface EndpointMeta {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string;
  tag: ApiTag;
  summary: string;
  /** A short hint for keyboard / command palette search. */
  keywords: string[];
  /** Whether the endpoint requires authentication. */
  auth: boolean;
}

export const ENDPOINTS = {
  // Public
  getHealth: {
    method: "GET",
    path: "/health",
    tag: "Public",
    summary: "Health check",
    auth: false,
    keywords: ["ping", "status"],
  } as EndpointMeta,
  getReady: {
    method: "GET",
    path: "/ready",
    tag: "Public",
    summary: "Readiness check",
    auth: false,
    keywords: ["ready", "warmup"],
  } as EndpointMeta,
  getVersion: {
    method: "GET",
    path: "/version",
    tag: "Public",
    summary: "Version info",
    auth: false,
    keywords: ["version", "build", "release"],
  } as EndpointMeta,
  getRuntimePaths: {
    method: "GET",
    path: "/read/runtime-paths",
    tag: "Public",
    summary: "Runtime paths",
    auth: false,
    keywords: ["paths", "storage", "debug"],
  } as EndpointMeta,

  // Auth
  startOAuth: {
    method: "POST",
    path: "/auth/oauth/start",
    tag: "Auth",
    summary: "Start OAuth flow",
    auth: false,
    keywords: ["oauth", "signin", "login"],
  } as EndpointMeta,
  getOAuthStatus: {
    method: "GET",
    path: "/auth/oauth/status",
    tag: "Auth",
    summary: "OAuth status",
    auth: false,
    keywords: ["oauth", "status"],
  } as EndpointMeta,
  exchangeOAuthCode: {
    method: "POST",
    path: "/auth/oauth/exchange",
    tag: "Auth",
    summary: "Exchange OAuth code",
    auth: false,
    keywords: ["oauth", "exchange"],
  } as EndpointMeta,
  oauthCallback: {
    method: "GET",
    path: "/auth/callback",
    tag: "Auth",
    summary: "OAuth callback",
    auth: false,
    keywords: ["callback"],
  } as EndpointMeta,
  signIn: {
    method: "POST",
    path: "/auth/signin",
    tag: "Auth",
    summary: "Sign in",
    auth: false,
    keywords: ["signin", "login"],
  } as EndpointMeta,
  signUp: {
    method: "POST",
    path: "/auth/signup",
    tag: "Auth",
    summary: "Sign up",
    auth: false,
    keywords: ["signup", "register"],
  } as EndpointMeta,
  signOut: {
    method: "POST",
    path: "/auth/signout",
    tag: "Auth",
    summary: "Sign out",
    auth: false,
    keywords: ["signout", "logout"],
  } as EndpointMeta,
  getSession: {
    method: "GET",
    path: "/auth/session",
    tag: "Auth",
    summary: "Current session",
    auth: true,
    keywords: ["session", "me"],
  } as EndpointMeta,
  getTileQuota: {
    method: "GET",
    path: "/auth/tile-quota",
    tag: "Auth",
    summary: "Tile quota",
    auth: true,
    keywords: ["quota", "limit", "plan"],
  } as EndpointMeta,
  restoreSession: {
    method: "POST",
    path: "/auth/session/restore",
    tag: "Auth",
    summary: "Restore session",
    auth: false,
    keywords: ["restore", "session"],
  } as EndpointMeta,

  // Commands
  createTile: {
    method: "POST",
    path: "/commands/tile/create",
    tag: "Commands",
    summary: "Create tile",
    auth: true,
    keywords: ["create", "tile", "new"],
  } as EndpointMeta,
  startTile: {
    method: "POST",
    path: "/commands/tile/start",
    tag: "Commands",
    summary: "Start tile",
    auth: true,
    keywords: ["start", "run", "tile"],
  } as EndpointMeta,
  completeTile: {
    method: "POST",
    path: "/commands/tile/complete",
    tag: "Commands",
    summary: "Complete tile",
    auth: true,
    keywords: ["complete", "done", "tile"],
  } as EndpointMeta,
  deferTile: {
    method: "POST",
    path: "/commands/tile/defer",
    tag: "Commands",
    summary: "Defer tile",
    auth: true,
    keywords: ["defer", "snooze", "tile"],
  } as EndpointMeta,
  deleteTile: {
    method: "POST",
    path: "/commands/tile/delete",
    tag: "Commands",
    summary: "Delete tile",
    auth: true,
    keywords: ["delete", "remove", "tile"],
  } as EndpointMeta,
  updateTile: {
    method: "POST",
    path: "/commands/tile/update",
    tag: "Commands",
    summary: "Update tile",
    auth: true,
    keywords: ["update", "edit", "tile"],
  } as EndpointMeta,
  extendTile: {
    method: "POST",
    path: "/commands/tile/extend",
    tag: "Commands",
    summary: "Extend tile",
    auth: true,
    keywords: ["extend", "more", "tile"],
  } as EndpointMeta,
  attachMemo: {
    method: "POST",
    path: "/commands/memo/attach",
    tag: "Commands",
    summary: "Attach memo",
    auth: true,
    keywords: ["memo", "note", "attach"],
  } as EndpointMeta,
  startBreak: {
    method: "POST",
    path: "/commands/break/start",
    tag: "Commands",
    summary: "Start break",
    auth: true,
    keywords: ["break", "rest", "pause"],
  } as EndpointMeta,
  endBreak: {
    method: "POST",
    path: "/commands/break/end",
    tag: "Commands",
    summary: "End break",
    auth: true,
    keywords: ["break", "end", "resume"],
  } as EndpointMeta,
  listRecurringTiles: {
    method: "GET",
    path: "/commands/recurring-tile",
    tag: "Commands",
    summary: "List recurring tiles",
    auth: true,
    keywords: ["recurring", "list", "templates"],
  } as EndpointMeta,
  getRecurringTile: {
    method: "GET",
    path: "/commands/recurring-tile/{id}",
    tag: "Commands",
    summary: "Get recurring tile",
    auth: true,
    keywords: ["recurring", "get"],
  } as EndpointMeta,
  putRecurringTile: {
    method: "PUT",
    path: "/commands/recurring-tile/{id}",
    tag: "Commands",
    summary: "Update recurring tile",
    auth: true,
    keywords: ["recurring", "update"],
  } as EndpointMeta,
  respondStartupRecovery: {
    method: "POST",
    path: "/commands/prompt/respond-startup-recovery",
    tag: "Commands",
    summary: "Respond startup recovery",
    auth: true,
    keywords: ["recovery", "startup", "prompt"],
  } as EndpointMeta,
  requestPrompt: {
    method: "POST",
    path: "/commands/prompt/request",
    tag: "Commands",
    summary: "Request prompt",
    auth: true,
    keywords: ["prompt", "request"],
  } as EndpointMeta,
  tick: {
    method: "POST",
    path: "/commands/tick",
    tag: "Commands",
    summary: "Tick (advance time)",
    auth: true,
    keywords: ["tick", "advance"],
  } as EndpointMeta,
  tickAt: {
    method: "POST",
    path: "/commands/tick-at",
    tag: "Commands",
    summary: "Tick at timestamp",
    auth: true,
    keywords: ["tick", "at"],
  } as EndpointMeta,
  tickRange: {
    method: "POST",
    path: "/commands/tick-range",
    tag: "Commands",
    summary: "Tick range",
    auth: true,
    keywords: ["tick", "range"],
  } as EndpointMeta,

  // Read
  getTiles: {
    method: "GET",
    path: "/read/tiles",
    tag: "Read",
    summary: "List tiles",
    auth: true,
    keywords: ["tiles", "list"],
  } as EndpointMeta,
  getTile: {
    method: "GET",
    path: "/read/tile/{id}",
    tag: "Read",
    summary: "Get tile by id",
    auth: true,
    keywords: ["tile", "detail"],
  } as EndpointMeta,
  getEditableTile: {
    method: "GET",
    path: "/read/tile/{id}/editable",
    tag: "Read",
    summary: "Get editable tile",
    auth: true,
    keywords: ["tile", "edit"],
  } as EndpointMeta,
  getTilesInProgress: {
    method: "GET",
    path: "/read/tiles-in-progress",
    tag: "Read",
    summary: "Tiles in progress",
    auth: true,
    keywords: ["tiles", "active", "progress"],
  } as EndpointMeta,
  getActiveTile: {
    method: "GET",
    path: "/read/active-tile",
    tag: "Read",
    summary: "Active tile",
    auth: true,
    keywords: ["active", "tile"],
  } as EndpointMeta,
  getExecution: {
    method: "GET",
    path: "/read/execution",
    tag: "Read",
    summary: "Execution state",
    auth: true,
    keywords: ["execution", "state"],
  } as EndpointMeta,
  getExecutionView: {
    method: "GET",
    path: "/read/execution-view",
    tag: "Read",
    summary: "Execution view",
    auth: true,
    keywords: ["execution", "view"],
  } as EndpointMeta,
  getEventsState: {
    method: "GET",
    path: "/read/events/state",
    tag: "Read",
    summary: "Events state",
    auth: true,
    keywords: ["events", "state"],
  } as EndpointMeta,
  getPlacements: {
    method: "GET",
    path: "/read/placements",
    tag: "Read",
    summary: "Placement rows (work ↔ time-block allocations)",
    auth: true,
    keywords: ["placements", "schedule", "allocations"],
  } as EndpointMeta,
  getCandidates: {
    method: "GET",
    path: "/read/candidates",
    tag: "Read",
    summary: "Unscheduled work candidates",
    auth: true,
    keywords: ["candidates", "unscheduled", "queue"],
  } as EndpointMeta,

  // Views
  getTileList: {
    method: "GET",
    path: "/views/tile-list",
    tag: "Views",
    summary: "Tile list view",
    auth: true,
    keywords: ["view", "tile", "list"],
  } as EndpointMeta,
  getActiveTileView: {
    method: "GET",
    path: "/views/active-tile",
    tag: "Views",
    summary: "Active tile view",
    auth: true,
    keywords: ["view", "active"],
  } as EndpointMeta,
  getPendingPrompt: {
    method: "GET",
    path: "/views/pending-prompt",
    tag: "Views",
    summary: "Pending prompt",
    auth: true,
    keywords: ["prompt", "pending"],
  } as EndpointMeta,
  getTimelineToday: {
    method: "GET",
    path: "/views/timeline/today",
    tag: "Views",
    summary: "Timeline today",
    auth: true,
    keywords: ["timeline", "today"],
  } as EndpointMeta,
  getCalendarDay: {
    method: "GET",
    path: "/views/calendar/day",
    tag: "Views",
    summary: "Calendar day",
    auth: true,
    keywords: ["calendar", "day"],
  } as EndpointMeta,
  getCalendarWeek: {
    method: "GET",
    path: "/views/calendar/week",
    tag: "Views",
    summary: "Calendar week",
    auth: true,
    keywords: ["calendar", "week"],
  } as EndpointMeta,
  getCalendarMonth: {
    method: "GET",
    path: "/views/calendar/month",
    tag: "Views",
    summary: "Calendar month",
    auth: true,
    keywords: ["calendar", "month"],
  } as EndpointMeta,
  getCalendarYear: {
    method: "GET",
    path: "/views/calendar/year",
    tag: "Views",
    summary: "Calendar year",
    auth: true,
    keywords: ["calendar", "year"],
  } as EndpointMeta,

  // Prompts
  getCurrentPrompt: {
    method: "GET",
    path: "/prompts/current",
    tag: "Prompts",
    summary: "Current prompt",
    auth: true,
    keywords: ["prompt", "current"],
  } as EndpointMeta,

  // Debug
  getDebugEvents: {
    method: "GET",
    path: "/debug/events",
    tag: "Debug",
    summary: "Debug events",
    auth: true,
    keywords: ["debug", "events", "log"],
  } as EndpointMeta,

  // Access (projects/workspaces)
  listMyWorkspaces: {
    method: "GET",
    path: "/access/subjects?kind=1",
    tag: "Read",
    summary: "List workspaces owned by me",
    auth: true,
    keywords: ["workspaces", "projects", "list"],
  } as EndpointMeta,
  createWorkspace: {
    method: "POST",
    path: "/access/workspaces",
    tag: "Commands",
    summary: "Create workspace",
    auth: true,
    keywords: ["workspace", "project", "create"],
  } as EndpointMeta,
  updateSubject: {
    method: "PATCH",
    path: "/access/subjects/{id}",
    tag: "Commands",
    summary: "Update workspace",
    auth: true,
    keywords: ["workspace", "update"],
  } as EndpointMeta,
  deleteSubject: {
    method: "DELETE",
    path: "/access/subjects/{id}",
    tag: "Commands",
    summary: "Delete workspace",
    auth: true,
    keywords: ["workspace", "delete"],
  } as EndpointMeta,
} as const;

export type EndpointKey = keyof typeof ENDPOINTS;

export const ENDPOINTS_BY_TAG: Record<ApiTag, EndpointKey[]> = Object.entries(ENDPOINTS).reduce(
  (acc, [key, meta]) => {
    acc[meta.tag as ApiTag].push(key as EndpointKey);
    return acc;
  },
  {
    Public: [],
    Auth: [],
    Commands: [],
    Read: [],
    Views: [],
    Prompts: [],
    Debug: [],
  } as Record<ApiTag, EndpointKey[]>,
);

export const TAG_ORDER: ApiTag[] = [
  "Public",
  "Auth",
  "Commands",
  "Read",
  "Views",
  "Prompts",
  "Debug",
];

// ============================================================================
// Client
// ============================================================================

export interface CoreClientConfig {
  baseUrl: string;
  tokenProvider: () => string | null | Promise<string | null>;
  fetchImpl?: typeof fetch;
  useProxyBridge?: boolean;
}

export class CoreClient {
  private baseUrl: string;
  private tokenProvider: () => string | null | Promise<string | null>;
  private fetchImpl: typeof fetch;
  private useProxyBridge: boolean;

  constructor(config: CoreClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/$/, "");
    this.tokenProvider = config.tokenProvider;
    this.fetchImpl = config.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.useProxyBridge = config.useProxyBridge ?? false;
  }

  async call<T = unknown>(
    key: EndpointKey,
    options: {
      pathParams?: Record<string, string>;
      query?: Record<string, string | number | boolean | undefined>;
      body?: unknown;
    } = {},
  ): Promise<Result<T>> {
    const meta = ENDPOINTS[key];
    const started = performance.now();
    let path = meta.path;
    if (options.pathParams) {
      for (const [k, v] of Object.entries(options.pathParams)) {
        path = path.replace(`{${k}}`, encodeURIComponent(v));
      }
    }
    const requestPath = this.useProxyBridge ? path : toV1CorePath(path);
    let rawUrl = this.baseUrl + requestPath;
    if (rawUrl.startsWith("/")) {
      const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost";
      rawUrl = origin + rawUrl;
    }
    const url = new URL(rawUrl);
    if (options.query) {
      for (const [k, v] of Object.entries(options.query)) {
        if (v === undefined) continue;
        url.searchParams.set(k, String(v));
      }
    }
    const headers: Record<string, string> = {
      accept: "application/json",
    };
    if (meta.method !== "GET" && options.body !== undefined) {
      headers["content-type"] = "application/json";
    }
    if (meta.auth && !this.useProxyBridge) {
      const token = await this.tokenProvider();
      if (token) headers.authorization = `Bearer ${token}`;
    }

    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method: meta.method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
        cache: "no-store",
      });
    } catch (err) {
      return {
        ok: false,
        error: {
          kind: "network",
          status: 0,
          message: err instanceof Error ? err.message : "Network error",
          body: null,
        },
      };
    }

    const latencyMs = Math.round(performance.now() - started);
    const text = await response.text();
    let body: unknown = null;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }
    if (!response.ok) {
      return {
        ok: false,
        error: {
          kind: classifyStatus(response.status),
          status: response.status,
          message:
            (body && typeof body === "object" && "error" in body
              ? String((body as { error: unknown }).error)
              : null) ?? response.statusText,
          body,
        },
      };
    }
    return { ok: true, data: body as T, status: response.status, latencyMs };
  }
}

function classifyStatus(status: number): ApiErrorKind {
  if (status === 401) return "unauthorized";
  if (status === 404) return "not_found";
  if (status === 409) return "conflict";
  if (status === 422 || status === 400) return "validation";
  if (status >= 500) return "server";
  return "server";
}

function toV1CorePath(path: string): string {
  const map: Record<string, string> = {
    "/health": "/v1/health",
    "/ready": "/v1/ready",
    "/version": "/v1/version",
    "/read/runtime-paths": "/v1/runtime/paths",
    "/auth/session": "/v1/auth/session",
    "/auth/session/restore": "/v1/auth/session/restore",
    "/auth/tile-quota": "/v1/quota/tiles",
    "/read/tiles": "/v1/tiles",
    "/views/tile-list": "/v1/tiles",
    "/read/active-tile": "/v1/active-tile",
    "/views/active-tile": "/v1/active-tile",
    "/read/execution-view": "/v1/active-tile",
    "/read/placements": "/v1/placements",
    "/read/candidates": "/v1/candidates",
    "/views/timeline/today": "/v1/timeline/today",
    "/views/calendar/day": "/v1/calendar/day",
    "/views/calendar/week": "/v1/calendar/week",
    "/views/calendar/month": "/v1/calendar/month",
    "/views/calendar/year": "/v1/calendar/year",
    "/views/pending-prompt": "/v1/prompts/pending",
    "/prompts/current": "/v1/prompts/pending",
    "/debug/events": "/v1/debug/events",
    "/access/subjects": "/v1/access/subjects",
    "/access/workspaces": "/v1/access/workspaces",
    "/access/subjects/{id}": "/v1/access/subjects/{id}",
  };
  if (map[path]) return map[path];
  // Parameterized paths: {id} is a UUIDv7, preserved verbatim.
  return path
    .replace(/^\/read\/tile\/([^/]+)$/, "/v1/tiles/$1")
    .replace(/^\/read\/tile\/([^/]+)\/editable$/, "/v1/tiles/$1/editable")
    .replace(/^\/read\/placement\/([^/]+)$/, "/v1/placements/$1")
    .replace(/^\/read\/execution\/([^/]+)$/, "/v1/executions/$1");
}

// ============================================================================
// Singleton — lazily instantiated; null until first use.
// ============================================================================

let _client: CoreClient | null = null;

function shouldUseProxyBridge(url: string): boolean {
  if (process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === "1") {
    return true;
  }
  if (typeof window !== "undefined" && window.location.protocol === "https:") {
    return true;
  }
  try {
    const parsed = new URL(url);
    return !(
      parsed.hostname === "127.0.0.1" ||
      parsed.hostname === "localhost" ||
      parsed.hostname === "10.0.2.2"
    );
  } catch {
    return false;
  }
}

export function getCoreClient(): CoreClient {
  if (_client) return _client;
  const rawBaseUrl =
    process.env.NEXT_PUBLIC_TASTILE_CORE_URL ??
    process.env.NEXT_PUBLIC_DAEMON_BASE_URL ??
    "http://127.0.0.1:31400";
  const usesCloudProxy = shouldUseProxyBridge(rawBaseUrl);
  const baseUrl = usesCloudProxy ? "/api/proxy" : rawBaseUrl;
  _client = new CoreClient({
    baseUrl,
    useProxyBridge: usesCloudProxy,
    // Browser code never holds Cognito tokens. The proxy bridge adds the
    // v1 bearer token server-side; the local v1 daemon is reached only
    // when `NEXT_PUBLIC_E2E_BYPASS_AUTH=1` and trusts the dev actor.
    tokenProvider: async () => null,
  });
  return _client;
}
