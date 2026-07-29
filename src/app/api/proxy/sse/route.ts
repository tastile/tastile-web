import {
  ensureDefaultApiTokenForUser,
  getApiTokenFromRequest,
} from "@/lib/account/api-token-session";
import { resolveAuthenticatedUserSub } from "@/lib/cognito/authenticated-session";
import type { NextRequest } from "next/server";

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
    const userSub = await resolveAuthenticatedUserSub({ cookieStore: request.cookies });
    if (!userSub) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
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
