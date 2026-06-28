import type { NextRequest } from "next/server";
import {
  ensureDefaultApiTokenForUser,
  getApiTokenFromRequest,
} from "@/lib/account/api-token-session";
import { COOKIE_USER_SUB } from "@/lib/cognito/cookies";
import { parseIdTokenClaims } from "@/lib/cognito/server";

const isE2EBypass = process.env.E2E_BYPASS_AUTH === "1";

export async function GET(request: NextRequest) {
  if (isE2EBypass) {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(
          new TextEncoder().encode('data: {"event_id":"state-connected","payload":null}\n\n'),
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

  const apiToken = getApiTokenFromRequest(request);
  if (!apiToken) {
    const userSub = resolveBridgeUserSub(request);
    await ensureDefaultApiTokenForUser(userSub);
  }

  return syntheticConnectedStream();
}

function syntheticConnectedStream() {
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(
        encoder.encode('event: connected\ndata: {"event_id":"state-connected","payload":null}\n\n'),
      );
      heartbeat = setInterval(() => {
        controller.enqueue(encoder.encode(": keepalive\n\n"));
      }, 25_000);
    },
    cancel() {
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
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
