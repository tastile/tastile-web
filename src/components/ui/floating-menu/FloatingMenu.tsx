"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { cn } from "@/lib/utils/cn";
import styles from "./FloatingMenu.module.css";

/* ---------------------------------------------------------------------------
 * FloatingMenu — Web Component-pattern compound component
 *
 *  <FloatingMenu>
 *    <FloatingMenuTrigger asChild>
 *      <button>…</button>
 *    </FloatingMenuTrigger>
 *    <FloatingMenuContent align="end">
 *      <FloatingMenuLabel>…</FloatingMenuLabel>
 *      <FloatingMenuSeparator />
 *      <FloatingMenuItem onSelect={…}>…</FloatingMenuItem>
 *    </FloatingMenuContent>
 *  </FloatingMenu>
 *
 * data-* attributes drive state and styling (Web Component pattern).
 * Portal-based rendering isolates the floating panel from parent DOM.
 * CSS Modules provide scoped styling.
 * ------------------------------------------------------------------------ */

type FloatingMenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
  contentId: string;
};

const FloatingMenuContext = React.createContext<FloatingMenuContextValue | null>(null);

function useFloatingMenuContext(component: string): FloatingMenuContextValue {
  const ctx = React.useContext(FloatingMenuContext);
  if (!ctx) throw new Error(`<${component}> must be used inside <FloatingMenu>.`);
  return ctx;
}

/* -------------------------------------------------------------------------- */
/*  FloatingMenu (root)                                                       */
/* -------------------------------------------------------------------------- */

interface FloatingMenuProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  // External trigger element. Required when the trigger lives outside
  // this component (e.g. a Bell button in the page header that drives
  // a portal'd panel mounted elsewhere). When omitted, FloatingMenu
  // falls back to an internal ref registered by FloatingMenuTrigger.
  triggerRef?: React.RefObject<HTMLElement | null>;
}

function FloatingMenu({
  children,
  open,
  defaultOpen,
  onOpenChange,
  triggerRef: externalTriggerRef,
}: FloatingMenuProps) {
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
  const actualOpen = isControlled ? open : internalOpen;
  const internalTriggerRef = React.useRef<HTMLElement | null>(null);
  const triggerRef = externalTriggerRef ?? internalTriggerRef;
  const contentId = React.useId();

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const value = React.useMemo<FloatingMenuContextValue>(
    () => ({ open: actualOpen, setOpen, triggerRef, contentId }),
    [actualOpen, setOpen, triggerRef, contentId],
  );

  return <FloatingMenuContext.Provider value={value}>{children}</FloatingMenuContext.Provider>;
}
FloatingMenu.displayName = "FloatingMenu";

/* -------------------------------------------------------------------------- */
/*  Trigger                                                                   */
/* -------------------------------------------------------------------------- */

interface FloatingMenuTriggerProps extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  asChild?: boolean;
  children: React.ReactNode;
}

const FloatingMenuTrigger = React.forwardRef<HTMLElement, FloatingMenuTriggerProps>(
  ({ asChild, children, onClick, className, ...props }, ref) => {
    const { open, setOpen, triggerRef, contentId } = useFloatingMenuContext("FloatingMenuTrigger");

    const setRefs = React.useCallback(
      (node: HTMLElement | null) => {
        triggerRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLElement | null>).current = node;
      },
      [ref, triggerRef],
    );

    const handleClick = React.useCallback(
      (event: React.MouseEvent<HTMLElement>) => {
        onClick?.(event as React.MouseEvent<HTMLElement>);
        if (!event.defaultPrevented) {
          setOpen(!open);
        }
      },
      [onClick, open, setOpen],
    );

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<Record<string, unknown>>;
      const childProps = child.props ?? {};
      return React.cloneElement(child, {
        ...props,
        ref: setRefs,
        "data-floating-menu-trigger": "",
        "data-state": open ? "open" : "closed",
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": open ? contentId : undefined,
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          const existing = childProps.onClick as React.MouseEventHandler<HTMLElement> | undefined;
          existing?.(event);
          handleClick(event);
        },
        className: cn(childProps.className as string | undefined, className),
      } as Record<string, unknown>);
    }

    return (
      <button
        ref={setRefs as unknown as React.Ref<HTMLButtonElement>}
        type="button"
        data-floating-menu-trigger=""
        data-state={open ? "open" : "closed"}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? contentId : undefined}
        onClick={handleClick}
        className={className}
        {...props}
      >
        {children}
      </button>
    );
  },
);
FloatingMenuTrigger.displayName = "FloatingMenuTrigger";

/* -------------------------------------------------------------------------- */
/*  Positioning logic                                                         */
/* -------------------------------------------------------------------------- */

type Align = "start" | "end" | "center";
type Side = "bottom" | "top";

interface Position {
  top: number;
  left: number;
  side: Side;
}

function computePosition(
  triggerRect: DOMRect,
  contentRect: DOMRect,
  align: Align,
  sideOffset: number,
  side: Side,
): Position {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  let top: number;
  if (side === "bottom") {
    top = triggerRect.bottom + window.scrollY + sideOffset;
    // overflow check: if content goes below viewport, flip to top
    if (triggerRect.bottom + sideOffset + contentRect.height > vh) {
      top = triggerRect.top + window.scrollY - sideOffset - contentRect.height;
      side = "top";
    }
  } else {
    top = triggerRect.top + window.scrollY - sideOffset - contentRect.height;
    if (top < 0) {
      top = triggerRect.bottom + window.scrollY + sideOffset;
      side = "bottom";
    }
  }

  let left: number;
  if (align === "end") {
    left = triggerRect.right + window.scrollX - contentRect.width;
  } else if (align === "center") {
    left = triggerRect.left + window.scrollX + triggerRect.width / 2 - contentRect.width / 2;
  } else {
    left = triggerRect.left + window.scrollX;
  }

  // horizontal overflow correction
  if (left + contentRect.width > vw - 8) {
    left = vw - contentRect.width - 8;
  }
  if (left < 8) {
    left = 8;
  }

  return { top, left, side };
}

/* -------------------------------------------------------------------------- */
/*  Content (portal)                                                          */
/* -------------------------------------------------------------------------- */

interface FloatingMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: Align;
  side?: Side;
  sideOffset?: number;
}

const FloatingMenuContent = React.forwardRef<HTMLDivElement, FloatingMenuContentProps>(
  (
    {
      className,
      align = "start",
      side: initialSide = "bottom",
      sideOffset = 4,
      style,
      children,
      ...props
    },
    ref,
  ) => {
    const { open, setOpen, triggerRef, contentId } = useFloatingMenuContext("FloatingMenuContent");
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const [pos, setPos] = React.useState<Position>({ top: 0, left: 0, side: initialSide });
    const [resolvedSide, setResolvedSide] = React.useState<Side>(initialSide);
    const [positioned, setPositioned] = React.useState(false);

    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        contentRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref],
    );

    // Position calculation
    React.useLayoutEffect(() => {
      if (!open || !triggerRef.current || !contentRef.current) {
        setPositioned(false);
        return;
      }
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const contentRect = contentRef.current.getBoundingClientRect();
      const position = computePosition(triggerRect, contentRect, align, sideOffset, initialSide);
      setPos(position);
      setResolvedSide(position.side);
      setPositioned(true);
    }, [open, align, sideOffset, triggerRef, initialSide]);

    // Outside click + ESC
    React.useEffect(() => {
      if (!open) return;
      function onPointerDown(event: PointerEvent) {
        const target = event.target as Node | null;
        if (!target) return;
        if (contentRef.current?.contains(target)) return;
        if (triggerRef.current?.contains(target)) return;
        setOpen(false);
      }
      function onKeyDown(event: KeyboardEvent) {
        if (event.key === "Escape") {
          event.stopPropagation();
          setOpen(false);
          return;
        }
        // Arrow key navigation
        if (event.key === "ArrowDown" || event.key === "ArrowUp") {
          event.preventDefault();
          const items = contentRef.current?.querySelectorAll(
            "[data-floating-menu-item]:not([data-disabled])",
          );
          if (!items?.length) return;
          const focused = contentRef.current?.querySelector("[data-focus]");
          let idx = Array.from(items).indexOf(focused as Element);
          if (event.key === "ArrowDown") {
            idx = idx < items.length - 1 ? idx + 1 : 0;
          } else {
            idx = idx > 0 ? idx - 1 : items.length - 1;
          }
          items.forEach((el, i) => {
            (el as HTMLElement).dataset.focus = i === idx ? "" : undefined;
          });
          (items[idx] as HTMLElement).focus();
        }
        if (event.key === "Home") {
          event.preventDefault();
          const items = contentRef.current?.querySelectorAll(
            "[data-floating-menu-item]:not([data-disabled])",
          );
          if (items?.length) {
            (items[0] as HTMLElement).focus();
          }
        }
        if (event.key === "End") {
          event.preventDefault();
          const items = contentRef.current?.querySelectorAll(
            "[data-floating-menu-item]:not([data-disabled])",
          );
          if (items?.length) {
            (items[items.length - 1] as HTMLElement).focus();
          }
        }
      }
      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onKeyDown);
      return () => {
        document.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("keydown", onKeyDown);
      };
    }, [open, setOpen, triggerRef]);

    if (!open || typeof document === "undefined") return null;

    return ReactDOM.createPortal(
      <div
        ref={setRefs}
        id={contentId}
        role="menu"
        data-floating-menu-content=""
        data-state={positioned ? "open" : "closed"}
        data-align={align}
        data-side={resolvedSide}
        style={{ ...pos, ...style }}
        className={cn(styles.content, className)}
        {...props}
      >
        {children}
      </div>,
      document.body,
    );
  },
);
FloatingMenuContent.displayName = "FloatingMenuContent";

/* -------------------------------------------------------------------------- */
/*  Item                                                                      */
/* -------------------------------------------------------------------------- */

interface FloatingMenuItemProps extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  asChild?: boolean;
  inset?: boolean;
  onSelect?: (event: React.MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

const FloatingMenuItem = React.forwardRef<HTMLElement, FloatingMenuItemProps>(
  ({ asChild, inset, onSelect, onClick, disabled, className, children, ...props }, ref) => {
    const { setOpen } = useFloatingMenuContext("FloatingMenuItem");

    const handleSelect = React.useCallback(
      (event: React.MouseEvent<HTMLElement>) => {
        if (disabled) return;
        onClick?.(event);
        onSelect?.(event);
        if (!event.defaultPrevented) {
          setOpen(false);
        }
      },
      [disabled, onClick, onSelect, setOpen],
    );

    const handleKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        (event.currentTarget as HTMLElement).click();
      }
    }, []);

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<Record<string, unknown>>;
      const childProps = child.props ?? {};
      return React.cloneElement(child, {
        ...props,
        ref,
        role: "menuitem",
        tabIndex: disabled ? -1 : 0,
        "data-floating-menu-item": "",
        "data-disabled": disabled || undefined,
        "aria-disabled": disabled || undefined,
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          const existing = childProps.onClick as React.MouseEventHandler<HTMLElement> | undefined;
          existing?.(event);
          handleSelect(event);
        },
        onKeyDown: handleKeyDown,
        className: cn(
          styles.item,
          inset && "pl-8",
          childProps.className as string | undefined,
          className,
        ),
      } as Record<string, unknown>);
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        role="menuitem"
        tabIndex={disabled ? -1 : 0}
        data-floating-menu-item=""
        data-disabled={disabled || undefined}
        aria-disabled={disabled || undefined}
        disabled={disabled}
        onClick={handleSelect}
        onKeyDown={handleKeyDown}
        className={cn(styles.item, inset && "pl-8", className)}
        {...props}
      >
        {children}
      </button>
    );
  },
);
FloatingMenuItem.displayName = "FloatingMenuItem";

/* -------------------------------------------------------------------------- */
/*  Label / Separator                                                         */
/* -------------------------------------------------------------------------- */

interface FloatingMenuLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
}

const FloatingMenuLabel = React.forwardRef<HTMLDivElement, FloatingMenuLabelProps>(
  ({ className, inset, ...props }, ref) => (
    <div
      ref={ref}
      data-floating-menu-label=""
      className={cn(styles.label, inset && "pl-8", className)}
      {...props}
    />
  ),
);
FloatingMenuLabel.displayName = "FloatingMenuLabel";

const FloatingMenuSeparator = React.forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  ({ className, ...props }, ref) => (
    <hr
      ref={ref}
      data-floating-menu-separator=""
      aria-orientation="horizontal"
      className={cn(styles.separator, className)}
      {...props}
    />
  ),
);
FloatingMenuSeparator.displayName = "FloatingMenuSeparator";

export {
  FloatingMenu,
  FloatingMenuContent,
  FloatingMenuItem,
  FloatingMenuLabel,
  FloatingMenuSeparator,
  FloatingMenuTrigger,
};
