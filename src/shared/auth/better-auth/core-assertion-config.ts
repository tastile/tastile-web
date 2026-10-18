import type { JwtOptions } from "better-auth/plugins";

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
