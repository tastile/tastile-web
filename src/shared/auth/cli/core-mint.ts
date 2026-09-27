import { coreUrl } from "@/lib/account/api-token-session";

// CLI token minting (Issue #153, plan D7).
//
// This mirrors mintBrowserApiToken() in src/lib/account/api-token-session.ts
// but takes the `scopes` and `expires_at` from the caller so the Web can
// pass through the intersection computed at /cli/authorize (instead of the
// "all" default used by the browser path).
//
// The bridge header `x-tastile-web-session-user` carries the user sub
// resolved from the original authorization grant; tastile-core's Bridge
// credential kind passes the OwnerAdmin gate on /v1/api-tokens, so CLI mint
// always succeeds at the authorization layer — the granular scope work in
// the sibling Core PR is what enforces `tastile.read` / `tastile.write`.

export interface MintTastileApiTokenParams {
  userSub: string;
  label: string;
  scopes: string;
  /** ISO 8601 timestamp; CLI tokens get 30 days. */
  expiresAtIso: string;
}

export interface MintedTastileApiToken {
  /** Core-issued API-token id (used as `core_token_id` in the grant row). */
  id: string;
  token: string;
  expiresAt: string;
  subject: string;
}

type CoreApiTokenResponse = {
  id?: string;
  token?: string;
  expires_at?: string;
};

export async function mintTastileApiTokenForUser(
  params: MintTastileApiTokenParams,
): Promise<MintedTastileApiToken | null> {
  const bridgeSecret = process.env.TASTILE_WEB_BRIDGE_SECRET;
  if (!bridgeSecret) return null;

  const response = await fetch(`${coreUrl()}/v1/api-tokens`, {
    method: "POST",
    headers: {
      "x-tastile-web-bridge-secret": bridgeSecret,
      "x-tastile-web-session-user": params.userSub,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      label: params.label,
      scopes: params.scopes,
      expires_at: params.expiresAtIso,
    }),
    cache: "no-store",
  });
  if (!response.ok) return null;

  const created = (await response.json()) as CoreApiTokenResponse;
  // Both id and token are required: id is persisted as `core_token_id`
  // for audit / revocation flows; token is the bearer returned to the CLI.
  if (!created.id || !created.token) return null;
  return {
    id: created.id,
    token: created.token,
    expiresAt: created.expires_at ?? params.expiresAtIso,
    subject: params.userSub,
  };
}

export function cliTokenExpiresAtIso(now: number = Date.now()): string {
  // 30 days, matching the BetterAuth session lifetime at
  // src/shared/auth/better-auth/server.ts:93.
  return new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
}
