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
 *
 * Corner radius follows hierarchy:
 * - `pill`: Standalone/floating buttons with no parent container
 * - `primary`/`secondary`/`ghost`: Buttons inside containers (follows container hierarchy)
 */
export const BUTTON_STYLES = {
  /**
   * Primary button - High emphasis, standalone contexts (CTA, overlays)
   */
  primary:
    "rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg transition-all hover:bg-primary-hover active:scale-95 disabled:opacity-50",

  /**
   * Secondary button - Medium emphasis, standalone contexts
   */
  secondary:
    "rounded-full bg-surface-1 px-4 py-2.5 text-sm font-semibold text-foreground transition-all hover:bg-surface-2 active:scale-95 disabled:opacity-50",

  /**
   * Ghost button - Low emphasis, inside containers
   */
  ghost:
    "rounded-md px-3 py-2 text-sm font-semibold text-foreground-muted transition-all hover:bg-surface-1 hover:text-foreground active:scale-95 disabled:opacity-50",

  /**
   * Icon button - Icon-only, inside containers
   */
  icon: "flex h-8 w-8 shrink-0 items-center justify-center rounded-md transition-all hover:bg-surface-2 active:scale-95 disabled:opacity-50",

  /**
   * Icon button (large) - Larger icon actions, inside containers
   */
  iconLarge:
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-md transition-all hover:bg-surface-2 active:scale-95 disabled:opacity-50",
} as const;
