import { ensureBetterAuthJwksSchema } from "@/lib/migrations/better-auth-jwks";
import { CORE_ASSERTION_TTL_SECONDS } from "./better-auth/core-assertion-config";
import { authDatabase, getAuth } from "./better-auth/server";

// Server-only. Mints the `x-tastile-web-assertion` JWS that accompanies the
// bridge headers on BFF -> tastile-core requests. The token is signed by the
// BetterAuth jwt plugin (EdDSA / Ed25519, kid in header), with
// iss = Web origin, aud = tastile-core, sub = BetterAuth user id, and a
// lifetime of at most 5 minutes. A fresh token is minted per request.

export const CORE_ASSERTION_HEADER = "x-tastile-web-assertion";

/**
 * @param userId BetterAuth user id; the same value sent as
 *   `x-tastile-web-session-user`.
 */
export async function mintCoreAssertion(userId: string): Promise<string> {
  await ensureBetterAuthJwksSchema(await authDatabase());
  const auth = await getAuth();
  const nowSeconds = Math.floor(Date.now() / 1000);
  const { token } = await auth.api.signJWT({
    body: {
      payload: {
        sub: userId,
        iat: nowSeconds,
        exp: nowSeconds + CORE_ASSERTION_TTL_SECONDS,
      },
    },
  });
  return token;
}
