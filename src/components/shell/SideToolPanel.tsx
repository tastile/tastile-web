"use client";

import { useSidePanelContent } from "@/lib/context/side-panel-context";
import { cn } from "@/lib/utils/cn";

/**
 * ActivityBar の右に表示されるサイドツールパネル。
 * 各ページが useSidePanel() でコンテンツを登録した場合のみ表示される。
 * Supabase の LayoutSidebar に相当する。
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
