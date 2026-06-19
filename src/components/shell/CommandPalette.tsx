"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X, ArrowRight, Hash, FileCode2, Layers, Compass } from "lucide-react";
import { ENDPOINTS, TAG_ORDER, type EndpointKey } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils/cn";

interface PaletteItem {
  id: string;
  group: "Navigation" | "Endpoints" | "Recent";
  title: string;
  subtitle: string;
  href?: string;
  meta?: string;
  tag?: string;
  action?: () => void;
}

const NAV: PaletteItem[] = [
  { id: "nav:home", group: "Navigation", title: "Home", subtitle: "Overview & now", href: "/dashboard" },
  { id: "nav:execute", group: "Navigation", title: "Execute", subtitle: "Active phase", href: "/dashboard/execute" },
  { id: "nav:prompts", group: "Navigation", title: "Prompts", subtitle: "Pending decisions", href: "/dashboard/prompts" },
  { id: "nav:breaks", group: "Navigation", title: "Breaks", subtitle: "Rest windows", href: "/dashboard/breaks" },
  { id: "nav:tiles", group: "Navigation", title: "Tiles", subtitle: "Lifecycle list", href: "/dashboard/tiles" },
  { id: "nav:timeline", group: "Navigation", title: "Timeline", subtitle: "Today's plan", href: "/dashboard/timeline" },
  { id: "nav:calendar", group: "Navigation", title: "Calendar", subtitle: "Day / week / month / year", href: "/dashboard/calendar" },
  { id: "nav:history", group: "Navigation", title: "History", subtitle: "Completed events", href: "/dashboard/history" },
  { id: "nav:runtime", group: "Navigation", title: "Runtime", subtitle: "Health, version, paths", href: "/dashboard/runtime" },
  { id: "nav:events", group: "Navigation", title: "Events log", subtitle: "Append-only stream", href: "/dashboard/events" },
  { id: "nav:api", group: "Navigation", title: "API explorer", subtitle: "All 45 endpoints", href: "/dashboard/api" },
  { id: "nav:quota", group: "Navigation", title: "Quota", subtitle: "Plan limits", href: "/dashboard/quota" },
  { id: "nav:settings", group: "Navigation", title: "Settings", subtitle: "Preferences", href: "/dashboard/settings" },
  { id: "nav:account", group: "Navigation", title: "Account", subtitle: "Profile & security", href: "/dashboard/account" },
];

function buildEndpointItems(): PaletteItem[] {
  return (Object.keys(ENDPOINTS) as EndpointKey[]).map((key) => {
    const meta = ENDPOINTS[key];
    return {
      id: `api:${key}`,
      group: "Endpoints",
      title: meta.summary,
      subtitle: `${meta.method} ${meta.path}`,
      href: `/dashboard/api?focus=${key}`,
      tag: meta.tag,
    };
  });
}

const RECENT_KEY = "tastile-recent";

export function CommandPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const [recent, setRecent] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
    } catch {
      return [];
    }
  });
  const inputRef = useRef<HTMLInputElement>(null);

  function openPalette() {
    setQuery("");
    setActiveIndex(0);
    setOpen(true);
    window.setTimeout(() => inputRef.current?.focus(), 16);
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const isMod = e.metaKey || e.ctrlKey;
      if (isMod && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (open) {
          setOpen(false);
        } else {
          openPalette();
        }
      } else if (e.key === "Escape" && open) {
        setOpen(false);
      }
    }
    function onCustom() {
      openPalette();
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("tastile:open-command", onCustom);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("tastile:open-command", onCustom);
    };
  }, [open]);

  const items = useMemo(() => {
    const endpointItems = buildEndpointItems();
    const recentItems: PaletteItem[] = recent
      .map((id) => {
        if (id.startsWith("api:")) {
          const k = id.slice(4) as EndpointKey;
          const m = ENDPOINTS[k];
          if (!m) return null;
          return {
            id,
            group: "Recent" as const,
            title: m.summary,
            subtitle: `${m.method} ${m.path}`,
            href: `/dashboard/api?focus=${k}`,
            tag: m.tag,
          } satisfies PaletteItem;
        }
        return NAV.find((n) => n.id === id) ?? null;
      })
      .filter((x): x is PaletteItem => x !== null);
    const all = [...recentItems, ...NAV, ...endpointItems];
    if (!query.trim()) return all.slice(0, 30);
    const q = query.toLowerCase();
    return all
      .filter((it) => {
        return (
          it.title.toLowerCase().includes(q) ||
          it.subtitle.toLowerCase().includes(q) ||
          (it.tag?.toLowerCase().includes(q) ?? false)
        );
      })
      .slice(0, 50);
  }, [query, recent]);

  function commit(item: PaletteItem) {
    setOpen(false);
    const newRecent = [item.id, ...recent.filter((id) => id !== item.id)].slice(0, 8);
    setRecent(newRecent);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(newRecent));
    if (item.href) router.push(item.href);
    else if (item.action) item.action();
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const item = items[activeIndex];
      if (item) commit(item);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--z-command)] flex items-start justify-center pt-[10vh]" role="dialog" aria-modal>
      <div
        className="absolute inset-0 bg-surface-overlay backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div className="relative z-10 w-[min(720px,92vw)] overflow-hidden rounded-xl border border-border bg-surface-1 shadow-[var(--shadow-lg)]">
        <div className="flex items-center gap-2 border-b border-border px-3">
          <Search className="h-4 w-4 text-ink-3" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Type a command, page, or endpoint…"
            className="h-12 flex-1 bg-transparent text-sm text-ink-1 outline-none placeholder:text-ink-4"
          />
          <kbd className="rounded border border-border bg-surface-0 px-1.5 py-0.5 text-[10px] font-medium text-ink-3">
            ESC
          </kbd>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="ml-1 grid h-6 w-6 place-items-center rounded text-ink-3 hover:bg-surface-2 hover:text-ink-1"
            aria-label="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <div className="px-3 py-8 text-center text-sm text-ink-4">No results</div>
          ) : (
            <GroupedList
              items={items}
              activeIndex={activeIndex}
              onSelect={commit}
              onHover={setActiveIndex}
            />
          )}
        </div>
        <div className="flex items-center justify-between border-t border-border bg-surface-0 px-3 py-2 text-[10px] text-ink-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-surface-1 px-1">↑</kbd>
              <kbd className="rounded border border-border bg-surface-1 px-1">↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-surface-1 px-1">↵</kbd>
              open
            </span>
          </div>
          <div className="flex items-center gap-1">
            {TAG_ORDER.slice(0, 4).map((t) => (
              <span
                key={t}
                className="rounded border border-border bg-surface-1 px-1.5 py-0.5 font-mono uppercase tracking-wider"
              >
                {t}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function GroupedList({
  items,
  activeIndex,
  onSelect,
  onHover,
}: {
  items: PaletteItem[];
  activeIndex: number;
  onSelect: (it: PaletteItem) => void;
  onHover: (i: number) => void;
}) {
  let cursor = -1;
  const groups: Record<string, { start: number; rows: Array<{ item: PaletteItem; index: number }> }> = {};
  for (const it of items) {
    cursor += 1;
    if (!groups[it.group]) groups[it.group] = { start: cursor, rows: [] };
    groups[it.group].rows.push({ item: it, index: cursor });
  }
  return (
    <div className="flex flex-col">
      {Object.entries(groups).map(([g, { rows }]) => (
        <div key={g} className="py-1">
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-ink-4">
            {g}
          </div>
          <ul>
            {rows.map(({ item, index }) => {
              const active = index === activeIndex;
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    onMouseEnter={() => onHover(index)}
                    onClick={() => onSelect(item)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors",
                      active ? "bg-surface-2 text-ink-1" : "text-ink-2 hover:bg-surface-2",
                    )}
                  >
                    <ItemIcon group={item.group} tag={item.tag} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{item.title}</span>
                      <span className="block truncate font-mono text-[11px] text-ink-3">
                        {item.subtitle}
                      </span>
                    </span>
                    {item.tag ? (
                      <span className="rounded border border-border bg-surface-0 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-ink-3">
                        {item.tag}
                      </span>
                    ) : null}
                    <ArrowRight
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        active ? "text-accent opacity-100" : "text-ink-4 opacity-0",
                      )}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </div>
  );
}

function ItemIcon({ group, tag }: { group: string; tag?: string }) {
  if (group === "Endpoints") return <FileCode2 className="h-3.5 w-3.5 text-ink-3" />;
  if (group === "Recent") return <Hash className="h-3.5 w-3.5 text-ink-3" />;
  if (group === "Navigation") {
    if (tag === "Read" || tag === "Views") return <Compass className="h-3.5 w-3.5 text-ink-3" />;
    return <Layers className="h-3.5 w-3.5 text-ink-3" />;
  }
  return <Layers className="h-3.5 w-3.5 text-ink-3" />;
}
