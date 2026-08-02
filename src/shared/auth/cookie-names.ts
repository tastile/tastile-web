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
export const COOKIE_PKCE_VERIFIER = "tastile_pkce_verifier";
export const COOKIE_OAUTH_STATE = "tastile_oauth_state";
export const COOKIE_OAUTH_NEXT = "tastile_oauth_next";
export const COOKIE_EMAIL_AUTH_SESSION = "tastile_email_auth_session";
export const COOKIE_EMAIL_AUTH_USERNAME = "tastile_email_auth_username";
export const COOKIE_DIRECT_DAEMON = "tastile_direct_daemon";
