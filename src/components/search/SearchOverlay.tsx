"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DASHBOARD_ROUTES = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/dashboard/timeline", label: "Timeline" },
  { path: "/dashboard/events", label: "Events" },
  { path: "/dashboard/preferences", label: "Settings" },
  { path: "/dashboard/billing", label: "Billing" },
  { path: "/dashboard/projects", label: "Projects" },
  { path: "/dashboard/api", label: "API" },
  { path: "/dashboard/quota", label: "Quota" },
  { path: "/dashboard/runtime", label: "Runtime" },
];

function SearchOverlayInner({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const filteredRoutes = DASHBOARD_ROUTES.filter((r) =>
    query ? r.label.toLowerCase().includes(query.toLowerCase()) : false,
  );

  const results = useMemo(
    () => filteredRoutes.map((r) => ({ id: r.path, label: r.label, path: r.path })),
    [filteredRoutes],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && results[selectedIndex]) {
        window.location.href = results[selectedIndex].path;
        onClose();
      }
    },
    [results, selectedIndex, onClose],
  );

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDialogElement>) => {
      if (e.target === dialogRef.current) {
        onClose();
      }
    },
    [onClose],
  );

  return (
    <dialog
      ref={dialogRef}
      aria-label="Search pages"
      onClose={onClose}
      onClick={handleBackdropClick}
      className="mx-auto mt-24 max-w-[600px] w-[92vw] rounded-xl border border-border bg-surface-elevated shadow-lg text-left [&::backdrop]:bg-foreground/5 [&::backdrop]:backdrop-blur-sm p-0"
    >
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <Search className="h-4 w-4 text-foreground-subtle" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Search pages…"
          aria-label="Search pages"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(0);
          }}
          onKeyDown={handleKeyDown}
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-subtle outline-none"
        />
        <kbd className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-foreground-subtle">
          ESC
        </kbd>
      </div>
      {results.length > 0 && (
        <div className="max-h-80 overflow-y-auto p-2">
          {results.map((r, i) => (
            <button
              key={r.id}
              type="button"
              onClick={() => {
                window.location.href = r.path;
                onClose();
              }}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm ${
                i === selectedIndex
                  ? "bg-surface-2 text-foreground"
                  : "text-foreground-muted hover:bg-surface-2"
              }`}
            >
              <span className="text-foreground-subtle">→</span>
              {r.label}
            </button>
          ))}
        </div>
      )}
      {query && results.length === 0 && (
        <div className="p-4 text-center text-xs text-foreground-subtle">No results</div>
      )}
    </dialog>
  );
}

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <SearchOverlayInner key="search-overlay" onClose={onClose} />;
}