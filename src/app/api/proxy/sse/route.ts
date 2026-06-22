import { NextRequest } from "next/server";
import { COOKIE_USER_SUB } from "@/lib/cognito/cookies";
import { parseIdTokenClaims } from "@/lib/cognito/server";

const CLOUD_API_BASE =
  process.env.NEXT_PUBLIC_DAEMON_BASE_URL ??
  process.env.NEXT_PUBLIC_TASTILE_CORE_URL ??
  "https://api.tastile.app";
const isE2EBypass = process.env.E2E_BYPASS_AUTH === "1";

export async function GET(request: NextRequest) {
  if (isE2EBypass) {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode("data: {\"event_id\":\"state-connected\",\"payload\":null}\n\n"),
        );
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
      },
    });
  }

  const upstreamUrl = `${CLOUD_API_BASE}/read/events/state`;

  const headers: Record<string, string> = {};
  const bridgeSecret = process.env.TASTILE_WEB_BRIDGE_SECRET;
  const userSub = resolveBridgeUserSub(request);
  if (bridgeSecret && userSub) {
    headers["x-tastile-web-bridge-secret"] = bridgeSecret;
    headers["x-tastile-web-session-user"] = userSub;
  }

  try {
    const upstreamResponse = await fetch(upstreamUrl, { method: "GET", headers });

    if (!upstreamResponse.ok) {
      return new Response(`Upstream error: ${upstreamResponse.status}`, {
        status: upstreamResponse.status,
      });
    }

    const reader = upstreamResponse.body?.getReader();
    if (!reader) {
      return new Response("No body", { status: 502 });
    }

    const stream = new ReadableStream({
      async start(controller) {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        } catch {
          // Connection closed
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "content-type": "text/event-stream",
        "cache-control": "no-cache",
        connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("SSE proxy error:", error);
    return new Response("SSE proxy failed", { status: 502 });
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
