/**
 * Centralized TanStack Query key factory.
 *
 * Keys are typed as `as const` tuples so consumers can rely on
 * referential equality when calling `invalidateQueries` and so
 * accidental renames surface as type errors at the call site.
 */

export const queryKeys = {
  activeTile: ["v1", "active-tile"] as const,
} as const;
