import { type NextRequest, NextResponse } from "next/server";
import {
  ensureDefaultApiTokenForUser,
  getApiTokenFromRequest,
  setApiTokenCookie,
} from "@/lib/account/api-token-session";
import { COOKIE_USER_SUB } from "@/lib/cognito/cookies";
import { parseIdTokenClaims } from "@/lib/cognito/server";

const CLOUD_API_BASE = "http://localhost:31400";
const isE2EBypass = process.env.E2E_BYPASS_AUTH === "1";

interface MockTile {
  id: string;
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
      owner_id: "00000000-0000-0000-0000-000000000001",
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

  if (path === "execution/snapshot" && method === "GET") {
    return new NextResponse(null, { status: 404 });
  }

  if (path === "sync/status" && method === "GET") {
    return new NextResponse(null, { status: 404 });
  }

  if (path === "commands/tile/create" && method === "POST") {
    const tile = mockTileFromCreate(body as Record<string, unknown>);
    mockTiles.push(tile);
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      request_id: null,
    });
  }

  if (path === "commands/tile/start" && method === "POST") {
    const req = body as Record<string, unknown>;
    const tileId = req.tile_id as string;
    const tile = mockTiles.find((t) => t.id === tileId);
    if (tile) {
      tile.lifecycle = "started";
      tile.temporal = { ...tile.temporal, active_start: new Date().toISOString() };
    }
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      request_id: null,
    });
  }

  if (path === "commands/tile/complete" && method === "POST") {
    const req = body as Record<string, unknown>;
    const tileId = req.tile_id as string;
    const tile = mockTiles.find((t) => t.id === tileId);
    if (tile) {
      tile.lifecycle = "done";
      tile.temporal = { ...tile.temporal, active_end: new Date().toISOString() };
    }
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      request_id: null,
    });
  }

  if (path === "commands/tile/defer" && method === "POST") {
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
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
      request_id: null,
    });
  }

  if (path === "commands/tile/extend" && method === "POST") {
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      request_id: null,
    });
  }

  if (path === "commands/break/start" && method === "POST") {
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      request_id: null,
    });
  }

  if (path === "commands/break/end" && method === "POST") {
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      request_id: null,
    });
  }

  if (path === "commands/prompt/request" && method === "POST") {
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
      request_id: null,
    });
  }

  if (path === "commands/prompt/respond-startup-recovery" && method === "POST") {
    return NextResponse.json({
      accepted: true,
      command_id: generateId(),
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

  if (isE2EBypass) {
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

  const localResponse = localCompatResponse(path, request.method);
  if (localResponse) return localResponse;

  const upstreamPath = toV1Path(path);
  const targetUrl = `${CLOUD_API_BASE}/${upstreamPath}`;
  const url = new URL(targetUrl);
  url.search = request.nextUrl.search;

  const headers = new Headers();
  const apiToken = getApiTokenFromRequest(request);
  const authHeader = request.headers.get("authorization");
  let bootstrappedApiToken: string | null = null;
  if (apiToken) {
    headers.set("authorization", `Bearer ${apiToken}`);
  } else if (authHeader) {
    headers.set("authorization", authHeader);
  } else {
    const userSub = resolveBridgeUserSub(request);
    bootstrappedApiToken = await ensureDefaultApiTokenForUser(userSub);
    if (bootstrappedApiToken) headers.set("authorization", `Bearer ${bootstrappedApiToken}`);
  }
  const contentType = request.headers.get("content-type");
  if (contentType) {
    headers.set("content-type", contentType);
  }
  if (isE2EBypass && isLocalCoreUrl(CLOUD_API_BASE)) {
    const ownerId = "00000000-0000-0000-0000-000000000001";
    headers.set("x-owner-id", ownerId);
    headers.set("x-actor-id", ownerId);
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
    if (bootstrappedApiToken) setApiTokenCookie(bootstrappedApiToken, response);
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
    "auth/tile-quota": "v1/quota/tiles",
    "debug/events": "v1/debug/events",
  };
  if (map[path]) return map[path];
  // Parameterized paths: {id} is a UUIDv7, preserved verbatim.
  const rewritten = path
    .replace(/^read\/tile\/([^/]+)$/, "v1/tiles/$1")
    .replace(/^read\/tile\/([^/]+)\/editable$/, "v1/tiles/$1/editable")
    .replace(/^read\/placement\/([^/]+)$/, "v1/placements/$1")
    .replace(/^read\/execution\/([^/]+)$/, "v1/executions/$1");
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
    return NextResponse.json([defaultBreakRecurringTemplate()]);
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
  const templates = source
    .filter((tile) => isRecurringTileSummary(tile))
    .map((tile) => {
      const row = tile as Record<string, unknown>;
      return {
        ...defaultBreakRecurringTemplate(),
        id: typeof row.id === "string" ? row.id : generateId(),
        title: typeof row.title === "string" ? row.title : "Recurring tile",
        note: "",
      };
    });

  const hasBreak = templates.some((template) => /休憩|break/i.test(template.title));
  return hasBreak ? templates : [defaultBreakRecurringTemplate(), ...templates];
}

function isRecurringTileSummary(tile: unknown): boolean {
  if (!tile || typeof tile !== "object") return false;
  const kind = (tile as Record<string, unknown>).kind;
  return kind === 0 || kind === "recurring" || kind === "Recurring";
}

function defaultBreakRecurringTemplate() {
  return {
    id: "default-break-recurring",
    title: "休憩",
    note: "Default break template",
    recurrence: {
      generator: {
        focus_block_based: {
          phases: [{ focus_min: 25, break_min: 5 }],
        },
      },
      window: {
        weekday_mask: 0b1111111,
        start_offset_min: 0,
        end_offset_min: 1440,
      },
      selector: {
        expression: null,
      },
    },
  };
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
