import { jwt, type JwtOptions } from "better-auth/plugins";

// Better Auth jwt plugin configuration for the BFF -> tastile-core assertion
// (root ADR-0016). Kept free of runtime imports so the contract can be unit
// tested without constructing a live BetterAuth instance.
//
// - alg / kid: EdDSA over Ed25519; the plugin publishes the public key at
//   `/api/auth/jwks` (plugin default `jwksPath`) and stamps `kid` on every
//   signed header.
// - iss: the Web origin, which is the BetterAuth baseURL.
// - aud: `tastile-core`.
// - lifetime: at most 5 minutes; the signing helper also sets exp explicitly.

export const CORE_ASSERTION_AUDIENCE = "tastile-core";
export const CORE_ASSERTION_TTL_SECONDS = 300;

// The jwt plugin's `getToken` endpoint (GET /api/auth/token) returns a JWT
// with the same aud / iss / lifetime as the Core assertion, to any session
// holder. Only the server-side mint path may create one, so the HTTP route is
// disabled. `disabledPaths` is matched against the path relative to basePath
// (`/api/auth`), so the entry is "/token". `/jwks` stays served.
const CORE_ASSERTION_DISABLED_PATHS: readonly string[] = ["/token"];

export function coreAssertionJwtOptions(issuer: string): JwtOptions {
  return {
    // The default jwt plugin behavior attaches a signed JWT header to every
    // get-session response. The assertion is minted on demand instead.
    disableSettingJwtHeader: true,
    jwks: {
      keyPairConfig: { alg: "EdDSA", crv: "Ed25519" },
    },
    jwt: {
      issuer,
      audience: CORE_ASSERTION_AUDIENCE,
      expirationTime: `${CORE_ASSERTION_TTL_SECONDS} seconds`,
    },
  };
}

/** BetterAuth options fragment that installs the assertion signer. */
export function coreAssertionAuthOptions(issuer: string) {
  return {
    disabledPaths: [...CORE_ASSERTION_DISABLED_PATHS],
    plugins: [jwt(coreAssertionJwtOptions(issuer))],
  };
}
