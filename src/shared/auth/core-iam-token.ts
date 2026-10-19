// Server-only. Cloud Run service-to-service identity for BFF -> tastile-core.
//
// On staging the Core API service requires IAM (roles/run.invoker granted to
// sa-web) until the edge binding is verified. The Web service obtains a Google
// ID token for its own service account from the metadata server and sends it
// in `x-serverless-authorization`, which Cloud Run checks and strips. The
// `authorization` header stays free for Core API tokens.
//
// Unset audience: no header, no metadata request (local, CI, current AWS path).

const CORE_IAM_AUDIENCE_ENV = "TASTILE_CORE_IAM_AUDIENCE";
export const CORE_IAM_HEADER = "x-serverless-authorization";

const METADATA_IDENTITY_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/identity";
const METADATA_TIMEOUT_MS = 3_000;
// Refresh well before the one-hour Google ID token expiry.
const REFRESH_MARGIN_SECONDS = 300;

type EnvLike = Readonly<Record<string, string | undefined>>;
type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

let cached: { audience: string; token: string; refreshAt: number } | null = null;

export function coreIamAudience(env: EnvLike = process.env): string | null {
  const audience = env[CORE_IAM_AUDIENCE_ENV]?.trim();
  if (!audience) return null;
  const url = new URL(audience);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`${CORE_IAM_AUDIENCE_ENV} must be an https service URL without path or query`);
  }
  return url.origin;
}

function tokenExpiry(token: string): number {
  const payload = token.split(".")[1];
  if (!payload) throw new Error("metadata identity token is not a JWT");
  const claims = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as { exp?: unknown };
  if (typeof claims.exp !== "number") throw new Error("metadata identity token has no exp");
  return claims.exp;
}

// cred.edge-assertion: when Core gates its origin, Web's direct run.app calls
// carry the same value the edge router adds (root ADR-0014, core#226).
const CORE_EDGE_HEADER = "x-tastile-edge-assertion";

function coreEdgeHeaders(env: EnvLike): Record<string, string> {
  const value = env.TASTILE_EDGE_ASSERTION?.trim();
  return value ? { [CORE_EDGE_HEADER]: value } : {};
}

/** Transport headers for every BFF -> Core call: Cloud Run IAM and the edge assertion. */
export async function coreIamHeaders(
  env: EnvLike = process.env,
  fetchImpl: FetchLike = fetch,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): Promise<Record<string, string>> {
  return { ...(await iamHeaders(env, fetchImpl, nowSeconds)), ...coreEdgeHeaders(env) };
}

async function iamHeaders(
  env: EnvLike,
  fetchImpl: FetchLike,
  nowSeconds: number,
): Promise<Record<string, string>> {
  const audience = coreIamAudience(env);
  if (!audience) return {};
  if (cached && cached.audience === audience && nowSeconds < cached.refreshAt) {
    return { [CORE_IAM_HEADER]: `Bearer ${cached.token}` };
  }
  const response = await fetchImpl(`${METADATA_IDENTITY_URL}?audience=${encodeURIComponent(audience)}`, {
    headers: { "Metadata-Flavor": "Google" },
    redirect: "error",
    signal: AbortSignal.timeout(METADATA_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`metadata identity request failed: HTTP ${response.status}`);
  const token = (await response.text()).trim();
  cached = { audience, token, refreshAt: tokenExpiry(token) - REFRESH_MARGIN_SECONDS };
  return { [CORE_IAM_HEADER]: `Bearer ${token}` };
}

export function resetCoreIamTokenCacheForTest(): void {
  cached = null;
}
