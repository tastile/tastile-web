"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { X } from "lucide-react";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { cn } from "@/lib/utils/cn";

/* ---------------------------------------------------------------------------
 * Dialog (Radix-free, pure React)
 *
 * - Controlled via `open` + `onOpenChange`.
 * - Renders into a portal so stacking-context / overflow issues disappear.
 * - ESC closes, overlay click closes.
 * - Locks body scroll while open.
 * - Restores focus to the previously focused element on close.
 * - Implements a simple focus trap: when Tab/Shift+Tab would leave the
 *   dialog, cycle back to the first/last tabbable element instead.
 * - Exposes a `data-state` attribute (`"open" | "closed"`) so that the
 *   existing Tailwind animation utilities (`data-[state=open]:animate-in`,
 *   etc.) keep working without Radix.
 * ------------------------------------------------------------------------- */

type DialogContextValue = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  titleId: string;
  descriptionId: string;
};

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext(component: string): DialogContextValue {
  const ctx = React.useContext(DialogContext);
  if (!ctx) {
    throw new Error(`<${component}> must be used inside <Dialog>.`);
  }
  return ctx;
}

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

function Dialog({ open, onOpenChange, children }: DialogProps) {
  const titleId = React.useId();
  const descriptionId = React.useId();
  const value = React.useMemo<DialogContextValue>(
    () => ({ open, onOpenChange, titleId, descriptionId }),
    [open, onOpenChange, titleId, descriptionId],
  );
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

Dialog.displayName = "Dialog";

/* -------------------------------------------------------------------------- */
/*  Overlay                                                                   */
/* -------------------------------------------------------------------------- */

const DialogOverlay = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => {
    const { open, onOpenChange } = useDialogContext("DialogOverlay");
    return (
      // biome-ignore lint/a11y/noStaticElementInteractions: backdrop click closes the dialog.
      // biome-ignore lint/a11y/useKeyWithClickEvents: backdrop is a click target only.
      <div
        ref={ref}
        data-state={open ? "open" : "closed"}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            onOpenChange(false);
          }
        }}
        className={cn(
          "fixed inset-0 z-50 bg-black/40 backdrop-blur-xs",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          className,
        )}
        {...props}
      />
    );
  },
);
DialogOverlay.displayName = "DialogOverlay";

/* -------------------------------------------------------------------------- */
/*  Content                                                                   */
/* -------------------------------------------------------------------------- */

const dialogContentVariants = cva(
  [
    "relative z-50 w-full max-w-screen border shadow-md",
    "bg-surface-1 text-foreground",
    "data-[state=open]:animate-in data-[state=closed]:animate-out",
    "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
    "data-[state=closed]:slide-out-to-left-[0%] data-[state=closed]:slide-out-to-top-[0%]",
    "data-[state=open]:slide-in-from-left-[0%] data-[state=open]:slide-in-from-top-[0%]",
    "sm:rounded-lg md:w-full",
  ].join(" "),
  {
    variants: {
      size: {
        tiny: "sm:align-middle sm:w-full sm:max-w-xs",
        small: "sm:align-middle sm:w-full sm:max-w-sm",
        medium: "sm:align-middle sm:w-full sm:max-w-lg",
        large: "sm:align-middle sm:w-full md:max-w-xl",
        xlarge: "sm:align-middle sm:w-full md:max-w-3xl",
        xxlarge: "sm:align-middle sm:w-full md:max-w-6xl",
        drawer:
          "right-0 top-0 h-full max-w-md sm:max-w-lg translate-x-0 data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right border-l sm:rounded-none",
      },
    },
    defaultVariants: {
      size: "medium",
    },
  },
);

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

interface DialogContentProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children">,
    VariantProps<typeof dialogContentVariants> {
  children: React.ReactNode;
  hideClose?: boolean;
}

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ className, children, size, hideClose, onKeyDown, ...props }, ref) => {
    const { open, onOpenChange, titleId, descriptionId } = useDialogContext("DialogContent");
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const previousFocusRef = React.useRef<HTMLElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        contentRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref],
    );

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
        if (first) {
          first.focus();
        } else {
          node.focus();
        }
      });

      return () => {
        window.cancelAnimationFrame(id);
        document.body.style.overflow = originalOverflow;
        if (previousFocusRef.current && typeof previousFocusRef.current.focus === "function") {
          previousFocusRef.current.focus();
        }
      };
    }, [open]);

    function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
      if (event.key === "Escape") {
        event.stopPropagation();
        onOpenChange(false);
        return;
      }
      if (event.key === "Tab") {
        const node = contentRef.current;
        if (!node) return;
        const focusable = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
          (el) => !el.hasAttribute("disabled") && el.offsetParent !== null,
        );
        if (focusable.length === 0) {
          event.preventDefault();
          node.focus();
          return;
        }
        const first = focusable[0];
        const last = focusable.at(-1);
        if (!first || !last) return;
        const active = document.activeElement as HTMLElement | null;
        if (event.shiftKey) {
          if (active === first || !node.contains(active)) {
            event.preventDefault();
            last.focus();
          }
        } else {
          if (active === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }
      onKeyDown?.(event);
    }

    if (!open) return null;

    const content = (
      <div
        ref={setRefs}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        data-state="open"
        onKeyDown={handleKeyDown}
        className={cn(dialogContentVariants({ size }), className)}
        {...props}
      >
        {children}
        {!hideClose ? (
          <button
            type="button"
            aria-label="Close"
            onClick={() => onOpenChange(false)}
            className="absolute right-4 top-4 rounded-sm opacity-20 ring-offset-background transition-opacity hover:opacity-100 focus:outline-hidden focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X size={16} />
            <span className="sr-only">Close</span>
          </button>
        ) : null}
      </div>
    );

    if (typeof document === "undefined") return content;
    return (
      <>
        <DialogOverlay />
        {ReactDOM.createPortal(content, document.body)}
      </>
    );
  },
);
DialogContent.displayName = "DialogContent";

/* -------------------------------------------------------------------------- */
/*  Header / Footer / Title / Description                                     */
/* -------------------------------------------------------------------------- */

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col gap-1.5 text-center sm:text-left px-6 py-4", className)}
    {...props}
  />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 border-t px-6 py-4",
      className,
    )}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => {
    const { titleId } = useDialogContext("DialogTitle");
    return (
      <h2
        ref={ref}
        id={titleId}
        className={cn("text-base leading-none font-normal max-w-[calc(100%-1rem)]", className)}
        {...props}
      />
    );
  },
);
DialogTitle.displayName = "DialogTitle";

const DialogDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => {
  const { descriptionId } = useDialogContext("DialogDescription");
  return (
    <p
      ref={ref}
      id={descriptionId}
      className={cn("text-sm text-foreground-muted", className)}
      {...props}
    />
  );
});
DialogDescription.displayName = "DialogDescription";

export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
};
