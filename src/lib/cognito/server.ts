import type { CognitoEnv } from "./env";

export interface CognitoTokenSet {
  id_token: string;
  access_token: string;
  refresh_token: string | null;
  expires_in: number;
}

export interface ExchangeCodeArgs {
  env: CognitoEnv;
  code: string;
  codeVerifier: string;
  fetchImpl?: typeof fetch;
}

export async function exchangeCodeForTokens(args: ExchangeCodeArgs): Promise<CognitoTokenSet> {
  const f = args.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: args.env.clientId,
    code: args.code,
    code_verifier: args.codeVerifier,
    redirect_uri: args.env.callbackUrl,
  });
  const res = await f(`${args.env.hostedUiBaseUrl}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`token exchange failed: ${res.status} ${text}`);
  }
  return (await res.json()) as CognitoTokenSet;
}

export interface RefreshTokensArgs {
  env: CognitoEnv;
  refreshToken: string;
  fetchImpl?: typeof fetch;
}

export async function refreshTokens(args: RefreshTokensArgs): Promise<CognitoTokenSet> {
  const f = args.fetchImpl ?? fetch;
  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: args.env.clientId,
    refresh_token: args.refreshToken,
  });
  const res = await f(`${args.env.hostedUiBaseUrl}/oauth2/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`refresh failed: ${res.status} ${text}`);
  }
  return (await res.json()) as CognitoTokenSet;
}

export interface IdTokenClaims {
  sub: string;
  email?: string;
  emailVerified?: boolean;
  preferredUsername?: string;
  exp: number;
}

/** Parse an ID token's payload (no signature verification — the daemon does that). */
export function parseIdTokenClaims(idToken: string): IdTokenClaims {
  const parts = idToken.split(".");
  if (parts.length !== 3) throw new Error("malformed id_token");
  const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
  const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
  const json = JSON.parse(atob(padded));
  if (typeof json.sub !== "string") {
    throw new Error("malformed id_token: missing sub");
  }
  return {
    sub: json.sub,
    email: typeof json.email === "string" ? json.email : undefined,
    emailVerified:
      typeof json.email_verified === "boolean" ? json.email_verified : undefined,
    preferredUsername:
      typeof json.preferred_username === "string" ? json.preferred_username : undefined,
    exp: Number(json.exp),
  };
}
