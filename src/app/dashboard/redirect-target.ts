/**
 * Pure helper for the /dashboard entry route. Kept out of `page.tsx` so the
 * redirect policy can be unit-tested without rendering Next.js.
 *
 * Contract:
 *   - First visit (no stored last-visited path, or the path stored is the
 *     redirect source itself, or the stored path is not in the allow-list)
 *     → `DEFAULT_DASHBOARD_TARGET` (Calendar Month view).
 *   - Otherwise → restore the stored path, including any sub-route such as
 *     `/dashboard/timeline/month`.
 *
 * Allow-list uses prefix matching so the dynamically routed
 * `/dashboard/timeline/<view>` segments are accepted, not just the bare
 * `/dashboard/timeline`.
 */

export const REDIRECTABLE_PREFIXES = [
  "/dashboard/tasks",
  "/dashboard/projects",
  "/dashboard/schedule",
  "/dashboard/timeline",
  "/dashboard/events",
  "/dashboard/preferences/general",
  "/dashboard/preferences/account",
  "/dashboard/runtime",
  "/dashboard/api",
  "/dashboard/billing",
  "/dashboard/quota",
] as const;

export const DEFAULT_DASHBOARD_TARGET = "/dashboard/timeline/month";

export function isRedirectable(path: string | null | undefined): boolean {
  if (!path || path === "/dashboard") return false;
  return REDIRECTABLE_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function decideRedirectTarget(lastVisited: string | null | undefined): string {
  return isRedirectable(lastVisited) ? (lastVisited as string) : DEFAULT_DASHBOARD_TARGET;
}
