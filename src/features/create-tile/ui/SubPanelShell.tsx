"use client";

import { PANEL_ANIM_ATTR } from "@/shared/ui/panel-styles";
import { ActionIcon } from "@mantine/core";
import { ArrowLeft } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";

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
  | "task"
  | "task-details"
  | "event-details"
  | "recurring-details";

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

const EXIT_MS = 150;

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

  // Keep mounted during exit animation, then unmount.
  const [render, setRender] = useState(isActive);
  const [exiting, setExiting] = useState(false);
  const [entered, setEntered] = useState(isActive);
  const mountedActive = useRef(isActive);

  useEffect(() => {
    if (isActive) {
      setExiting(false);
      setRender(true);
      // If this panel was active from the very first render (no transition),
      // skip the enter animation — it's already at the active position.
      if (mountedActive.current) {
        mountedActive.current = false;
        return;
      }
      setEntered(false);
      // Mount at idle position, then transition to active on next frame.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setEntered(true);
        });
      });
    } else if (render) {
      setEntered(false);
      setExiting(true);
      const t = setTimeout(() => {
        setExiting(false);
        setRender(false);
      }, EXIT_MS);
      return () => clearTimeout(t);
    }
  }, [isActive]);

  if (!render) return null;

  const isDrawer = layout === "drawer";

  const positioning = isDrawer
    ? "fixed inset-y-0 right-0 z-[58] w-[36rem] border-l border-border shadow-lg"
    : "absolute inset-0 z-[60]";

  const idleTransform = isDrawer ? "translate-x-full" : "translate-y-full";
  const activeTransform = isDrawer ? "translate-x-0" : "translate-y-0";

  return (
    <section
      aria-labelledby={headingId}
      aria-hidden={!isActive}
      inert={!isActive}
      {...{ [PANEL_ANIM_ATTR]: "" }}
      className={`${positioning} flex flex-col bg-surface-0 transition-transform duration-150 ${exiting || !entered ? idleTransform : activeTransform} ${isActive ? "" : "pointer-events-none"}`}
    >
      <header className="grid grid-cols-[20px_1fr_auto] items-center gap-3 px-4 py-3 border-b border-border">
        <ActionIcon
          variant="subtle"
          size="sm"
          onClick={onClose}
          aria-label={`Back from ${title}`}
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
        </ActionIcon>
        <div className="min-w-0">
          <h2 id={headingId} className="text-sm font-semibold">
            {title}
          </h2>
          {description ? <p className="text-xs text-foreground-muted">{description}</p> : null}
        </div>
      </header>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </section>
  );
}
