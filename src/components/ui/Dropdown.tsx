"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";
import { cn } from "@/lib/utils/cn";

const dropdownVariants = cva(
  [
    "relative flex w-full items-center rounded-md border bg-surface-1",
    "cursor-pointer select-none",
    "transition-all duration-150",
    "focus-within:border-primary focus-within:ring-1 focus-within:ring-primary",
    "disabled:cursor-not-allowed disabled:opacity-50",
  ].join(" "),
  {
    variants: {
      size: {
        tiny: "h-6 px-2 text-xs gap-1.5",
        small: "h-8 px-2.5 text-xs gap-2",
        medium: "h-9 px-3 text-sm gap-2",
        large: "h-10 px-3 text-sm gap-2.5",
      },
      invalid: {
        true: "border-danger focus-within:ring-danger",
      },
      isOpen: {
        true: "border-primary ring-1 ring-primary",
      },
    },
    defaultVariants: {
      size: "small",
    },
  },
);

export interface DropdownItem {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  group?: string;
}

export interface DropdownProps extends VariantProps<typeof dropdownVariants> {
  items: DropdownItem[];
  value?: string | null;
  defaultValue?: string | null;
  placeholder?: string;
  onChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  disabled?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  className?: string;
  triggerClassName?: string;
  contentClassName?: string;
  renderItem?: (item: DropdownItem, selected: boolean) => React.ReactNode;
  renderTrigger?: (selectedItem: DropdownItem | null, isOpen: boolean) => React.ReactNode;
  name?: string;
  "aria-label"?: string;
}

export function Dropdown({
  items,
  value,
  defaultValue = null,
  placeholder = "Select...",
  size = "small",
  invalid,
  disabled = false,
  searchable = false,
  searchPlaceholder = "Search...",
  onChange,
  onOpenChange,
  className,
  triggerClassName,
  contentClassName,
  renderItem,
  renderTrigger,
  name,
  "aria-label": ariaLabel,
}: DropdownProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [internalValue, setInternalValue] = React.useState<string | null>(defaultValue);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [highlightedIndex, setHighlightedIndex] = React.useState(-1);

  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const contentRef = React.useRef<HTMLDivElement>(null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : internalValue;
  const selectedItem = items.find((item) => item.value === currentValue) ?? null;

  const filteredItems = React.useMemo(() => {
    if (!searchQuery) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(
      (item) =>
        item.label.toLowerCase().includes(query) || item.value.toLowerCase().includes(query),
    );
  }, [items, searchQuery]);

  const groupedItems = React.useMemo(() => {
    const groups: { group: string; items: DropdownItem[] }[] = [];
    let currentGroup: string | null = null;

    for (const item of filteredItems) {
      const group = item.group ?? "";
      if (group !== currentGroup) {
        groups.push({ group, items: [] });
        currentGroup = group;
      }
      groups[groups.length - 1].items.push(item);
    }

    return groups;
  }, [filteredItems]);

  const flatFilteredItems = React.useMemo(() => filteredItems, [filteredItems]);

  const handleChange = React.useCallback(
    (newValue: string) => {
      if (!isControlled) {
        setInternalValue(newValue);
      }
      onChange?.(newValue);
      setIsOpen(false);
      setSearchQuery("");
      setHighlightedIndex(-1);
      triggerRef.current?.focus();
    },
    [isControlled, onChange],
  );

  const toggleOpen = React.useCallback(() => {
    if (disabled) return;
    const nextOpen = !isOpen;
    setIsOpen(nextOpen);
    onOpenChange?.(nextOpen);
    if (nextOpen) {
      setSearchQuery("");
      setHighlightedIndex(
        selectedItem ? flatFilteredItems.findIndex((i) => i.value === selectedItem.value) : -1,
      );
      setTimeout(() => searchInputRef.current?.focus(), 0);
    }
  }, [disabled, isOpen, onOpenChange, selectedItem, flatFilteredItems]);

  const close = React.useCallback(() => {
    setIsOpen(false);
    onOpenChange?.(false);
    setSearchQuery("");
    setHighlightedIndex(-1);
    triggerRef.current?.focus();
  }, [onOpenChange]);

  React.useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e: PointerEvent) {
      if (
        contentRef.current &&
        !contentRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        close();
      }
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    }

    document.addEventListener("pointerdown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, close]);

  const scrollHighlightedIntoView = React.useCallback((index: number) => {
    const list = listRef.current;
    if (!list) return;
    const item = list.children[index] as HTMLElement | undefined;
    if (!item) return;
    const listRect = list.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    if (itemRect.bottom > listRect.bottom) {
      item.scrollIntoView({ block: "nearest" });
    } else if (itemRect.top < listRect.top) {
      item.scrollIntoView({ block: "nearest" });
    }
  }, []);

  const handleTriggerKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (disabled) return;

      switch (e.key) {
        case "Enter":
        case " ":
        case "ArrowDown":
          e.preventDefault();
          if (!isOpen) {
            toggleOpen();
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          if (!isOpen) {
            toggleOpen();
          }
          break;
      }
    },
    [disabled, isOpen, toggleOpen],
  );

  const handleListKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setHighlightedIndex((prev) => {
            const next = Math.min(prev + 1, flatFilteredItems.length - 1);
            scrollHighlightedIntoView(next);
            return next;
          });
          break;
        case "ArrowUp":
          e.preventDefault();
          setHighlightedIndex((prev) => {
            const next = Math.max(prev - 1, 0);
            scrollHighlightedIntoView(next);
            return next;
          });
          break;
        case "Enter":
        case " ":
          e.preventDefault();
          if (highlightedIndex >= 0 && highlightedIndex < flatFilteredItems.length) {
            const item = flatFilteredItems[highlightedIndex];
            if (!item.disabled) {
              handleChange(item.value);
            }
          }
          break;
        case "Home":
          e.preventDefault();
          setHighlightedIndex(0);
          scrollHighlightedIntoView(0);
          break;
        case "End":
          e.preventDefault();
          setHighlightedIndex(flatFilteredItems.length - 1);
          scrollHighlightedIntoView(flatFilteredItems.length - 1);
          break;
      }
    },
    [highlightedIndex, flatFilteredItems, handleChange, scrollHighlightedIntoView],
  );

  const selectId = React.useId();
  const listboxId = `${selectId}-listbox`;
  const [triggerRect, setTriggerRect] = React.useState<DOMRect | null>(null);

  React.useEffect(() => {
    if (isOpen && triggerRef.current) {
      setTriggerRect(triggerRef.current.getBoundingClientRect());
    }
  }, [isOpen]);

  return (
    <div className={cn("relative", className)}>
      <input type="hidden" name={name} value={currentValue ?? ""} />

      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={toggleOpen}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          dropdownVariants({ size, invalid, isOpen }),
          "focus:outline-none",
          triggerClassName,
        )}
      >
        {renderTrigger ? (
          renderTrigger(selectedItem, isOpen)
        ) : (
          <>
            {selectedItem?.icon && (
              <span className="shrink-0 text-foreground-muted" aria-hidden>
                {selectedItem.icon}
              </span>
            )}
            <span
              className={cn(
                "flex-1 truncate text-left",
                selectedItem ? "text-foreground" : "text-foreground-muted",
              )}
            >
              {selectedItem?.label ?? placeholder}
            </span>
            <ChevronIcon
              className={cn(
                "shrink-0 text-foreground-muted transition-transform duration-150",
                isOpen && "rotate-180",
              )}
            />
          </>
        )}
      </button>

      {isOpen && triggerRect && (
        <div
          ref={contentRef}
          className={cn(
            "fixed z-50 min-w-[160px] overflow-hidden rounded-lg",
            "border border-border-strong/50 bg-surface-elevated shadow-lg",
            "animate-in fade-in-0 zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
            contentClassName,
          )}
          style={{
            top: `${triggerRect.bottom + 4}px`,
            left: `${triggerRect.left}px`,
            width: `${triggerRect.width}px`,
          }}
          data-state={isOpen ? "open" : "closed"}
        >
          {searchable && (
            <div className="border-b border-border px-2 py-1.5">
              <div className="relative">
                <SearchIcon className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-foreground-muted" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setHighlightedIndex(-1);
                  }}
                  onKeyDown={handleListKeyDown}
                  placeholder={searchPlaceholder}
                  className={cn(
                    "w-full rounded-md border border-border bg-surface-1 py-1.5 pl-7 pr-2",
                    "text-xs text-foreground placeholder:text-foreground-muted",
                    "focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary",
                  )}
                />
              </div>
            </div>
          )}

          <div
            ref={listRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            tabIndex={-1}
            onKeyDown={handleListKeyDown}
            className="max-h-60 overflow-y-auto py-1"
          >
            {flatFilteredItems.length === 0 ? (
              <div className="px-3 py-2 text-xs text-foreground-muted">No results found</div>
            ) : (
              groupedItems.map((group) => (
                <React.Fragment key={group.group || "__default"}>
                  {group.group && (
                    <div className="px-2 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-foreground-muted">
                      {group.group}
                    </div>
                  )}
                  {group.items.map((item) => {
                    const globalIndex = flatFilteredItems.indexOf(item);
                    const isSelected = item.value === currentValue;
                    const isHighlighted = globalIndex === highlightedIndex;

                    return (
                      <div
                        key={item.value}
                        role="option"
                        aria-selected={isSelected}
                        aria-disabled={item.disabled}
                        data-highlighted={isHighlighted || undefined}
                        tabIndex={-1}
                        onClick={() => {
                          if (!item.disabled) {
                            handleChange(item.value);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (item.disabled) return;
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            handleChange(item.value);
                          }
                        }}
                        onMouseEnter={() => setHighlightedIndex(globalIndex)}
                        className={cn(
                          "flex cursor-pointer items-center gap-2 px-2 py-1.5 text-xs",
                          "transition-colors duration-75",
                          item.disabled
                            ? "cursor-not-allowed opacity-50"
                            : isHighlighted
                              ? "bg-surface-2 text-foreground"
                              : "text-foreground hover:bg-surface-2",
                          isSelected && "font-medium",
                        )}
                      >
                        {renderItem ? (
                          renderItem(item, isSelected)
                        ) : (
                          <>
                            {item.icon && (
                              <span className="shrink-0 text-foreground-muted" aria-hidden>
                                {item.icon}
                              </span>
                            )}
                            <span className="flex-1 truncate">{item.label}</span>
                            {isSelected && <CheckIcon className="shrink-0 text-primary" />}
                          </>
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <title>Chevron</title>
      <path
        d="M3 4.5L6 7.5L9 4.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <title>Check</title>
      <path
        d="M2.5 6L5 8.5L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <title>Search</title>
      <path
        d="M6.25 10.5C8.5972 10.5 10.5 8.5972 10.5 6.25C10.5 3.9028 8.5972 2 6.25 2C3.9028 2 2 3.9028 2 6.25C2 8.5972 3.9028 10.5 6.25 10.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10.5 10.5L12.25 12.25"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
