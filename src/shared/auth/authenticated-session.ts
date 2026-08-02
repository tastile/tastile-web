import { cookies } from "next/headers";
import { verifyCognitoAccessToken } from "./access-token-verification";
import { COOKIE_ACCESS_TOKEN } from "./cookies";
import { type CognitoEnv, tryGetCognitoEnv } from "./env";

export { verifyCognitoAccessToken } from "./access-token-verification";

export interface AuthCookieStore {
  get(name: string): { value: string } | undefined;
}

export async function resolveAuthenticatedUserSub(
  args: { cookieStore?: AuthCookieStore; fetchImpl?: typeof fetch; env?: CognitoEnv | null } = {},
): Promise<string | null> {
  const env = args.env === undefined ? tryGetCognitoEnv() : args.env;
  if (!env) return null;

  const cookieStore = args.cookieStore ?? (await cookies());
  const accessToken = cookieStore.get(COOKIE_ACCESS_TOKEN)?.value;
  if (!accessToken) return null;

  return verifyCognitoAccessToken({
    accessToken,
    env,
    fetchImpl: args.fetchImpl,
  });
}
