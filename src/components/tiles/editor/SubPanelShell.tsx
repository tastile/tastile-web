"use client";

import { useEffect, type ReactNode } from "react";
import { CloseButton } from "@mantine/core";
import { PANEL_ANIM_ATTR } from "./panel-styles";

export type SubPanelKey =
  | "base"
  | "intent"
  | "time"
  | "duration"
  | "recurring"
  | "source-rules"
  | "relations"
  | "flows"
  | "tasks"
  | "references"
  | "completion"
  | "placement-rules"
  | "meta"
  | "task";

interface Props {
  panelKey: SubPanelKey;
  activeKey: SubPanelKey | null;
  onClose: () => void;
  headingId: string;
  title: string;
  description?: string;
  children: ReactNode;
  layout: "drawer" | "sheet";
}

export function SubPanelShell({
  panelKey,
  activeKey,
  onClose,
  headingId,
  title,
  description,
  children,
  layout,
}: Props) {
  const isActive = activeKey === panelKey;

  useEffect(() => {
    if (!isActive) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isActive, onClose]);

  const idleTransform = layout === "drawer" ? "translate-x-full" : "translate-y-full";
  const activeTransform = layout === "drawer" ? "translate-x-0" : "translate-y-0";

  return (
    <section
      role="region"
      aria-labelledby={headingId}
      aria-hidden={!isActive}
      inert={!isActive}
      {...{ [PANEL_ANIM_ATTR]: "" }}
      className={`absolute inset-0 flex flex-col bg-[var(--surface-1)] transition-transform duration-200 ${isActive ? activeTransform : idleTransform} ${isActive ? "" : "pointer-events-none"}`}
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-[var(--border-subtle)]">
        <div>
          <h2 id={headingId} className="text-sm font-semibold">
            {title}
          </h2>
          {description ? (
            <p className="text-xs text-[var(--foreground-muted)]">{description}</p>
          ) : null}
        </div>
        <CloseButton onClick={onClose} aria-label={`Close ${title}`} />
      </header>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </section>
  );
}