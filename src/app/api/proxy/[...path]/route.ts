import { type NextRequest, NextResponse } from "next/server";
import { v5 as uuidv5 } from "uuid";
import { COOKIE_USER_SUB } from "@/lib/cognito/cookies";
import { parseIdTokenClaims } from "@/lib/cognito/server";

// RFC 4122 NAMESPACE_OID (also matches the uuid crate's
// `Uuid::NAMESPACE_OID`).  The daemon's bridge auth derives the
// v1 owner_id as `Uuid::new_v5(NAMESPACE_OID, user_sub_bytes)`;
// x-owner-id / x-actor-id must mirror that derivation or
// `authorize_or_404` returns 404 for the actor that just wrote the
// tile.
const NS_OID = "6ba7b812-9dad-11d1-80b4-00c04fd430c8";

function bridgeActorId(userSub: string): string {
  return uuidv5(userSub, NS_OID);
}

function getCloudApiBase(): string {
  const value = process.env.CLOUD_API_BASE;
  if (value) return value;
  if (process.env.E2E_BYPASS_AUTH === "1") return "http://localhost:31400";
  throw new Error("CLOUD_API_BASE is not set");
}

function getIsE2EBypass(): boolean {
  return process.env.E2E_BYPASS_AUTH === "1";
}

// In E2E bypass mode the proxy does not validate JWTs, so it pins the
// dev actor to a fixed UUID. The v1 backend auto-creates a USER-kind
// v1_subject row with this same UUID on first workspace creation, so
// it doubles as the actor's own subject id for "Personal" ownership.
const DEV_ACTOR_SUBJECT_ID = "00000000-0000-0000-0000-000000000001";

interface MockTile {
  id: string;
  plan_id: string;
  title: string;
  lifecycle: string;
  next_action: string | null;
  done_definition: string | null;
  worked_minutes: number;
  break_minutes: number;
  semantic_role: string;
  labels: string[];
  objective_mode: string | null;
  target_work_min: number | null;
  target_rest_min: number | null;
  done_rule: string | null;
  resume_note: string | null;
  projected_next_start_at: string | null;
  temporal: Record<string, unknown> | null;
}

const mockTiles: MockTile[] = [];
const mockNotifications: Array<{
  id: string;
  recipient_subject_id: string;
  kind: number;
  grant_id: string | null;
  resource_kind: number | null;
  resource_id: string | null;
  message: string | null;
  created_at: string;
  read_at: string | null;
}> = [];

function generateId(): string {
  return `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function mockTileFromCreate(body: Record<string, unknown>): MockTile {
  const id = generateId();
  const tile = (body.tile ?? body) as Record<string, unknown>;
  const temporal = (tile.temporal ?? {}) as Record<string, unknown>;
  const annotation = (tile.annotation ?? {}) as Record<string, unknown>;
  const objective = (tile.objective ?? {}) as Record<string, unknown>;
  return {
    id,
    plan_id: generateId(),
    title: String(tile.title ?? body.title ?? "Untitled"),
    lifecycle: "ready",
    next_action: (tile.next_action as string) ?? null,
    done_definition: ((tile.core as Record<string, unknown>)?.done_definition as string) ?? null,
    worked_minutes: 0,
    break_minutes: 0,
    semantic_role: (annotation.semantic_role as string) ?? "work",
    labels: (annotation.labels as string[]) ?? [],
    objective_mode: (objective.objective_mode as string) ?? null,
    target_work_min: (objective.target_work_min as number) ?? null,
    target_rest_min: (objective.target_rest_min as number) ?? null,
    done_rule: (objective.done_rule as string) ?? null,
    resume_note: null,
    projected_next_start_at: null,
    temporal: {
      tz: null,
      release_at: temporal.release_at ?? null,
      due_at: temporal.due_at ?? null,
      fixed_start: temporal.fixed_start ?? temporal.fixedStart ?? null,
      fixed_end: temporal.fixed_end ?? temporal.fixedEnd ?? null,
      active_start: temporal.active_start ?? temporal.activeStart ?? null,
      active_end: temporal.active_end ?? temporal.activeEnd ?? null,
    },
  };
}

function pushMockNotification(message: string, resourceId: string | null = null): void {
  mockNotifications.unshift({
    id: generateId(),
    recipient_subject_id: DEV_ACTOR_SUBJECT_ID,
    kind: 4,
    grant_id: null,
    resource_kind: resourceId ? 1 : null,
    resource_id: resourceId,
    message,
    created_at: new Date().toISOString(),
    read_at: null,
  });
}

function handleMockRequest(
  path: string,
  method: string,
  body: unknown,
  searchParams: URLSearchParams,
): NextResponse | null {
  if ((path === "read/runtime-paths" || path === "v1/runtime/paths") && method === "GET") {
    return NextResponse.json({
      data_dir: "e2e://data",
      events_path: "e2e://events",
      cache_dir: "e2e://cache",
      log_dir: "e2e://logs",
      config_path: "e2e://config",
    });
  }

  if ((path === "auth/session" || path === "v1/auth/session") && method === "GET") {
    return NextResponse.json({
      owner_id: DEV_ACTOR_SUBJECT_ID,
      authenticated: true,
    });
  }

  if ((path === "auth/tile-quota" || path === "v1/quota/tiles") && method === "GET") {
    return NextResponse.json({
      plan: "free",
      tiles_used: mockTiles.length,
      tiles_limit: 50,
      history_days: 0,
      history_limit_days: 30,
      features: {},
    });
  }

  if (path === "views/pending-prompt" && method === "GET") {
    return NextResponse.json({ prompt: null });
  }

  if (path === "views/timeline/today" && method === "GET") {
    return NextResponse.json({ items: [] });
  }

  if (
    (path === "execution/snapshot" ||
      path === "read/execution-view" ||
      path === "views/active-tile" ||
      path === "read/active-tile" ||
      path === "v1/active-tile") &&
    method === "GET"
  ) {
    const active = mockTiles.find((tile) => tile.lifecycle === "started");
    if (!active) {
      return NextResponse.json({
        is_working: false,
        is_on_break: false,
        is_idle: true,
        main_tile: null,
        main_tile_started_at: null,
        main_tile_ends_at: null,
        tile_count: 0,
        event_count: mockNotifications.length,
        tiles_in_progress: [],
        pending_prompt_id: null,
      });
    }
    const temporal = active.temporal as Record<string, string | null> | null;
    return NextResponse.json({
      is_working: true,
      is_on_break: false,
      is_idle: false,
      main_tile: { id: active.id, title: active.title },
      main_tile_started_at: temporal?.active_start ?? new Date().toISOString(),
      main_tile_ends_at: temporal?.active_end ?? null,
      tile_count: 1,
      event_count: mockNotifications.length,
      tiles_in_progress: [{ id: active.id, title: active.title }],
      pending_prompt_id: null,
    });
  }

  if (path === "sync/status" && method === "GET") {
    return new NextResponse(null, { status: 404 });
  }

  if (
    (path === "read/tiles" || path === "views/tile-list" || path === "v1/tiles") &&
    method === "GET"
  ) {
    return NextResponse.json(path === "read/tiles" ? { tiles: mockTiles } : mockTiles);
  }
  const v1TileMatch = path.match(/^v1\/tiles\/([^/]+)$/);
  if (v1TileMatch && method === "GET") {
    const id = v1TileMatch[1];
    const found = mockTiles.find((t) => t.id === id);
    if (found) return NextResponse.json(found);
    // Synthesize a TileView for ids the mock didn't create itself
    // (e.g. legacy seed data the panel tries to edit). The real
    // backend rejects non-UUID ids, so the proxy must intercept.
    return NextResponse.json({
      ...(mockTiles[0] ?? {}),
      id,
      plan_id: generateId(),
    });
  }

  if (path === "v1/placements" && method === "POST") {
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      accepted_at: new Date().toISOString(),
      request_id: null,
      aggregate: { id: generateId(), kind: 2 },
    });
  }

  if ((path === "commands/tile/create" || path === "v1/tiles") && method === "POST") {
    const tile = mockTileFromCreate(body as Record<string, unknown>);
    mockTiles.push(tile);
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      accepted_at: new Date().toISOString(),
      request_id: null,
      aggregate: { id: tile.id, kind: 1 },
    });
  }

  const v1StartMatch = path.match(/^v1\/tiles\/([^/]+)\/start$/);
  if ((path === "commands/tile/start" || v1StartMatch) && method === "POST") {
    const req = body as Record<string, unknown>;
    const payload = (req.payload ?? req) as Record<string, unknown>;
    const tileId = (v1StartMatch?.[1] ?? payload.tile_id ?? req.tile_id) as string;
    const tile = mockTiles.find((t) => t.id === tileId);
    if (tile) {
      tile.lifecycle = "started";
      tile.temporal = { ...tile.temporal, active_start: new Date().toISOString() };
      pushMockNotification(`${tile.title}を実行中です`, tile.id);
    }
    const placementId = generateId();
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      accepted_at: new Date().toISOString(),
      request_id: null,
      aggregate: { id: placementId, kind: 2 },
    });
  }

  const v1ExecutionMatch = path.match(/^v1\/placements\/([^/]+)\/executions$/);
  if (v1ExecutionMatch && method === "POST") {
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      accepted_at: new Date().toISOString(),
      request_id: null,
      aggregate: { id: generateId(), kind: 3 },
    });
  }

  if (path === "commands/tile/complete" && method === "POST") {
    const req = body as Record<string, unknown>;
    const tileId = req.tile_id as string;
    const tile = mockTiles.find((t) => t.id === tileId);
    if (tile) {
      tile.lifecycle = "done";
      tile.temporal = { ...tile.temporal, active_end: new Date().toISOString() };
      pushMockNotification(`${tile.title}が完了しました`, tile.id);
    }
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      accepted_at: new Date().toISOString(),
      request_id: null,
    });
  }

  if (path === "commands/tile/defer" && method === "POST") {
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      accepted_at: new Date().toISOString(),
      request_id: null,
    });
  }

  if (path === "commands/tile/delete" && method === "POST") {
    const req = body as Record<string, unknown>;
    const tileId = req.tile_id as string;
    const idx = mockTiles.findIndex((t) => t.id === tileId);
    if (idx >= 0) mockTiles.splice(idx, 1);
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      accepted_at: new Date().toISOString(),
      request_id: null,
    });
  }

  if (path === "commands/tile/extend" && method === "POST") {
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      accepted_at: new Date().toISOString(),
      request_id: null,
    });
  }

  if (path === "commands/break/start" && method === "POST") {
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      accepted_at: new Date().toISOString(),
      request_id: null,
    });
  }

  if (path === "commands/break/end" && method === "POST") {
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      accepted_at: new Date().toISOString(),
      request_id: null,
    });
  }

  if (path === "commands/prompt/request" && method === "POST") {
    pushMockNotification("確認が必要な通知があります");
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      accepted_at: new Date().toISOString(),
      request_id: null,
    });
  }

  if (path === "commands/prompt/respond-startup-recovery" && method === "POST") {
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      accepted_at: new Date().toISOString(),
      request_id: null,
    });
  }

  if (path === "auth/session/restore" && method === "POST") {
    return new NextResponse(null, { status: 204 });
  }

  if (path === "auth/integrations/settings" && method === "GET") {
    return NextResponse.json({
      google_calendar: {
        connected: false,
        can_read: false,
        can_write: false,
        account_email: null,
        last_synced_at: null,
      },
    });
  }

  if (path === "auth/integrations/settings" && method === "POST") {
    return NextResponse.json({
      google_calendar: {
        connected: false,
        can_read: false,
        can_write: false,
        account_email: null,
        last_synced_at: null,
      },
    });
  }

  if ((path === "access/notifications" || path === "v1/access/notifications") && method === "GET") {
    const unreadOnly = searchParams.get("unread_only") === "true";
    const limit = Number(searchParams.get("limit") ?? 20);
    const items = mockNotifications
      .filter((item) => !unreadOnly || !item.read_at)
      .slice(0, Number.isFinite(limit) ? limit : 20);
    return NextResponse.json({ count: items.length, items });
  }

  const readMatch = path.match(
    /^(?:access\/notifications|v1\/access\/notifications)\/([^/]+)\/read$/,
  );
  if (readMatch && method === "POST") {
    const item = mockNotifications.find((notification) => notification.id === readMatch[1]);
    if (item) item.read_at = new Date().toISOString();
    return new NextResponse(null, { status: 204 });
  }

  if (
    (path === "access/notifications/read-all" || path === "v1/access/notifications/read-all") &&
    method === "POST"
  ) {
    const now = new Date().toISOString();
    let marked = 0;
    for (const item of mockNotifications) {
      if (!item.read_at) {
        item.read_at = now;
        marked += 1;
      }
    }
    return NextResponse.json({ marked_read: marked });
  }

  const calendarMatch = path.match(/^views\/calendar\/(day|week|month|year)$/);
  if (calendarMatch && method === "GET") {
    const view = calendarMatch[1] as "day" | "week" | "month" | "year";
    const anchor = searchParams.get("anchor") ?? new Date().toISOString().slice(0, 10);
    const parsedAnchor = new Date(anchor);
    const anchorDate = Number.isNaN(parsedAnchor.getTime()) ? new Date() : parsedAnchor;
    const dayStart = new Date(anchorDate);
    const dayEnd = new Date(anchorDate);
    dayEnd.setDate(dayEnd.getDate() + 1);

    const blocks = mockTiles
      .filter((tile) => {
        const temporal = tile.temporal as Record<string, string | null> | null;
        if (!temporal) return true;
        const fixedStart = temporal.fixed_start ? new Date(temporal.fixed_start) : null;
        const activeStart = temporal.active_start ? new Date(temporal.active_start) : null;
        const start = fixedStart ?? activeStart;
        if (!start) return true;
        return start >= dayStart && start < dayEnd;
      })
      .map((tile) => {
        const temporal = tile.temporal as Record<string, string | null>;
        const startStr = temporal?.fixed_start ?? temporal?.active_start ?? dayStart.toISOString();
        const endStr = temporal?.fixed_end ?? temporal?.active_end ?? dayEnd.toISOString();
        return {
          tile_id: tile.id,
          title: tile.title,
          kind: "work" as const,
          is_active: tile.lifecycle === "started",
          start_at: startStr,
          end_at: endStr,
          semantic_role: tile.semantic_role as "work" | "break" | "label",
          all_day: false,
          ownership: "tastile_owned" as const,
          editable: true,
          source_label: "",
        };
      });

    return NextResponse.json({
      view,
      range_start: dayStart.toISOString(),
      range_end: dayEnd.toISOString(),
      grid_start: dayStart.toISOString(),
      grid_end: dayEnd.toISOString(),
      blocks,
      all_day_spans: [],
      overflow_counters: {},
      month_summaries: [],
    });
  }

  return null;
}

async function proxyRequest(request: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const path = pathSegments.join("/");

  if (getIsE2EBypass()) {
    const body =
      request.method !== "GET" && request.method !== "HEAD"
        ? await request
            .clone()
            .json()
            .catch(() => ({}))
        : null;
    const mockResponse = handleMockRequest(
      path,
      request.method,
      body,
      request.nextUrl.searchParams,
    );
    if (mockResponse) return mockResponse;
  }

  if (getIsE2EBypass()) {
    const localResponse = localCompatResponse(path, request.method);
    if (localResponse) return localResponse;
  }

  const upstreamPath = toV1Path(path);
  const targetUrl = `${getCloudApiBase()}/${upstreamPath}`;
  const url = new URL(targetUrl);
  // /v1/timeline/today requires both `start` and `end` query params (both
  // DateTime<Utc>, not Option). The v1 client's getTimelineToday endpoint
  // ships no params, so inject UTC midnight + 24h defaults here so the
  // daemon stops returning 400 on the panel's
  // GET /api/proxy/views/timeline/today.
  const params = new URLSearchParams(request.nextUrl.search);
  if (upstreamPath === "v1/timeline/today") {
    injectTimelineTodayDefaults(params);
  }
  url.search = params.toString();

  const headers = new Headers();
  // The v1 API does not validate Cognito id_tokens. It accepts the
  // long-lived v1_api_token (Bearer) or the web-bridge headers that
  // identify the calling user from the per-request cookies. The browser
  // session has a short-lived id_token that we cannot forward usefully,
  // so we always forward via the bridge: the cookie's user sub is the
  // authoritative identity, the secret gates the trust boundary.
  const bridgeSecret = process.env.TASTILE_WEB_BRIDGE_SECRET;
  const bridgeUserSub = resolveBridgeUserSub(request);
  if (getIsE2EBypass() && isLocalCoreUrl(getCloudApiBase())) {
    // E2E bypass: pin the dev actor and forward to the local v1 API
    // directly. The bridge-secret check is for production deploys.
    headers.set("x-owner-id", DEV_ACTOR_SUBJECT_ID);
    headers.set("x-actor-id", DEV_ACTOR_SUBJECT_ID);
  } else {
    if (!bridgeSecret) {
      return NextResponse.json(
        { error: "web bridge is not configured on the server" },
        { status: 500 },
      );
    }
    if (!bridgeUserSub) {
      return NextResponse.json({ error: "no authenticated session for proxy" }, { status: 407 });
    }
    headers.set("x-tastile-web-bridge-secret", bridgeSecret);
    headers.set("x-tastile-web-session-user", bridgeUserSub);
    // v1 read handlers (read_tile, list_tiles, ...) authorize via
    // `read_actor` which only reads `x-actor-id` (not the bridge
    // headers).  The actor must match the daemon's bridge-derived
    // owner_id (`uuidv5(NAMESPACE_OID, user_sub)`), not the raw sub.
    const actorId = bridgeActorId(bridgeUserSub);
    headers.set("x-owner-id", actorId);
    headers.set("x-actor-id", actorId);
    const apiToken = request.cookies.get("tastile_api_token")?.value;
    if (apiToken) {
      headers.set("authorization", `Bearer ${apiToken}`);
    }
  }
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }

  const init: RequestInit = {
    method: request.method,
    headers,
  };

  if (request.method !== "GET" && request.method !== "HEAD") {
    init.body = await request.arrayBuffer();
  }

  try {
    const upstreamResponse = await fetch(url.toString(), init);
    const responseHeaders = new Headers();
    const ct = upstreamResponse.headers.get("content-type");
    if (ct) responseHeaders.set("content-type", ct);
    const cc = upstreamResponse.headers.get("cache-control");
    if (cc) responseHeaders.set("cache-control", cc);

    const body = await upstreamResponse.text();
    const response = new NextResponse(normalizeCompatResponse(path, body), {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
    return response;
  } catch (error) {
    console.error(`Proxy error for ${path}:`, error);
    return NextResponse.json({ error: "Proxy request failed" }, { status: 502 });
  }
}

function isLocalCoreUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      url.hostname === "127.0.0.1" || url.hostname === "localhost" || url.hostname === "10.0.2.2"
    );
  } catch {
    return false;
  }
}

export function toV1Path(path: string): string {
  const map: Record<string, string> = {
    health: "v1/health",
    ready: "v1/ready",
    version: "v1/version",
    "read/runtime-paths": "v1/runtime/paths",
    "runtime/paths": "v1/runtime/paths",
    "auth/session": "v1/auth/session",
    "auth/session/restore": "v1/auth/session/restore",
    "commands/recurring-tile": "v1/tiles",
    "read/tiles": "v1/tiles",
    "views/tile-list": "v1/tiles",
    "read/active-tile": "v1/active-tile",
    "views/active-tile": "v1/active-tile",
    "read/execution-view": "v1/active-tile",
    "read/placements": "v1/placements",
    "read/candidates": "v1/candidates",
    "views/timeline/today": "v1/timeline/today",
    "views/pending-prompt": "v1/prompts/pending",
    "prompts/current": "v1/prompts/pending",
    "auth/tile-quota": "v1/quota/tiles",
    "debug/events": "v1/debug/events",
    "access/subjects": "v1/access/subjects",
    "access/workspaces": "v1/access/workspaces",
    "access/subjects/by-external": "v1/access/subjects/by-external",
    "access/capabilities": "v1/access/capabilities",
    "access/offers": "v1/access/offers",
    "access/requests": "v1/access/requests",
    "access/grants": "v1/access/grants",
    "access/notifications": "v1/access/notifications",
    "views/calendar/day": "v1/calendar/day",
    "views/calendar/week": "v1/calendar/week",
    "views/calendar/month": "v1/calendar/month",
    "views/calendar/year": "v1/calendar/year",
  };
  if (map[path]) return map[path];
  // Parameterized paths: {id} is a UUIDv7, preserved verbatim.
  const rewritten = path
    .replace(/^read\/tile\/([^/]+)$/, "v1/tiles/$1")
    .replace(/^read\/tile\/([^/]+)\/editable$/, "v1/tiles/$1/editable")
    .replace(/^read\/placement\/([^/]+)$/, "v1/placements/$1")
    .replace(/^read\/execution\/([^/]+)$/, "v1/executions/$1")
    .replace(/^access\/subjects\/([^/]+)$/, "v1/access/subjects/$1")
    .replace(/^access\/grants\/([^/]+)$/, "v1/access/grants/$1")
    .replace(
      /^access\/grants\/([^/]+)\/(accept|decline|approve|deny|revoke|withdraw|audit)$/,
      "v1/access/grants/$1/$2",
    )
    .replace(/^access\/notifications\/([^/]+)\/read$/, "v1/access/notifications/$1/read")
    .replace(/^access\/notifications\/read-all$/, "v1/access/notifications/read-all");
  if (rewritten !== path) return rewritten;
  return path.replace(/^v1\//, "v1/");
}

function localCompatResponse(path: string, method: string): NextResponse | null {
  if (method !== "GET") return null;
  if (path === "views/pending-prompt") {
    return NextResponse.json({ prompt: null });
  }
  if (path === "views/timeline/today") {
    return NextResponse.json({ items: [] });
  }
  if (path === "commands/recurring-tile") {
    return NextResponse.json({ items: [] });
  }
  const recurringGetMatch = path.match(/^commands\/recurring-tile\/([^/]+)$/);
  if (recurringGetMatch && method === "GET") {
    return new NextResponse(null, { status: 404 });
  }
  if (path === "execution/snapshot") {
    return NextResponse.json({
      inProgressTiles: [],
      promptQueue: [],
      timeline: [],
    });
  }
  if (path === "sync/status") {
    return NextResponse.json(null);
  }
  if (path.startsWith("views/calendar/")) {
    const view = path.split("/").at(-1) ?? "day";
    const now = new Date();
    const day = now.toISOString().slice(0, 10);
    return NextResponse.json({
      view,
      range_start: `${day}T00:00:00.000Z`,
      range_end: `${day}T23:59:59.999Z`,
      grid_start: `${day}T00:00:00.000Z`,
      grid_end: `${day}T23:59:59.999Z`,
      blocks: [],
      all_day_spans: [],
      overflow_counters: {},
      month_summaries: [],
    });
  }
  return null;
}

function normalizeCompatResponse(path: string, body: string): string {
  if (!body) return body;
  try {
    const parsed = JSON.parse(body);
    if (path === "read/tiles") {
      const tiles = Array.isArray(parsed) ? parsed.map(toLegacyTile) : [];
      return JSON.stringify({
        tiles,
        next_actionable_tile_id: tiles[0]?.id ?? null,
        next_actionable_start_at: null,
      });
    }
    if (path === "views/tile-list") {
      return JSON.stringify({
        tiles: Array.isArray(parsed) ? parsed.map(toLegacyTile) : [],
      });
    }
    if (path === "commands/recurring-tile") {
      return JSON.stringify(toRecurringTemplateList(parsed));
    }
    if (path === "read/execution-view") {
      return JSON.stringify(toExecutionView(parsed));
    }
    if (path === "views/active-tile" || path === "read/active-tile") {
      return JSON.stringify(toActiveTileView(parsed));
    }
    if (path === "views/timeline/today") {
      return JSON.stringify({ items: Array.isArray(parsed) ? parsed : [] });
    }
    if (path === "read/placements") {
      return JSON.stringify({ placements: Array.isArray(parsed) ? parsed : [] });
    }
    if (path === "read/candidates") {
      return JSON.stringify({ candidates: Array.isArray(parsed) ? parsed : [] });
    }
    return body;
  } catch {
    return body;
  }
}

function toRecurringTemplateList(parsed: unknown) {
  const source = Array.isArray(parsed) ? parsed : [];
  return source
    .filter((tile) => isRecurringTileSummary(tile))
    .map((tile) => {
      const row = tile as Record<string, unknown>;
      return {
        id: typeof row.id === "string" ? row.id : generateId(),
        title: typeof row.title === "string" ? row.title : "Recurring tile",
        note: typeof row.note === "string" ? row.note : "",
        recurrence: row.recurrence,
      };
    });
}

function isRecurringTileSummary(tile: unknown): boolean {
  if (!tile || typeof tile !== "object") return false;
  const kind = (tile as Record<string, unknown>).kind;
  return kind === 0 || kind === "recurring" || kind === "Recurring";
}

function toLegacyTile(tile: unknown) {
  const source = (tile && typeof tile === "object" ? tile : {}) as Record<string, unknown>;
  return {
    id: source.id,
    plan_id: source.plan_id ?? source.planId ?? null,
    title: source.title ?? "Untitled",
    lifecycle: source.archived === true ? "closed" : "ready",
    next_action: null,
    done_definition: null,
    worked_minutes: 0,
    break_minutes: 0,
    semantic_role: "work",
    labels: [],
    objective_mode: "finish_once",
    target_work_min: null,
    target_rest_min: null,
    done_rule: null,
    resume_note: null,
    projected_next_start_at: null,
    temporal: {
      release_at: null,
      due_at: null,
      fixed_start: null,
      fixed_end: null,
      active_start: null,
      active_end: null,
    },
    recurrence: null,
  };
}

function toActiveTileView(value: unknown) {
  if (!value || typeof value !== "object") return null;
  const source = value as Record<string, unknown>;
  return {
    id: source.tile_id ?? source.id,
    title: source.title ?? "Untitled",
    started_at: source.span_start ?? source.spanStart ?? null,
    ends_at: source.span_end ?? source.spanEnd ?? null,
  };
}

function toExecutionView(value: unknown) {
  const active = toActiveTileView(value);
  return {
    is_working: active !== null,
    is_on_break: false,
    is_idle: active === null,
    main_tile: active,
    main_tile_started_at: active?.started_at ?? null,
    main_tile_ends_at: active?.ends_at ?? null,
    tile_count: active ? 1 : 0,
    event_count: 0,
    tiles_in_progress: active ? [active] : [],
    pending_prompt_id: null,
  };
}

export function injectTimelineTodayDefaults(params: URLSearchParams): void {
  if (!params.has("start")) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    params.set("start", today.toISOString());
  }
  if (!params.has("end")) {
    const startIso = params.get("start") ?? new Date().toISOString();
    const endDate = new Date(startIso);
    endDate.setUTCDate(endDate.getUTCDate() + 1);
    params.set("end", endDate.toISOString());
  }
}

function resolveBridgeUserSub(request: NextRequest): string | null {
  const cookieSub = request.cookies.get(COOKIE_USER_SUB)?.value;
  if (cookieSub) return cookieSub;

  const idToken = request.cookies.get("tastile_id_token")?.value;
  if (!idToken) return null;

  try {
    return parseIdTokenClaims(idToken).sub;
  } catch {
    return null;
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  return proxyRequest(request, path);
}
