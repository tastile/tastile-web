// src/components/shell/SideToolPanel.tsx
"use client";

import { useSidePanelContent } from "@/lib/context/side-panel-context";
import { useShellStore } from "@/lib/stores/shell-store";
import { cn } from "@/lib/utils/cn";
import { X } from "lucide-react";

/**
 * Side tool panel that renders to the right of the activity bar.
 * Only shown when a page has registered content via useSidePanel().
 * Open/close state is managed by the shell store so both the panel's
 * close button and the ActivityBar's toggle button can control it.
 */
export function SideToolPanel() {
  const content = useSidePanelContent();
  const sidePanelOpen = useShellStore((s) => s.sidePanelOpen);
  const setSidePanel = useShellStore((s) => s.setSidePanel);

  if (!content) return null;
  if (!sidePanelOpen) return null;

  return (
    <aside
      aria-label="Detail panel"
      className={cn(
        "hidden md:flex w-64 shrink-0 flex-col",
        "border-r border-border bg-surface-0",
        "overflow-y-auto",
      )}
    >
      <header className="flex items-center justify-between px-4 py-2 border-b border-[var(--border-subtle)]">
        <span className="text-xs font-medium uppercase tracking-wide text-[var(--foreground-muted)]">
          Details
        </span>
        <button
          onClick={() => setSidePanel(false)}
          aria-label="Close detail panel"
          type="button"
          className="rounded-md p-1 hover:bg-[var(--surface-2)]"
        >
          <X size={16} aria-hidden />
        </button>
      </header>
      <div className="p-4">{content}</div>
    </aside>
  );
}
