/**
 * Canonical host redirect helper.
 *
 * The apex → app host redirect is driven by two env vars:
 *   - `NEXT_PUBLIC_APEX_HOST` (required — set in .env.*)
 *   - `NEXT_PUBLIC_APP_HOST`  (required — set in .env.*)
 *
 * Both are required. The open-source build refuses to bake a default
 * hostname into source. Local dev sets these in `.env.dev`
 * (see `.env.dev.example`); production deploys set them in the
 * systemd EnvironmentFile (see docs/HARNESS.md §13).
 */

import { MissingRequiredEnvError } from "@/lib/upstream/cloud-api-base";

const AppSitePrefixes = ["/app", "/auth", "/dashboard", "/login"];
const AppApiPrefixes = ["/api/account", "/api/auth", "/api/stripe"];

function requiredHost(name: "NEXT_PUBLIC_APEX_HOST" | "NEXT_PUBLIC_APP_HOST"): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new MissingRequiredEnvError(name);
  }
  return value;
}

function apexHost(): string {
  return requiredHost("NEXT_PUBLIC_APEX_HOST");
}

function appHost(): string {
  return requiredHost("NEXT_PUBLIC_APP_HOST");
}

export function resolveCanonicalHostRedirect(host: string, pathname: string): string | null {
  const normalizedHost = host.toLowerCase().split(":")[0];
  const normalizedPath = normalizePath(pathname);

  if (normalizedHost === apexHost() && isAppPath(normalizedPath)) {
    return appHost();
  }

  return null;
}

function normalizePath(pathname: string): string {
  if (!pathname.startsWith("/")) {
    return `/${pathname}`;
  }

  return pathname;
}

function isAppPath(pathname: string): boolean {
  return (
    AppSitePrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
    AppApiPrefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  );
}
