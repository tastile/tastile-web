"use client";

import * as React from "react";
import * as ReactDOM from "react-dom";
import { cn } from "@/lib/utils/cn";

/* ---------------------------------------------------------------------------
 * DropdownMenu (Radix-free, pure React)
 *
 * Minimal popover-style menu:
 *   <DropdownMenu>
 *     <DropdownMenuTrigger asChild><button>…</button></DropdownMenuTrigger>
 *     <DropdownMenuContent align="end">
 *       <DropdownMenuLabel>…</DropdownMenuLabel>
 *       <DropdownMenuItem onSelect={…}>…</DropdownMenuItem>
 *       <DropdownMenuSeparator />
 *     </DropdownMenuContent>
 *   </DropdownMenu>
 *
 * Controlled via the surrounding DropdownMenu state. The trigger toggles
 * open/close on click. Outside clicks and ESC close the menu.
 *
 * `asChild` on Trigger/Item clones the child element and merges the required
 * event handlers, so callers can keep using their own <button> / <Link>.
 * ------------------------------------------------------------------------- */

type MenuContextValue = {
  open: boolean;
  setOpen: (open: boolean) => void;
  triggerRef: React.RefObject<HTMLElement | null>;
};

const MenuContext = React.createContext<MenuContextValue | null>(null);

function useMenuContext(component: string): MenuContextValue {
  const ctx = React.useContext(MenuContext);
  if (!ctx) throw new Error(`<${component}> must be used inside <DropdownMenu>.`);
  return ctx;
}

interface DropdownMenuProps {
  children: React.ReactNode;
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

function DropdownMenu({ children, open, defaultOpen, onOpenChange }: DropdownMenuProps) {
  const isControlled = open !== undefined;
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen ?? false);
  const actualOpen = isControlled ? open : internalOpen;
  const triggerRef = React.useRef<HTMLElement | null>(null);

  const setOpen = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setInternalOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  const value = React.useMemo<MenuContextValue>(
    () => ({ open: actualOpen, setOpen, triggerRef }),
    [actualOpen, setOpen],
  );

  return <MenuContext.Provider value={value}>{children}</MenuContext.Provider>;
}
DropdownMenu.displayName = "DropdownMenu";

/* -------------------------------------------------------------------------- */
/*  Trigger                                                                   */
/* -------------------------------------------------------------------------- */

interface DropdownMenuTriggerProps extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  asChild?: boolean;
  children: React.ReactNode;
}

const DropdownMenuTrigger = React.forwardRef<HTMLElement, DropdownMenuTriggerProps>(
  ({ asChild, children, onClick, className, ...props }, ref) => {
    const { open, setOpen, triggerRef } = useMenuContext("DropdownMenuTrigger");

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
      // eslint-disable-next-line react-hooks/refs
      return React.cloneElement(child, {
        ...props,
        ref: setRefs,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "data-state": open ? "open" : "closed",
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
        aria-haspopup="menu"
        aria-expanded={open}
        data-state={open ? "open" : "closed"}
        onClick={handleClick}
        className={className}
        {...props}
      >
        {children}
      </button>
    );
  },
);
DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

/* -------------------------------------------------------------------------- */
/*  Content (portal)                                                          */
/* -------------------------------------------------------------------------- */

interface DropdownMenuContentProps extends React.HTMLAttributes<HTMLDivElement> {
  align?: "start" | "end" | "center";
  sideOffset?: number;
}

function getAlignedStyle(align: DropdownMenuContentProps["align"], trigger: HTMLElement | null) {
  if (!trigger || typeof window === "undefined") {
    return { left: 0, top: 0 };
  }
  const rect = trigger.getBoundingClientRect();
  if (align === "end") {
    return { top: rect.bottom + window.scrollY, left: rect.right + window.scrollX };
  }
  if (align === "center") {
    return {
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX + rect.width / 2,
    };
  }
  return { top: rect.bottom + window.scrollY, left: rect.left + window.scrollX };
}

const DropdownMenuContent = React.forwardRef<HTMLDivElement, DropdownMenuContentProps>(
  ({ className, align = "start", sideOffset = 4, style, children, ...props }, ref) => {
    const { open, setOpen, triggerRef } = useMenuContext("DropdownMenuContent");
    const contentRef = React.useRef<HTMLDivElement | null>(null);
    const [pos, setPos] = React.useState<React.CSSProperties>({});

    const setRefs = React.useCallback(
      (node: HTMLDivElement | null) => {
        contentRef.current = node;
        if (typeof ref === "function") ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
      },
      [ref],
    );

    React.useLayoutEffect(() => {
      if (!open) return;
      const base = getAlignedStyle(align, triggerRef.current);
      const offsetLeft = align === "end" ? -100 : align === "center" ? -50 : 0;
      setPos({
        position: "absolute",
        top: base.top + sideOffset,
        left: (base.left ?? 0) + offsetLeft,
      });
    }, [open, align, sideOffset, triggerRef]);

    // outside click + ESC
    React.useEffect(() => {
      if (!open) return;
      function onPointerDown(event: PointerEvent) {
        const target = event.target as Node | null;
        if (!target) return;
        if (contentRef.current?.contains(target)) return;
        if (triggerRef.current?.contains(target)) return;
        setOpen(false);
      }
      function onKey(event: KeyboardEvent) {
        if (event.key === "Escape") {
          event.stopPropagation();
          setOpen(false);
        }
      }
      document.addEventListener("pointerdown", onPointerDown);
      document.addEventListener("keydown", onKey);
      return () => {
        document.removeEventListener("pointerdown", onPointerDown);
        document.removeEventListener("keydown", onKey);
      };
    }, [open, setOpen, triggerRef]);

    if (!open || typeof document === "undefined") return null;

    return ReactDOM.createPortal(
      <div
        ref={setRefs}
        role="menu"
        data-state="open"
        style={{ ...pos, ...style }}
        className={cn(
          "z-50 min-w-32 overflow-hidden rounded-xl bg-surface-1 p-1 text-foreground shadow-lg border",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
          "w-64",
          className,
        )}
        {...props}
      >
        {children}
      </div>,
      document.body,
    );
  },
);
DropdownMenuContent.displayName = "DropdownMenuContent";

/* -------------------------------------------------------------------------- */
/*  Item                                                                      */
/* -------------------------------------------------------------------------- */

interface DropdownMenuItemProps extends Omit<React.HTMLAttributes<HTMLElement>, "children"> {
  asChild?: boolean;
  inset?: boolean;
  onSelect?: (event: React.MouseEvent<HTMLElement>) => void;
  disabled?: boolean;
  children: React.ReactNode;
}

const DropdownMenuItem = React.forwardRef<HTMLElement, DropdownMenuItemProps>(
  ({ asChild, inset, onSelect, onClick, disabled, className, children, ...props }, ref) => {
    const { setOpen } = useMenuContext("DropdownMenuItem");

    const baseClass = cn(
      "relative flex cursor-default select-none items-center rounded-sm px-2 py-1.5 text-xs outline-hidden transition-colors",
      "hover:bg-surface-2 hover:text-foreground",
      "text-foreground",
      "data-disabled:pointer-events-none data-disabled:opacity-50",
      inset && "pl-8",
      className,
    );

    const handleClick = React.useCallback(
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

    if (asChild && React.isValidElement(children)) {
      const child = children as React.ReactElement<Record<string, unknown>>;
      const childProps = child.props ?? {};
      // eslint-disable-next-line react-hooks/refs
      return React.cloneElement(child, {
        ...props,
        ref,
        role: "menuitem",
        tabIndex: disabled ? -1 : 0,
        "aria-disabled": disabled || undefined,
        "data-disabled": disabled || undefined,
        onClick: (event: React.MouseEvent<HTMLElement>) => {
          const existing = childProps.onClick as React.MouseEventHandler<HTMLElement> | undefined;
          existing?.(event);
          handleClick(event);
        },
        className: cn(baseClass, childProps.className as string | undefined),
      } as Record<string, unknown>);
    }

    return (
      <button
        ref={ref as React.Ref<HTMLButtonElement>}
        type="button"
        role="menuitem"
        tabIndex={disabled ? -1 : 0}
        aria-disabled={disabled || undefined}
        data-disabled={disabled || undefined}
        disabled={disabled}
        onClick={handleClick}
        className={baseClass}
        {...props}
      >
        {children}
      </button>
    );
  },
);
DropdownMenuItem.displayName = "DropdownMenuItem";

/* -------------------------------------------------------------------------- */
/*  Label / Separator                                                         */
/* -------------------------------------------------------------------------- */

interface DropdownMenuLabelProps extends React.HTMLAttributes<HTMLDivElement> {
  inset?: boolean;
}

const DropdownMenuLabel = React.forwardRef<HTMLDivElement, DropdownMenuLabelProps>(
  ({ className, inset, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-2 py-1.5 text-xs text-foreground-muted", inset && "pl-8", className)}
      {...props}
    />
  ),
);
DropdownMenuLabel.displayName = "DropdownMenuLabel";

const DropdownMenuSeparator = React.forwardRef<HTMLHRElement, React.HTMLAttributes<HTMLHRElement>>(
  ({ className, ...props }, ref) => (
    <hr
      ref={ref}
      aria-orientation="horizontal"
      className={cn("-mx-1 my-1 h-px border-0 bg-surface-2", className)}
      {...props}
    />
  ),
);
DropdownMenuSeparator.displayName = "DropdownMenuSeparator";

export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
};
