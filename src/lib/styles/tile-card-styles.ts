export const TILE_CARD_STYLES = {
  base: "rounded-xl bg-surface-1 border border-surface-2 transition-colors",
  hover: "hover:bg-surface-2",
  padding: {
    compact: "p-3",
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
      compact: 20,
      comfortable: 20,
      detailed: 24,
    }
  }
} as const

export const TILE_STATUS_COLORS = {
  ready: "text-foreground-muted",
  started: "text-green-500",
  done: "text-primary",
} as const
