import { NextRequest, NextResponse } from "next/server";
import { COOKIE_USER_SUB } from "@/lib/cognito/cookies";
import { parseIdTokenClaims } from "@/lib/cognito/server";
import {
  ensureDefaultApiTokenForUser,
  getApiTokenFromRequest,
  setApiTokenCookie,
} from "@/lib/account/api-token-session";

const CLOUD_API_BASE =
  process.env.NEXT_PUBLIC_DAEMON_BASE_URL ??
  process.env.NEXT_PUBLIC_TASTILE_CORE_URL ??
  "https://api.tastile.app";
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
    done_definition: (tile.core as Record<string, unknown>)?.done_definition as string ?? null,
    worked_minutes: 0,
    break_minutes: 0,
    semantic_role: annotation.semantic_role as string ?? "work",
    labels: (annotation.labels as string[]) ?? [],
    objective_mode: objective.objective_mode as string ?? null,
    target_work_min: objective.target_work_min as number ?? null,
    target_rest_min: objective.target_rest_min as number ?? null,
    done_rule: objective.done_rule as string ?? null,
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

function handleMockRequest(path: string, method: string, body: unknown, searchParams: URLSearchParams): NextResponse | null {
  if (path === "read/tiles" && method === "GET") {
    return NextResponse.json({
      tiles: mockTiles,
      next_actionable_tile_id: mockTiles.length > 0 ? mockTiles[0].id : null,
      next_actionable_start_at: null,
    });
  }

  if (path === "read/execution-view" && method === "GET") {
    const mainTile = mockTiles.length > 0 ? mockTiles[0] : null;
    return NextResponse.json({
      tiles_in_progress: [],
      main_tile: mainTile,
      is_working: false,
      is_on_break: false,
      is_idle: true,
      main_tile_started_at: null,
      main_tile_ends_at: null,
      pending_prompt_id: null,
      tile_count: mockTiles.length,
      event_count: 0,
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
    const anchorDate = new Date(`${anchor}T00:00:00`);
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

  if (path === "views/tile-list" && method === "GET") {
    return NextResponse.json({ tiles: mockTiles });
  }

  return null;
}

async function proxyRequest(
  request: NextRequest,
  pathSegments: string[],
): Promise<NextResponse> {
  const path = pathSegments.join("/");

  if (isE2EBypass) {
    const body =
      request.method !== "GET" && request.method !== "HEAD"
        ? await request.json().catch(() => ({}))
        : null;
    const mockResponse = handleMockRequest(path, request.method, body, request.nextUrl.searchParams);
    if (mockResponse) return mockResponse;
  }

  const targetUrl = `${CLOUD_API_BASE}/${path}`;
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

    const response = new NextResponse(upstreamResponse.body, {
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
