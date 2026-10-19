// cred.edge-assertion (root ADR-0014): a low-privilege shared secret the edge
// router adds to every request it forwards to the Cloud Run origin. It does
// not identify a user; it only lets the origin reject direct run.app access.
//
// Unset TASTILE_EDGE_ASSERTION: no check (local, CI, current AWS path).

export const EDGE_ASSERTION_HEADER = "x-tastile-edge-assertion";

type EnvLike = Readonly<Record<string, string | undefined>>;

function constantTimeEqual(a: string, b: string): boolean {
  const left = new TextEncoder().encode(a);
  const right = new TextEncoder().encode(b);
  let diff = left.length ^ right.length;
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    diff |= (left[i] ?? 0) ^ (right[i] ?? 0);
  }
  return diff === 0;
}

/** True when the request may proceed: no edge assertion configured, or the header matches. */
export function hasValidEdgeAssertion(
  headerValue: string | null,
  env: EnvLike = process.env,
): boolean {
  const expected = env.TASTILE_EDGE_ASSERTION?.trim();
  if (!expected) return true;
  if (!headerValue) return false;
  return constantTimeEqual(headerValue, expected);
}
