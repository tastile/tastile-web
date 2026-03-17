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
 * - Minimal visual difference between surface levels (Supabase-inspired)
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
 * Tile card density variant types
 */
export type TileCardVariant = "compact" | "comfortable" | "detailed";

/**
 * Tile lifecycle status
 * - ready: Not yet started
 * - started: Currently in progress
 * - done: Completed
 */
export type TileStatus = "ready" | "started" | "done";

/**
 * Base styling configuration for tile card components
 */
export const TILE_CARD_STYLES = {
  base: "rounded-xl bg-surface-1 border border-surface-2 transition-all",
  hover: "hover:bg-surface-2 hover:shadow-md hover:border-border-strong cursor-pointer",
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
    }
  }
} as const

/**
 * Status-based color mapping for tile states
 *
 * Note: `started` uses `text-green-500` because the current theme system
 * (globals.css) does not define a semantic color for "active" or "in-progress"
 * states. The monochrome palette includes:
 * - text-foreground-muted (ready state)
 * - text-primary (done state)
 *
 * TODO: Consider adding `--color-active` or `--color-success` to theme system
 * for semantic "started" state representation. Until then, green-500 provides
 * clear visual distinction for active tiles.
 */
export const TILE_STATUS_COLORS = {
  ready: "text-foreground-muted",
  started: "text-green-500", // No semantic token available in current theme
  done: "text-primary",
} as const
