/**
 * Design System v2.0 token map.
 *
 * This file is the **TypeScript single source of truth** that React
 * components / Mantine theme / tests can import. CSS custom property
 * VALUES are owned by `src/app/globals.css`; this file holds the
 * `var(--xxx)` REFERENCES only.
 *
 * Adding a new token:
 *   1. Define `--xxx` in `globals.css :root` (and theme overrides if needed)
 *   2. Add a corresponding entry here
 *   3. Never the reverse order — `as const` enforces compile-time
 *      whitelist of permitted var names via the
 *      `no-unknown-css-var-in-tokens` ESLint rule
 */
export const designTokens = {
  color: {
    background: 'var(--background)',
    surface: {
      0: 'var(--surface-0)',
      1: 'var(--surface-1)',
      2: 'var(--surface-2)',
      3: 'var(--surface-3)',
    },
    foreground: {
      DEFAULT: 'var(--foreground)',
      muted: 'var(--foreground-muted)',
      subtle: 'var(--foreground-subtle)',
      lighter: 'var(--foreground-lighter)',
    },
    primary: {
      DEFAULT: 'var(--primary)',
      hover: 'var(--primary-hover)',
      fg: 'var(--primary-foreground)',
    },
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger: 'var(--danger)',
  },
  radius: {
    none: 0,
    xs: 4,
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
    xxl: 32,
    xxxl: 40,
    full: 9999,
  },
  spacing: {
    'control-compact': 6,
    control: 8,
    section: 16,
    panel: 24,
    page: 32,
    row: 48,
    'row-tight': 44,
  },
  text: {
    display: 'var(--text-display-size)',
    title: 'var(--text-title-size)',
    body: 'var(--text-body-size)',
    caption: 'var(--text-caption-size)',
  },
} as const;