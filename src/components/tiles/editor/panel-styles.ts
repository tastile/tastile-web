export const SEGMENT_STYLES = {
  root: { backgroundColor: "var(--surface-2)" },
  indicator: { backgroundColor: "var(--surface-1)" },
  label: { color: "var(--foreground)" },
} as const;

export const FOCUS_RING_CLASS =
  "focus-visible:outline-2 focus-visible:outline-[var(--focus-ring)] focus-visible:outline-offset-2";

export const SURFACE_CLASSES = {
  raised: "bg-[var(--surface-1)] shadow-[var(--shadow-1)]",
  elevated: "bg-[var(--surface-3)] shadow-[var(--shadow-2)]",
  inset: "bg-[var(--surface-inset)]",
} as const;

export const INPUT_RADIUS = "rounded-md";

export const PANEL_ANIM_ATTR = "data-panel-anim";