/**
 * Mirrors domain::TileLifecycleKind / ObjectiveModeKind / DoneRuleKind in
 * `tastile-core/crates/v1/domain/src/constants.rs`.
 *
 * The Rust crate is the source of truth — keep these numeric codes in sync.
 * Per `tastile-web/CLAUDE.md` "DO NOT use `kind` string enums", v1 surfaces
 * these as i16 numeric constants, not string unions.
 */

/** TileListView.lifecycle (numeric code). */
export const TILE_LIFECYCLE = {
  READY: 0,
  STARTED: 1,
  DONE: 2,
  CLOSED: 3,
} as const;
export type TileLifecycle = (typeof TILE_LIFECYCLE)[keyof typeof TILE_LIFECYCLE];

/** TileListView.objective_mode (numeric code). */
export const OBJECTIVE_MODE = {
  FINISH_ONCE: 0,
  RECURRING: 1,
  MAXIMIZE_WITHIN_INTERVAL: 2,
  LABEL_ONLY: 3,
} as const;
export type ObjectiveMode = (typeof OBJECTIVE_MODE)[keyof typeof OBJECTIVE_MODE];

/** TileListView.done_rule (numeric code; null when no done-rule applies). */
export const DONE_RULE = {
  MANUAL: 0,
  TIME_REACHED: 1,
  INTERVAL_END: 2,
} as const;
export type DoneRule = (typeof DONE_RULE)[keyof typeof DONE_RULE];