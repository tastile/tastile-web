import { COOKIE_API_TOKEN, COOKIE_USER_SUB } from "@/shared/auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

function getCloudApiBase(): string {
  const value = process.env.CLOUD_API_BASE;
  if (value) return value;
  if (process.env.E2E_BYPASS_AUTH === "1") return "http://localhost:31400";
  throw new Error("CLOUD_API_BASE is not set");
}

function getIsE2EBypass(): boolean {
  return process.env.E2E_BYPASS_AUTH === "1";
}

const DEV_ACTOR_SUBJECT_ID = "00000000-0000-0000-0000-000000000001";

async function proxyRequest(request: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const path = pathSegments.join("/");
  const upstreamPath = toV1Path(path);
  const targetUrl = `${getCloudApiBase()}/${upstreamPath}`;
  const url = new URL(targetUrl);
  const params = new URLSearchParams(request.nextUrl.search);
  if (upstreamPath === "v1/timeline/today") {
    injectTimelineTodayDefaults(params);
  }
  url.search = params.toString();

  const headers = new Headers();

  if (getIsE2EBypass()) {
    headers.set("x-owner-id", DEV_ACTOR_SUBJECT_ID);
    headers.set("x-actor-id", DEV_ACTOR_SUBJECT_ID);
  } else {
    const apiToken = request.cookies.get(COOKIE_API_TOKEN)?.value;
    const userSub = request.cookies.get(COOKIE_USER_SUB)?.value;
    if (!apiToken && !userSub) {
      const accept = request.headers.get("accept") ?? "";
      if (accept.includes("text/html")) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("error", "session_expired");
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.json({ error: "no authenticated session for proxy" }, { status: 401 });
    }
    if (apiToken) {
      headers.set("authorization", `Bearer ${apiToken}`);
    }
    if (userSub) {
      const bridgeSecret = process.env.TASTILE_WEB_BRIDGE_SECRET;
      if (!bridgeSecret) {
        console.warn("[proxy] TASTILE_WEB_BRIDGE_SECRET is unset; cannot forward bridge headers");
      } else {
        headers.set("x-tastile-web-bridge-secret", bridgeSecret);
        headers.set("x-tastile-web-session-user", userSub);
      }
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
    if (!upstreamResponse.ok) {
      console.warn(
        `[proxy] upstream ${request.method} ${url.pathname} returned ${upstreamResponse.status}`,
      );
    }
    const responseHeaders = new Headers();
    for (const [name, value] of upstreamResponse.headers) {
      if (isSafeResponseHeader(name)) responseHeaders.set(name, value);
    }
    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error(`[proxy] fetch failed for ${path} → ${url.toString()}:`, error);
    return NextResponse.json({ error: "Proxy request failed", path }, { status: 502 });
  }
}

function isSafeResponseHeader(name: string): boolean {
  return !new Set([
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "set-cookie",
  ]).has(name.toLowerCase());
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

export async function PATCH(
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
