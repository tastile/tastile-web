import { toNextJsHandler } from "better-auth/next-js";

import { getAuth } from "@/shared/auth/better-auth/server";

// Mounts the BetterAuth route surface at /api/auth/*. Static siblings
// (/api/auth/session, /api/auth/core-token, /api/auth/bridge) take precedence
// over this catch-all, which is intentional: they wrap BetterAuth with
// Tastile-specific contracts (bridge minting, session metadata shape).
//
// The handler is created lazily so that build-time module evaluation never
// requires TASTILE_AUTH_DATABASE_URL to be present.

type AuthRouteHandlers = ReturnType<typeof toNextJsHandler>;

let handlers: Promise<AuthRouteHandlers> | null = null;

function authHandlers(): Promise<AuthRouteHandlers> {
  if (!handlers) {
    handlers = getAuth().then((auth) => toNextJsHandler(auth.handler));
  }
  return handlers;
}

export async function GET(request: Request): Promise<Response> {
  return (await authHandlers()).GET(request);
}

export async function POST(request: Request): Promise<Response> {
  return (await authHandlers()).POST(request);
}
