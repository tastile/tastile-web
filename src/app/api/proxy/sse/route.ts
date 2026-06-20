import { NextRequest } from "next/server";

const CLOUD_API_BASE = "https://api.tastile.app";
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

  const token = request.nextUrl.searchParams.get("access_token");
  const upstreamUrl = `${CLOUD_API_BASE}/read/events/state`;

  const headers: Record<string, string> = {};
  if (token) {
    headers.authorization = `Bearer ${token}`;
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
