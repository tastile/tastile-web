/**
 * v1 Reference — tastile-core/v1/05-condition-and-reference.md §Reference
 *
 * Interfaces only. No business logic.
 */

export interface TargetSelector {
  /** EXACT=0 | SERIES=1 | FILTER=2 | CONTEXT=3 */
  kind: number;
  /** Subject selector (when kind = CONTEXT). SUBJECT=0 | CURRENT_PLACEMENT=1 | CURRENT_EXECUTION=2 | PARENT_PLACEMENT=3 | CURRENT_FRAME=4 */
  contextKind: number | null;
  referenceId: string | null;
  conditionId: string | null;
}

export interface Pick {
  /** ALL=0 | FIRST=1 | LAST=2 | BEFORE=3 | AFTER=4 */
  kind: number;
  /** Anchor Moment id (when kind = BEFORE / AFTER). */
  momentId: string | null;
}

export interface Reference {
  id: string;
  target: TargetSelector;
  pick: Pick;
}