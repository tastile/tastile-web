"use client";

import { X } from "lucide-react";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { cn } from "@/lib/utils/cn";

/* ---------------------------------------------------------------------------
 * BottomSheet (Radix-free, pure React)
 *
 * - Controlled via `open` + `onOpenChange`.
 * - Renders into a portal, locks body scroll, ESC closes, overlay click
 *   closes, restores focus to the previously focused element.
 * ------------------------------------------------------------------------- */

interface BottomSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  title?: string;
  className?: string;
  hideClose?: boolean;
}

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

export function BottomSheet({
  open,
  onOpenChange,
  children,
  title,
  className,
  hideClose = false,
}: BottomSheetProps) {
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const titleId = React.useId();

  React.useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    previousFocusRef.current = previouslyFocused;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const id = window.requestAnimationFrame(() => {
      const node = contentRef.current;
      if (!node) return;
      const first = node.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (first) first.focus();
      else node.focus();
    });

    return () => {
      window.cancelAnimationFrame(id);
      document.body.style.overflow = originalOverflow;
      if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
        previousFocusRef.current.focus();
      }
    };
  }, [open]);

  if (!open) return null;
  if (typeof document === "undefined") return null;

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.stopPropagation();
      onOpenChange(false);
    }
  }

  const content = (
    // biome-ignore lint/a11y/noStaticElementInteractions: Escape-key handler on the sheet wrapper.
    <div className="fixed inset-0 z-50" data-state="open" onKeyDown={handleKeyDown}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: backdrop click closes the sheet. */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop is a click target only. */}
      <div
        className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 transition-opacity duration-200"
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onOpenChange(false);
          }
        }}
        data-state="open"
      />
      <div
        ref={contentRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        data-state="open"
        className={cn(
          "fixed inset-x-0 bottom-0 z-50 flex h-[80vh] flex-col rounded-t-2xl bg-surface-1 border-t border-border shadow-xl",
          "focus:outline-hidden",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
          "transition-all duration-300 ease-out",
          className,
        )}
      >
        <div className="flex justify-center py-3 shrink-0">
          <div className="h-1.5 w-12 rounded-full bg-border" />
        </div>

        {title || !hideClose ? (
          <div className="flex items-center justify-between border-b border-border px-6 pb-4 shrink-0">
            {title ? (
              <h2 id={titleId} className="text-base font-semibold text-foreground">
                {title}
              </h2>
            ) : (
              <div />
            )}
            {!hideClose ? (
              <button
                type="button"
                aria-label="Close"
                onClick={() => onOpenChange(false)}
                className="rounded-sm p-1 opacity-60 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
              >
                <X size={18} />
                <span className="sr-only">Close</span>
              </button>
            ) : null}
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(content, document.body);
}
