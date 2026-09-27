// Registry of CLI clients known to /cli/authorize + /api/cli/token
// (Issue #153, plan D5).  The set is intentionally tiny and read-only —
// every entry MUST be reviewed at registration time because the registered
// scopes determine what the Web mints on the user's behalf.
//
// Unknown client → 400 invalid_client (no leakage of registered names).

export interface RegisteredClient {
  /** Wire value of the `client_id` parameter. */
  readonly id: string;
  /** Scopes the client is allowed to request, canonical sorted form. */
  readonly scopes: readonly string[];
}

const CLIENTS: Readonly<Record<string, RegisteredClient>> = {
  "tastile-cli": {
    id: "tastile-cli",
    scopes: ["tastile.read", "tastile.write"],
  },
} as const;

export function getClient(id: string): RegisteredClient | undefined {
  return CLIENTS[id];
}

/**
 * Intersect the requested scope string (space-separated, possibly
 * duplicate / unordered) with the registered scopes for the client.
 *
 * Returns the canonical sorted form (alphabetical) of the intersection.
 * The caller MUST treat an empty intersection as 400 invalid_scope.
 */
export function intersectScopes(
  requested: string,
  registered: readonly string[],
): string[] {
  const registeredSet = new Set(registered);
  const seen = new Set<string>();
  for (const raw of requested.split(/\s+/u)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (!registeredSet.has(trimmed)) continue;
    seen.add(trimmed);
  }
  return [...seen].sort();
}

/**
 * Canonical (sorted, dedup, space-joined) form of an effective scope set.
 * Used both as the `scopes_effective` column value and as the value sent
 * to tastile-core's `/v1/api-tokens`.  Matches `ScopeSet::as_canonical_string`
 * semantics on the Core side (A.1 of the sibling PR).
 */
export function canonicalScopes(scopes: readonly string[]): string {
  return [...new Set(scopes)].sort().join(" ");
}
