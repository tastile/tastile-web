import {
  injectTimelineTodayDefaults,
  toV1Path as toV1PathAbsolute,
} from "@/shared/api/v1/path-map";
import { COOKIE_API_TOKEN, COOKIE_USER_SUB } from "@/shared/auth/cookies";
import { type NextRequest, NextResponse } from "next/server";

export { injectTimelineTodayDefaults };

// The proxy receives path segments without a leading slash; the shared map is
// slash-prefixed because that is the shape the endpoint table uses.
export function toV1Path(path: string): string {
  return toV1PathAbsolute(`/${path}`).slice(1);
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

const DEV_ACTOR_SUBJECT_ID = "00000000-0000-0000-0000-000000000001";

const PASS_THROUGH_REQUEST_HEADERS = [
  "idempotency-key",
  "idempotency-key-set",
  "x-request-id",
  "x-requested-with",
  "x-forwarded-for",
] as const;

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

  for (const name of PASS_THROUGH_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
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
