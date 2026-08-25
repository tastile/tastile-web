import type { CSSVariablesResolver } from "@mantine/core";

/**
 * Maps Mantine's internal CSS variables to the semantic tokens already
 * defined in `src/app/globals.css`. Because we reference the same CSS
 * variables (e.g. `var(--primary)`) for both Tailwind utilities and
 * Mantine, the four themes (light / dark-gray / dark-black) flip
 * automatically when the `<html class="dark">` class is toggled.
 *
 * Anything that does not depend on a Mantine color scheme goes in
 * `variables`; light/dark buckets stay empty because globals.css
 * already drives the cascade.
 */
export const cssVariablesResolver: CSSVariablesResolver = () => ({
  variables: {
    "--mantine-color-body": "var(--background)",
    "--mantine-color-text": "var(--foreground)",
    "--mantine-color-dimmed": "var(--foreground-muted)",
    "--mantine-color-bright": "var(--foreground)",
    "--mantine-color-placeholder": "var(--foreground-subtle)",
    "--mantine-color-anchor": "var(--primary)",

    // Default (neutral) button + input surfaces.
    "--mantine-color-default": "var(--surface-1)",
    "--mantine-color-default-hover": "var(--surface-2)",
    // DS v2 整合: デフォルト border を透明化（Mantine component 側の defaultProps と二段構え）
    "--mantine-default-border": "transparent",
    "--mantine-color-default-color": "var(--foreground)",
    "--mantine-color-default-border": "var(--border)",

    // Error / danger uses our existing --danger token.
    "--mantine-color-error": "var(--danger)",
    "--mantine-color-anchor-hover": "var(--primary-hover)",

    // Primary filled (button bg, switch track, focus ring accents).
    "--mantine-primary-color-filled": "var(--primary)",
    "--mantine-primary-color-filled-hover": "var(--primary-hover)",
    "--mantine-primary-color-light": "color-mix(in oklch, var(--primary) 12%, transparent)",
    "--mantine-primary-color-light-hover": "color-mix(in oklch, var(--primary) 18%, transparent)",
    "--mantine-primary-color-light-color": "var(--primary)",
    "--mantine-primary-color-contrast": "var(--primary-foreground)",
  },
  light: {},
  dark: {},
});
