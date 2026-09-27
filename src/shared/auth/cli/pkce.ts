import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

// PKCE S256 helpers for /cli/authorize + /api/cli/token (Issue #153, plan
// D3).  Plain method and "none" method are rejected at /cli/authorize
// before the grant is even stored — this module never sees them.
//
// `verifyS256` uses `crypto.timingSafeEqual` so the comparison is
// constant-time regardless of the verifier bytes.  Length mismatches
// short-circuit to `false` BEFORE the compare (timingSafeEqual throws
// on length mismatch, leaking that single bit otherwise).

export function base64urlNoPad(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/u, "");
}

export function s256(verifier: string): string {
  const digest = createHash("sha256").update(verifier).digest();
  return base64urlNoPad(digest);
}

export function verifyS256(expectedChallenge: string, verifier: string): boolean {
  const computed = s256(verifier);
  const a = Buffer.from(expectedChallenge);
  const b = Buffer.from(computed);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Generate a one-time authorization grant code: 32 random bytes from the
 * Node CSPRNG, base64url-no-pad encoded → 43 chars.  Server-side storage
 * keeps only `sha256(code)`; the plaintext rides in the redirect URL
 * back to the CLI.
 */
export function generateGrantCode(): string {
  return base64urlNoPad(randomBytes(32));
}

export function hashGrantCode(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}
