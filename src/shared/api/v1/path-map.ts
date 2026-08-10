// Canonical v1 path rewriting, shared by the browser client
// (`src/shared/api/endpoints.ts`) and the server proxy route
// (`src/app/api/proxy/[...path]/route.ts`).
//
// Both call sites previously kept their own copy of this map; direct-to-core
// browser calls make the two paths observable side by side, so the mapping has
// to be single-sourced. This module must stay browser-safe (no node imports).

const PATH_MAP: Record<string, string> = {
  "/health": "/v1/health",
  "/ready": "/v1/ready",
  "/version": "/v1/version",
  "/read/runtime-paths": "/v1/runtime/paths",
  "/runtime/paths": "/v1/runtime/paths",
  "/auth/session": "/v1/auth/session",
  "/auth/session/restore": "/v1/auth/session/restore",
  "/auth/tile-quota": "/v1/quota/tiles",
  "/commands/recurring-tile": "/v1/tiles",
  "/read/tiles": "/v1/tiles",
  "/views/tile-list": "/v1/tiles",
  "/read/active-tile": "/v1/active-tile",
  "/views/active-tile": "/v1/active-tile",
  "/read/execution-view": "/v1/active-tile",
  "/read/placements": "/v1/placements",
  "/read/candidates": "/v1/candidates",
  "/views/timeline/today": "/v1/timeline/today",
  "/views/calendar/day": "/v1/calendar/day",
  "/views/calendar/week": "/v1/calendar/week",
  "/views/calendar/month": "/v1/calendar/month",
  "/views/calendar/year": "/v1/calendar/year",
  "/views/pending-prompt": "/v1/prompts/pending",
  "/prompts/current": "/v1/prompts/pending",
  "/debug/events": "/v1/debug/events",
  "/access/subjects": "/v1/access/subjects",
  "/access/subjects/{id}": "/v1/access/subjects/{id}",
  "/access/subjects/by-external": "/v1/access/subjects/by-external",
  "/access/workspaces": "/v1/access/workspaces",
  "/access/capabilities": "/v1/access/capabilities",
  "/access/offers": "/v1/access/offers",
  "/access/requests": "/v1/access/requests",
  "/access/grants": "/v1/access/grants",
  "/access/notifications": "/v1/access/notifications",
};

// Parameterized paths: {id} is a UUIDv7, preserved verbatim.
export function toV1Path(path: string): string {
  const mapped = PATH_MAP[path];
  if (mapped) return mapped;
  return path
    .replace(/^\/read\/tile\/([^/]+)$/, "/v1/tiles/$1")
    .replace(/^\/read\/tile\/([^/]+)\/editable$/, "/v1/tiles/$1/editable")
    .replace(/^\/read\/placement\/([^/]+)$/, "/v1/placements/$1")
    .replace(/^\/read\/execution\/([^/]+)$/, "/v1/executions/$1")
    .replace(/^\/access\/subjects\/([^/]+)$/, "/v1/access/subjects/$1")
    .replace(/^\/access\/grants\/([^/]+)$/, "/v1/access/grants/$1")
    .replace(
      /^\/access\/grants\/([^/]+)\/(accept|decline|approve|deny|revoke|withdraw|audit)$/,
      "/v1/access/grants/$1/$2",
    )
    .replace(/^\/access\/notifications\/([^/]+)\/read$/, "/v1/access/notifications/$1/read")
    .replace(/^\/access\/notifications\/read-all$/, "/v1/access/notifications/read-all");
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
