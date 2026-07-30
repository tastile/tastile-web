"use client";

import { CloseButton } from "@mantine/core";
import { type ReactNode, useEffect, useRef } from "react";
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

  const onCloseRef = useRef(onClose);

  // Sync ref in an effect to avoid ref mutation during render.
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isActive) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isActive]);

  const isDrawer = layout === "drawer";

  const idleTransform = isDrawer ? "translate-x-full" : "translate-y-full";
  const activeTransform = isDrawer ? "translate-x-0" : "translate-y-0";

  const positioning = isDrawer
    ? "fixed inset-y-0 right-0 z-[58] w-[36rem] border-l border-border shadow-lg"
    : "absolute inset-0 z-[60]";

  return (
    <section
      aria-labelledby={headingId}
      aria-hidden={!isActive}
      inert={!isActive}
      {...{ [PANEL_ANIM_ATTR]: "" }}
      className={`${positioning} flex flex-col bg-surface-0 transition-transform duration-200 ${isActive ? activeTransform : idleTransform} ${isActive ? "" : "pointer-events-none"}`}
    >
      <header className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div>
          <h2 id={headingId} className="text-sm font-semibold">
            {title}
          </h2>
          {description ? <p className="text-xs text-foreground-muted">{description}</p> : null}
        </div>
        <CloseButton onClick={onClose} aria-label={`Close ${title}`} />
      </header>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </section>
  );
}
