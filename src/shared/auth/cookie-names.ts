/**
 * Cookie name constants.
 *
 * Separated from cookies.ts so client code can import these
 * without pulling in next/headers (server-only).
 */
export const COOKIE_ID_TOKEN = "tastile_id_token";
export const COOKIE_ACCESS_TOKEN = "tastile_access_token";
export const COOKIE_REFRESH_TOKEN = "tastile_refresh_token";
export const COOKIE_USER_SUB = "tastile_uid";
export const COOKIE_API_TOKEN = "tastile_api_token";
// Short-lived credential handed to browser JS so it can call tastile-core
// directly. Distinct from COOKIE_API_TOKEN, which is long-lived and never
// leaves the server.
export const COOKIE_CORE_BROWSER_TOKEN = "tastile_core_browser_token";
export const COOKIE_PKCE_VERIFIER = "tastile_pkce_verifier";
export const COOKIE_OAUTH_STATE = "tastile_oauth_state";
export const COOKIE_OAUTH_NEXT = "tastile_oauth_next";
export const COOKIE_EMAIL_AUTH_SESSION = "tastile_email_auth_session";
export const COOKIE_EMAIL_AUTH_USERNAME = "tastile_email_auth_username";
export const COOKIE_DIRECT_DAEMON = "tastile_direct_daemon";
