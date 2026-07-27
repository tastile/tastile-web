"use client";

import { useSidePanelContent } from "@/lib/context/side-panel-context";
import { cn } from "@/lib/utils/cn";

/**
 * Side tool panel that renders to the right of the activity bar.
 * Only shown when a page has registered content via useSidePanel().
 * Equivalent to Supabase's LayoutSidebar.
 */
export function SideToolPanel() {
  const content = useSidePanelContent();

  if (!content) return null;

  return (
    <aside
      aria-label="Side tool panel"
      className={cn(
        "hidden md:flex w-64 shrink-0 flex-col",
        "border-r border-border bg-surface-0",
        "overflow-y-auto",
      )}
    >
      {content}
    </aside>
  );
}
