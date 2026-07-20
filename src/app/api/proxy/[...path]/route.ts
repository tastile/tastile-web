import { type NextRequest, NextResponse } from "next/server";
import { v5 as uuidv5 } from "uuid";
import { setAuthCookies } from "@/lib/cognito/cookies";
import { ensureBridgeAuth } from "@/lib/cognito/refresh-bridge-auth";
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

async function proxyRequest(request: NextRequest, pathSegments: string[]): Promise<NextResponse> {
  const path = pathSegments.join("/");
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
  // long-lived v1_api_token (Bearer) or the web-bridge headers. The
  // bridge identity is resolved from Cognito's userInfo endpoint on every
  // request; unsigned uid cookies and decoded JWT payloads are never an
  // identity source. The bridge secret gates the core-side trust boundary.
  const bridgeSecret = process.env.TASTILE_WEB_BRIDGE_SECRET;
  const auth = await ensureBridgeAuth({ cookieStore: request.cookies });
  if (getIsE2EBypass()) {
    // E2E bypass: pin the dev actor while still forwarding to the configured
    // v1 API. The bridge-secret check is for production deploys.
    headers.set("x-owner-id", DEV_ACTOR_SUBJECT_ID);
    headers.set("x-actor-id", DEV_ACTOR_SUBJECT_ID);
  } else {
    if (!bridgeSecret) {
      console.error("[proxy] TASTILE_WEB_BRIDGE_SECRET is not set");
      return NextResponse.json(
        { error: "web bridge is not configured on the server" },
        { status: 503 },
      );
    }
    if (auth.status === "unauthorized") {
      const cookieNames = ["tastile_access_token", "tastile_id_token", "tastile_refresh_token"];
      const present = cookieNames.filter((n) => !!request.cookies.get(n)?.value);
      const hasRefresh = !!request.cookies.get("tastile_refresh_token")?.value;
      console.warn(
        `[proxy] 401 for ${path} — cookies: [${present.join(", ") || "none"}], refresh_token: ${hasRefresh}`,
      );
      // For browser navigations (Accept: text/html), redirect to login so the
      // user can re-authenticate. API callers (fetch/XHR) still get a JSON 401.
      const accept = request.headers.get("accept") ?? "";
      if (accept.includes("text/html")) {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("error", "session_expired");
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.json({ error: "no authenticated session for proxy" }, { status: 401 });
    }
    headers.set("x-tastile-web-bridge-secret", bridgeSecret);
    headers.set("x-tastile-web-session-user", auth.userSub);
    // v1 read handlers (read_tile, list_tiles, ...) authorize via
    // `read_actor` which only reads `x-actor-id` (not the bridge
    // headers).  The actor must match the daemon's bridge-derived
    // owner_id (`uuidv5(NAMESPACE_OID, user_sub)`), not the raw sub.
    const actorId = bridgeActorId(auth.userSub);
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
    if (!upstreamResponse.ok) {
      console.warn(
        `[proxy] upstream ${request.method} ${url.pathname} returned ${upstreamResponse.status}`,
      );
    }
    const responseHeaders = new Headers();
    for (const [name, value] of upstreamResponse.headers) {
      if (isSafeResponseHeader(name)) responseHeaders.set(name, value);
    }
    const response = new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
    if (!getIsE2EBypass() && auth.status === "ok" && auth.refreshedTokens) {
      const claims = parseIdTokenClaims(auth.refreshedTokens.id_token);
      await setAuthCookies(
        {
          idToken: auth.refreshedTokens.id_token,
          accessToken: auth.refreshedTokens.access_token,
          refreshToken: auth.refreshedTokens.refresh_token ?? null,
          sub: claims.sub,
          expiresIn: auth.refreshedTokens.expires_in,
        },
        response,
      );
    }
    return response;
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
