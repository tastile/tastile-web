/**
 * @fileoverview Button visual styling constants
 *
 * Provides consistent styling configuration for interactive button elements
 * across the application. Aligns with the Tastile monochrome theme system
 * defined in globals.css.
 *
 * @module lib/styles/button-styles
 *
 * Design principles:
 * - Clear visual affordance for clickable elements
 * - Strong hover and active states for interactivity
 * - Consistent sizing and spacing across button variants
 * - Monochrome color palette with semantic token usage
 *
 * Usage:
 * ```tsx
 * import { BUTTON_STYLES } from '@/lib/styles/button-styles';
 *
 * <button className={BUTTON_STYLES.primary}>Primary Action</button>
 * <button className={BUTTON_STYLES.secondary}>Secondary Action</button>
 * <button className={BUTTON_STYLES.icon}>
 *   <Icon className="h-5 w-5" />
 * </button>
 * ```
 */

/**
 * Button styling configuration for different button variants
 */
export const BUTTON_STYLES = {
  /**
   * Primary button - High emphasis actions
   */
  primary:
    "rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-fg transition-all hover:bg-primary-hover hover:shadow-md active:scale-95 disabled:opacity-50",

  /**
   * Secondary button - Medium emphasis actions
   */
  secondary:
    "rounded-lg border border-border bg-surface-1 px-3 py-2 text-sm font-semibold text-foreground transition-all hover:bg-surface-2 hover:border-border-strong hover:shadow-sm active:scale-95 disabled:opacity-50",

  /**
   * Ghost button - Low emphasis actions
   */
  ghost:
    "rounded-lg px-3 py-2 text-sm font-semibold text-foreground-muted transition-all hover:bg-surface-1 hover:text-foreground active:scale-95 disabled:opacity-50",

  /**
   * Icon button - Icon-only actions
   */
  icon: "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-all hover:bg-surface-2 hover:shadow-sm active:scale-95 disabled:opacity-50",

  /**
   * Icon button (large) - Larger icon actions
   */
  iconLarge:
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-all hover:bg-surface-2 hover:shadow-sm active:scale-95 disabled:opacity-50",
} as const

/**
 * Interactive element hover states for non-button elements
 */
export const INTERACTIVE_STYLES = {
  /**
   * Card hover - For clickable card elements
   */
  cardHover:
    "transition-all hover:bg-surface-2 hover:shadow-md hover:scale-[1.01] active:scale-100 cursor-pointer",

  /**
   * List item hover - For clickable list items
   */
  listItemHover: "transition-all hover:bg-surface-1 cursor-pointer",

  /**
   * Status icon hover - For clickable status indicators
   */
  statusIconHover:
    "transition-all cursor-pointer hover:ring-2 hover:ring-border-strong hover:ring-offset-2 hover:ring-offset-background rounded-full",
} as const
