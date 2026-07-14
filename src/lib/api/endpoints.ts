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

const LEGACY_ENDPOINTS = {
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
  // Owner profile (v1/15 §4 read-model fallback chain).
  // GET is public so the unauthenticated probe + avatar fallback
  // chain can render avatars without a bearer token; PATCH requires
  // the caller to own the profile (enforced server-side).
  getOwnerProfile: {
    method: "GET",
    path: "/v1/owners/{kind}/{id}/profile",
    tag: "Read",
    summary: "Get owner profile",
    auth: false,
    keywords: ["owner", "profile"],
  } as EndpointMeta,
  patchOwnerProfile: {
    method: "PATCH",
    path: "/v1/owners/{kind}/{id}/profile",
    tag: "Commands",
    summary: "Patch owner profile",
    auth: true,
    keywords: ["owner", "profile", "update"],
  } as EndpointMeta,
  // Avatar upload (v1/15 §3).  Both steps require auth: the client
  // must prove it owns the target owner in create, and the commit
  // path also enforces ownership via the HMAC claim_token + session.
  createAvatarUpload: {
    method: "POST",
    path: "/v1/uploads/avatar",
    tag: "Commands",
    summary: "Create avatar upload (presigned PUT URL + claim)",
    auth: true,
    keywords: ["avatar", "upload", "presign"],
  } as EndpointMeta,
  commitAvatarUpload: {
    method: "POST",
    path: "/v1/uploads/avatar/{upload_id}/commit",
    tag: "Commands",
    summary: "Commit avatar upload",
    auth: true,
    keywords: ["avatar", "upload", "commit"],
  } as EndpointMeta,
} as const;

type CoreMethod = EndpointMeta["method"];

/**
 * The authoritative v1 operation inventory.  Keep this in lockstep with the
 * Router in `tastile-core/crates/v1/api/src/main.rs`; API Explorer consumes it
 * directly, so every exposed method has a runnable catalog entry.
 */
const CORE_V1_OPERATION_DEFINITIONS = `
POST /v1/tiles
GET /v1/tiles
GET /v1/tiles/{id}
DELETE /v1/tiles/{id}
GET /v1/tiles/{id}/detail
GET /v1/tiles/{id}/editable
POST /v1/tiles/{id}/plan
POST /v1/tiles/{id}/update
POST /v1/tiles/{id}/complete
POST /v1/tiles/{id}/defer
POST /v1/tiles/{id}/extend-phase
POST /v1/tiles/{id}/start
POST /v1/tiles/{id}/memos
POST /v1/schedule-definitions
POST /v1/placements
GET /v1/placements
GET /v1/placements/{id}
POST /v1/placements/{id}/changes
POST /v1/placements/{id}/executions
POST /v1/placements/{id}/close
POST /v1/placements/{id}/detach
GET /v1/executions/{id}
GET /v1/executions/{id}/basis
GET /v1/executions/{id}/view
POST /v1/executions/{id}/pause
POST /v1/executions/{id}/resume
POST /v1/executions/{id}/finish
GET /v1/timeline
GET /v1/timeline/today
GET /v1/source-tiles
POST /v1/source-tiles
GET /v1/source-tiles/{id}
PUT /v1/source-tiles/{id}
POST /v1/source-tiles/{id}/reflow
GET /v1/source-tiles/{id}/placements
GET /v1/schedule-reference-catalog
POST /v1/schedule-drafts
GET /v1/schedule-drafts/{id}
POST /v1/schedule-drafts/{id}/operations
GET /v1/sync
GET /v1/change-sets/{id}
GET /v1/recurring/{id}
GET /v1/recurring/{id}/rules
POST /v1/recurring/{id}/rules
GET /v1/recurring/{id}/frame-rules
POST /v1/recurring/{id}/frame-rules
PUT /v1/recurring/{id}/model
GET /v1/recurring/{id}/exceptions
POST /v1/recurring/{id}/exceptions
DELETE /v1/recurring/{id}/exceptions/{key}
GET /v1/recurring/{id}/instances
POST /v1/recurring/{id}/frame-rules/{fid}/lease
DELETE /v1/recurring/{id}/frame-rules/{fid}/lease
POST /v1/recurring/{id}/frame-rules/{fid}/materialize
GET /v1/calendar/day
GET /v1/calendar/week
GET /v1/calendar/month
GET /v1/calendar/year
GET /v1/events
POST /v1/events
GET /v1/events/occurrences
GET /v1/events/{id}
PATCH /v1/events/{id}
DELETE /v1/events/{id}
GET /v1/conditions/{id}
GET /v1/plans/{id}
GET /v1/windows/{id}
POST /v1/windows
POST /v1/windows/{id}/rules
POST /v1/plans/{id}/references
POST /v1/plans/{id}/metrics
GET /v1/flows/{id}
POST /v1/flows
GET /v1/decisions/{id}
POST /v1/decisions
GET /v1/sessions/{id}
POST /v1/sessions
POST /v1/sessions/{id}/feedback
GET /v1/sessions/{id}/deliveries
POST /v1/sessions/{id}/deliveries
GET /v1/work-items/{id}
POST /v1/work-items
GET /v1/endpoints
POST /v1/endpoints
DELETE /v1/endpoints/{id}
GET /v1/deliveries/{id}
POST /v1/deliveries/{id}/delivered
POST /v1/deliveries/{id}/failed
GET /v1/endpoints/{id}/deliveries
GET /v1/access/capabilities
GET /v1/access/subjects
POST /v1/access/subjects
GET /v1/access/subjects/{id}
PATCH /v1/access/subjects/{id}
DELETE /v1/access/subjects/{id}
POST /v1/access/workspaces
GET /v1/access/subjects/by-external
POST /v1/access/offers
POST /v1/access/requests
GET /v1/access/grants
GET /v1/access/grants/pending-for-me
GET /v1/access/grants/{id}
POST /v1/access/grants/{id}/accept
POST /v1/access/grants/{id}/decline
POST /v1/access/grants/{id}/approve
POST /v1/access/grants/{id}/deny
POST /v1/access/grants/{id}/revoke
POST /v1/access/grants/{id}/withdraw
GET /v1/access/grants/{id}/audit
GET /v1/access/notifications
POST /v1/access/notifications/read-all
POST /v1/access/notifications/{id}/read
GET /v1/owners/{kind}/{id}/profile
PATCH /v1/owners/{kind}/{id}/profile
POST /v1/uploads/avatar
POST /v1/uploads/avatar/{upload_id}/commit
GET /v1/scopes/{kind}/{id}/members/{actor_kind}/{actor_id}/profile
PUT /v1/scopes/{kind}/{id}/members/{actor_kind}/{actor_id}/profile-override
DELETE /v1/scopes/{kind}/{id}/members/{actor_kind}/{actor_id}/profile-override
GET /v1/api-tokens
POST /v1/api-tokens
PATCH /v1/api-tokens/{id}
DELETE /v1/api-tokens/{id}
GET /v1/labels
GET /v1/active-tile
GET /v1/candidates
POST /v1/prompts
GET /v1/prompts/pending
POST /v1/prompts/startup-recovery
POST /v1/tick
POST /v1/tick-at
POST /v1/tick-range
GET /v1/quota/tiles
GET /v1/runtime/paths
POST /v1/runtime/paths
POST /v1/auth/signup
POST /v1/auth/signin
POST /v1/auth/signout
GET /v1/auth/session
POST /v1/auth/session/restore
POST /v1/auth/oauth/start
POST /v1/auth/oauth/exchange
GET /v1/auth/callback
GET /v1/auth/oauth/status
GET /v1/health
GET /v1/ready
GET /v1/version
GET /v1/openapi.json
GET /v1/debug/events
`
  .trim()
  .split("\n") as readonly `${CoreMethod} /v1${string}`[];

function coreTag(path: string, method: CoreMethod): ApiTag {
  if (path.startsWith("/v1/auth") || path.startsWith("/v1/api-tokens")) return "Auth";
  if (["/v1/health", "/v1/ready", "/v1/version", "/v1/openapi.json"].includes(path))
    return "Public";
  if (path.startsWith("/v1/debug")) return "Debug";
  if (path.startsWith("/v1/prompts")) return "Prompts";
  return method === "GET" ? "Read" : "Commands";
}

function coreOperationKey(method: CoreMethod, path: string): string {
  return `core${method[0]}${path
    .replace(/^\/v1\/?/, "")
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, "")}`;
}

/** Every concrete method/path pair registered by tastile-core's v1 Router. */
export const CORE_V1_ENDPOINTS: readonly EndpointMeta[] = CORE_V1_OPERATION_DEFINITIONS.map(
  (line) => {
    const [method, path] = line.split(" ") as [CoreMethod, string];
    const tag = coreTag(path, method);
    return {
      method,
      path,
      tag,
      summary: `${method} ${path.replace("/v1/", "")}`,
      auth: tag !== "Public" && !path.startsWith("/v1/auth/"),
      keywords: [method.toLowerCase(), ...path.split("/").filter(Boolean).slice(1)],
    };
  },
);

const CORE_V1_ENDPOINT_RECORD: Record<string, EndpointMeta> = Object.fromEntries(
  CORE_V1_ENDPOINTS.map((endpoint) => [coreOperationKey(endpoint.method, endpoint.path), endpoint]),
);

// Keep legacy named entries available for existing dashboard callers while the
// canonical v1 inventory powers the explorer and exposes every core route.
export const ENDPOINTS = { ...LEGACY_ENDPOINTS, ...CORE_V1_ENDPOINT_RECORD } as const;

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
