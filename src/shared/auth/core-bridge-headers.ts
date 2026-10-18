import { resolveAuthenticatedUserSub } from "./authenticated-session";
import { CORE_ASSERTION_HEADER, mintCoreAssertion } from "./core-assertion";

// Single place that builds the BFF -> tastile-core auth headers.
//
// Flag unset or not exactly "true": the output is the two bridge headers,
// identical to the pre-assertion behavior, and no session lookup happens.
//
// Flag exactly "true": the assertion is minted only for a verified
// BetterAuth session whose user id equals `userSub`. The assertion `sub` is
// the verified session user id. When there is no session, or the caller's
// `userSub` (for example the tastile_uid cookie) disagrees with it, the
// function returns null and no assertion is minted. Callers must treat null
// as unauthorized and must not fall back to bridge-only headers.

const CORE_ASSERTION_FLAG = "TASTILE_WEB_CORE_ASSERTION_ENABLED";

type EnvLike = Readonly<Record<string, string | undefined>>;

export function isCoreAssertionEnabled(env: EnvLike = process.env): boolean {
  return env[CORE_ASSERTION_FLAG] === "true";
}

export async function buildCoreBridgeHeaders(params: {
  bridgeSecret: string;
  userSub: string;
  /** Request headers used to verify the session (defaults to next/headers). */
  requestHeaders?: Headers;
  env?: EnvLike;
}): Promise<Record<string, string> | null> {
  const bridgeHeaders: Record<string, string> = {
    "x-tastile-web-bridge-secret": params.bridgeSecret,
    "x-tastile-web-session-user": params.userSub,
  };
  if (!isCoreAssertionEnabled(params.env)) return bridgeHeaders;

  const verifiedSub = await resolveAuthenticatedUserSub(
    params.requestHeaders ? { requestHeaders: params.requestHeaders } : undefined,
  );
  if (!verifiedSub || verifiedSub !== params.userSub) return null;

  return {
    ...bridgeHeaders,
    [CORE_ASSERTION_HEADER]: await mintCoreAssertion(verifiedSub),
  };
}
