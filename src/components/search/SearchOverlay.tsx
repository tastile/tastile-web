"use client";

import { Search } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTileList } from "@/lib/hooks/use-tile-list";

const DASHBOARD_ROUTES = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/dashboard/execute", label: "Execute" },
  { path: "/dashboard/tiles", label: "Tiles" },
  { path: "/dashboard/timeline", label: "Timeline" },
  { path: "/dashboard/calendar", label: "Calendar" },
  { path: "/dashboard/history", label: "History" },
  { path: "/dashboard/events", label: "Events" },
  { path: "/dashboard/preferences", label: "Settings" },
  { path: "/dashboard/billing", label: "Billing" },
  { path: "/dashboard/integrations", label: "Integrations" },
  { path: "/dashboard/prompts", label: "Prompts" },
  { path: "/dashboard/breaks", label: "Breaks" },
  { path: "/dashboard/projects", label: "Projects" },
  { path: "/dashboard/api", label: "API" },
  { path: "/dashboard/quota", label: "Quota" },
  { path: "/dashboard/runtime", label: "Runtime" },
];

export function SearchOverlayInner({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { tiles } = useTileList({ search: query || undefined });
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredRoutes = DASHBOARD_ROUTES.filter((r) =>
    query ? r.label.toLowerCase().includes(query.toLowerCase()) : false,
  );

  const results = useMemo(
    () => [
      ...tiles.slice(0, 5).map((t) => ({
        type: "tile" as const,
        id: t.id,
        label: t.title,
        path: "/dashboard/tiles",
      })),
      ...filteredRoutes
        .slice(0, 5)
        .map((r) => ({ type: "route" as const, id: r.path, label: r.label, path: r.path })),
    ],
    [tiles, filteredRoutes],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowDown") {
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

  return (
    <button
      type="button"
      aria-label="Close search"
      className="fixed inset-0 z-[60] flex items-start justify-center pt-24 cursor-default bg-foreground/5 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search tiles and pages"
        className="relative w-[600px] rounded-xl border border-border bg-surface-elevated shadow-lg text-left"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            onClose();
          }
        }}
      >
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-foreground-subtle" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search tiles and pages…"
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
                {r.type === "tile" ? (
                  <span className="text-foreground-subtle">○</span>
                ) : (
                  <span className="text-foreground-subtle">→</span>
                )}
                {r.label}
              </button>
            ))}
          </div>
        )}
        {query && results.length === 0 && (
          <div className="p-4 text-center text-xs text-foreground-subtle">No results</div>
        )}
      </div>
    </button>
  );
}

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <SearchOverlayInner key="search-overlay" onClose={onClose} />;
}
