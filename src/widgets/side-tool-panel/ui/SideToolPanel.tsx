// src/components/shell/SideToolPanel.tsx
"use client";

import { useSidePanelContent } from "@/shared/context/side-panel-context";
import { useTranslation } from "@/shared/i18n/use-translation";
import { cn } from "@/shared/lib/cn";

/**
 * Side tool panel that renders to the right of the activity bar.
 * The aside is always reserved — there is no closed state. Content
 * arrives via useSyncExternalStore; pages push it through useSidePanel
 * in a layout effect, so the registered content is in place before the
 * first paint after hydration. While content is empty (e.g. on a route
 * that has no side panel), the area is still rendered (empty) so the
 * surrounding layout does not shift and the panel never appears to be
 * missing.
 */
export function SideToolPanel() {
  const { t } = useTranslation();
  const content = useSidePanelContent();

  return (
    <aside
      aria-label={t("sideToolPanel.ariaLabel")}
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
