// src/components/shell/SideToolPanel.tsx
"use client";

import { useSidePanelContent } from "@/shared/context/side-panel-context";
import { cn } from "@/shared/lib/cn";

/**
 * Side tool panel that renders to the right of the activity bar.
 *
 * The dashboard treats this as a permanent fixture next to the
 * activity bar — there are no open / close controls on the panel
 * itself or in the ActivityBar — so the `<aside>` is always mounted.
 * When no page has registered content yet (SSR / hydration / a
 * page that does not push content), we render an empty placeholder
 * so the layout never sees a "panel collapsed" state.
 */
export function SideToolPanel() {
  const content = useSidePanelContent();

  return (
    <aside
      aria-label="Side panel"
      className={cn(
        "hidden md:flex w-64 shrink-0 flex-col",
        "border-r border-border bg-surface-0",
        "overflow-y-auto",
      )}
    >
      <div className="p-4">{content}</div>
    </aside>
  );
}
