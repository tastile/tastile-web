import type { AuthCookieStore } from "./authenticated-session";
import { resolveAuthenticatedUserSub } from "./authenticated-session";
import { COOKIE_REFRESH_TOKEN } from "./cookies";
import { type CognitoEnv, tryGetCognitoEnv } from "./env";
import { type CognitoTokenSet, parseIdTokenClaims, refreshTokens } from "./server";

export type EnsureBridgeAuthResult =
  | { status: "ok"; userSub: string; refreshedTokens: CognitoTokenSet | null }
  | { status: "unauthorized" };

/**
 * Resolve an authenticated Cognito userSub for the web-bridge path.
 *
 * Tries the existing access_token first. If verification fails (typically
 * because the 1-hour access_token expired) AND a refresh_token cookie is
 * present, performs a Cognito refresh_token grant and reports the new
 * token set so the caller can attach it to the outgoing response as
 * Set-Cookie headers.
 */
export async function ensureBridgeAuth(args: {
  cookieStore: AuthCookieStore;
  env?: CognitoEnv | null;
  fetchImpl?: typeof fetch;
}): Promise<EnsureBridgeAuthResult> {
  const env = args.env === undefined ? tryGetCognitoEnv() : args.env;

  const userSub = await resolveAuthenticatedUserSub({
    cookieStore: args.cookieStore,
    env: env ?? undefined,
    fetchImpl: args.fetchImpl,
  });
  if (userSub) return { status: "ok", userSub, refreshedTokens: null };

  if (!env) return { status: "unauthorized" };
  const refreshToken = args.cookieStore.get(COOKIE_REFRESH_TOKEN)?.value;
  if (!refreshToken) return { status: "unauthorized" };

  try {
    const tokens = await refreshTokens({
      env,
      refreshToken,
      fetchImpl: args.fetchImpl,
    });
    const claims = parseIdTokenClaims(tokens.id_token);
    if (!claims.sub) return { status: "unauthorized" };
    return { status: "ok", userSub: claims.sub, refreshedTokens: tokens };
  } catch {
    return { status: "unauthorized" };
  }
}
