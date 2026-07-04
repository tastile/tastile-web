"use server";

/**
 * Server actions for Google Calendar integration.
 *
 * The v1 product truth does NOT include the legacy `/auth/integrations/*`
 * or `/sync/trigger` endpoints. Per `docs/agent-handoff/PROJECT-TRUTH.md`,
 * Google Calendar sync is out of scope until v2; the legacy daemon client
 * module was removed in the v1-only migration.
 *
 * The actions still resolve to a stable shape for any in-flight callers,
 * but they fail explicitly instead of issuing legacy requests.
 */

function notImplemented(): never {
  throw new Error(
    "Google Calendar integration is out of scope for v1 — see " +
      "docs/agent-handoff/PROJECT-TRUTH.md",
  );
}

export async function connectGoogleCalendarAction(): Promise<never> {
  notImplemented();
}

export async function disconnectGoogleCalendarAction(): Promise<never> {
  notImplemented();
}

export async function syncNowAction(): Promise<never> {
  notImplemented();
}

export async function updateLastSyncedAtAction(): Promise<never> {
  notImplemented();
}
