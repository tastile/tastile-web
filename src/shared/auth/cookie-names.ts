/**
 * Cookie name constants.
 *
 * Separated from cookies.ts so client code can import these
 * without pulling in next/headers (server-only).
 */
export const COOKIE_USER_SUB = "tastile_uid";
export const COOKIE_API_TOKEN = "tastile_api_token";
// Short-lived credential handed to browser JS so it can call tastile-core
// directly. Distinct from COOKIE_API_TOKEN, which is long-lived and never
// leaves the server.
export const COOKIE_CORE_BROWSER_TOKEN = "tastile_core_browser_token";
export const COOKIE_DIRECT_DAEMON = "tastile_direct_daemon";
