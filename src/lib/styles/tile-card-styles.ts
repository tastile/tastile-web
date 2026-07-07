/**
 * @fileoverview Tile card visual styling constants
 *
 * Provides consistent styling configuration for tile card components across
 * compact, comfortable, and detailed density variants. Aligns with the Tastile
 * monochrome theme system defined in globals.css.
 *
 * @module lib/styles/tile-card-styles
 *
 * Design principles:
 * - Minimal visual difference between surface levels
 * - Monochrome color palette with semantic token usage
 * - Three density variants: compact (list view), comfortable (default), detailed (focus view)
 * - Tailwind CSS v4 syntax with theme-aware color tokens
 *
 * Usage:
 * ```tsx
 * import { TILE_CARD_STYLES, TILE_STATUS_COLORS } from '@/lib/styles/tile-card-styles';
 *
 * <div className={`${TILE_CARD_STYLES.base} ${TILE_CARD_STYLES.padding.compact}`}>
 *   <span className={TILE_STATUS_COLORS.started}>Active</span>
 * </div>
 * ```
 */

/**
 * Base styling configuration for tile card components
 */
export const TILE_CARD_STYLES = {
  base: "rounded-xl bg-surface-1 transition-all",
  hover: "hover:bg-surface-2 cursor-pointer",
  padding: {
    compact: "p-2.5",
    comfortable: "p-3",
    detailed: "p-4",
  },
  gap: {
    compact: "gap-2",
    comfortable: "gap-3",
    detailed: "gap-4",
  },
  statusIcon: {
    size: {
      compact: "w-5 h-5",
      comfortable: "w-5 h-5",
      detailed: "w-6 h-6",
    },
  },
} as const;

/**
 * Status-based color mapping for tile states
 *
 * Note: `started` uses `text-success` as a semantic token for active/in-progress
 * states.
 * - text-foreground-muted (ready state)
 * - text-success (started/active state)
 * - text-primary (done state)
 *
 * for semantic "started" state representation.
 */
export const TILE_STATUS_COLORS = {
  ready: "text-foreground-muted",
  started: "text-success",
  done: "text-primary",
  closed: "text-primary",
} as const;
