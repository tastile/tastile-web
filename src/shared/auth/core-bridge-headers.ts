import { CORE_ASSERTION_HEADER, mintCoreAssertion } from "./core-assertion";

// Single place that builds the BFF -> tastile-core auth headers.
//
// Bridge headers are always emitted. The assertion header is added only when
// TASTILE_WEB_CORE_ASSERTION_ENABLED is exactly "true"; with the flag unset
// the output is identical to the pre-assertion bridge headers.

const CORE_ASSERTION_FLAG = "TASTILE_WEB_CORE_ASSERTION_ENABLED";

type EnvLike = Readonly<Record<string, string | undefined>>;

export function isCoreAssertionEnabled(env: EnvLike = process.env): boolean {
  return env[CORE_ASSERTION_FLAG] === "true";
}

export async function buildCoreBridgeHeaders(params: {
  bridgeSecret: string;
  userSub: string;
  env?: EnvLike;
}): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "x-tastile-web-bridge-secret": params.bridgeSecret,
    "x-tastile-web-session-user": params.userSub,
  };
  if (isCoreAssertionEnabled(params.env)) {
    headers[CORE_ASSERTION_HEADER] = await mintCoreAssertion(params.userSub);
  }
  return headers;
}
