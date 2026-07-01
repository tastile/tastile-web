/**
 * v1 Placement — tastile-core/v1/02-core-entities.md §Placement
 *
 * Interfaces only. No business logic.
 */

export interface ResolutionViolation {
  /** ApiErrorKind numeric value. */
  kind: number;
  message: string;
  /** Revision the error applies to (envelope-side metadata; null when unknown). */
  currentRevision: number | null;
}
