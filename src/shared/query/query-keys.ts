/**
 * Centralized TanStack Query key factory.
 *
 * Keys are typed as `as const` tuples so consumers can rely on
 * referential equality when calling `invalidateQueries` and so
 * accidental renames surface as type errors at the call site.
 */

export const queryKeys = {
  activeTile: ["v1", "active-tile"] as const,
  projects: ["v1", "projects"] as const,
  placements: ["v1", "placements"] as const,
  candidates: ["v1", "candidates"] as const,
  recurringTemplates: ["v1", "recurring-templates"] as const,
  tiles: ["v1", "tiles"] as const,
  /**
   * Cache namespace for calendar event chunks fetched by `useEvents`.
   * The chunk key is `[...queryKeys.eventsChunk, start, end, minMinutes,
   * includeRecurring, ownerIds, summary, minRecurringStepMs, limit]` —
   * every param that influences the upstream response must appear so a
   * `minMinutes` change, owner selection swap, etc. invalidates the
   * chunk instead of serving stale data.
   */
  eventsChunk: ["v1", "events-chunk"] as const,
} as const;
