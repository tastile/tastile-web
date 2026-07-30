"use client";

/**
 * TileReferencePicker — scalable replacement for the bare <Select> tile picker.
 *
 * The previous implementation rendered every tile in the workspace as a DOM
 * <option>; with 500+ tiles that becomes unusable. This modal:
 *   - keeps the visible list bounded by `PAGE_SIZE` (server-side limit param)
 *   - debounces the search box so we don't hammer the daemon per keystroke
 *   - lets the user arrow-key through results and confirm with Enter / click
 *
 * Intentionally does NOT take a "value" prop — the caller owns the selected
 * id, and the picker only emits `onSelect(id)` when the user confirms. This
 * keeps it usable both as a standalone modal and as an inline replacement for
 * the destructive Mantine Select.
 */

import { Button, Modal, ScrollArea, TextInput } from "@mantine/core";
import { Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { getCoreClient } from "@/lib/api/endpoints";
import type { TileListView } from "@/lib/hooks/use-tile-list";
import { useTranslation } from "@/lib/i18n/use-translation";

export interface TileReferencePickerProps {
  opened: boolean;
  onClose: () => void;
  onSelect: (tileId: string | null) => void;
  title?: string;
  placeholder?: string;
  /** Currently selected id, surfaced as a chip so the user can re-confirm. */
  currentValue?: string | null;
  /** Optional filter to limit which tiles show (e.g. plan-bearing only). */
  filterPlanOnly?: boolean;
  /** Optional category to scope the picker (e.g. "task", "requirement"). */
  tileKindFilter?: number | number[];
}

const PAGE_SIZE = 40;
const DEBOUNCE_MS = 220;

interface SearchResponse {
  tiles: TileListView[];
  next_actionable_tile_id?: string | null;
  next_actionable_start_at?: string | null;
}

function isSearchResponse(value: unknown): value is SearchResponse {
  if (Array.isArray(value)) return true;
  return Boolean(
    value && typeof value === "object" && Array.isArray((value as { tiles?: unknown }).tiles),
  );
}

export function TileReferencePicker({
  opened,
  onClose,
  onSelect,
  title,
  placeholder,
  currentValue,
  filterPlanOnly = false,
  tileKindFilter,
}: TileReferencePickerProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [results, setResults] = useState<TileListView[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const fetchIdRef = useRef(0);

  // Derive effective values: when modal is closed, show empty state.
  const effectiveQuery = opened ? query : "";
  const effectiveError = opened ? error : null;
  const effectiveActiveIndex = opened ? activeIndex : 0;

  // Debounce keystrokes before issuing a query so we don't fetch per char.
  useEffect(() => {
    if (!opened) return;
    const handle = setTimeout(() => setDebounced(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [query, opened]);

  // Issue the actual fetch whenever the debounced value or filter changes.
  useEffect(() => {
    if (!opened) return;
    let cancelled = false;
    fetchIdRef.current += 1;
    const thisFetchId = fetchIdRef.current;
    const kindParam =
      tileKindFilter === undefined
        ? undefined
        : Array.isArray(tileKindFilter)
          ? tileKindFilter.join(",")
          : String(tileKindFilter);
    void getCoreClient()
      .call<SearchResponse | TileListView[]>("getTiles", {
        query: {
          search: debounced || undefined,
          limit: PAGE_SIZE,
          ...(kindParam !== undefined ? { kind: kindParam } : {}),
        },
      })
      .then((res) => {
        if (cancelled || thisFetchId !== fetchIdRef.current) return;
        if (!res.ok) {
          setError(res.error.message);
          setResults([]);
          return;
        }
        if (!isSearchResponse(res.data)) {
          setError("Unexpected response");
          setResults([]);
          return;
        }
        const flat = Array.isArray(res.data) ? res.data : res.data.tiles;
        const filtered = filterPlanOnly ? flat.filter((t) => t.plan_id) : flat;
        setResults(filtered);
        setActiveIndex(0);
      })
      .catch((e: unknown) => {
        if (!cancelled && thisFetchId === fetchIdRef.current) {
          setError((e as Error).message);
        }
      })
      .finally(() => {
        if (!cancelled && thisFetchId === fetchIdRef.current) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debounced, opened, filterPlanOnly, tileKindFilter]);

  // Focus the search input when the modal opens for fast keyboard use.
  useEffect(() => {
    if (!opened) return;
    const handle = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(handle);
  }, [opened]);

  const resolvedTitle = title ?? t("quickCreate.tilePickerTitle");
  const resolvedPlaceholder = placeholder ?? t("quickCreate.tilePickerPlaceholder");

  const items = useMemo(
    () =>
      (opened ? results : []).map((t, i) => ({
        id: t.id,
        title: t.title || t.id,
        sub: t.plan_id ? "plan" : "—",
        kind: t.lifecycle,
        active: i === effectiveActiveIndex,
      })),
    [results, effectiveActiveIndex, opened],
  );

  const commit = useCallback(
    (id: string | null) => {
      onSelect(id);
      onClose();
    },
    [onSelect, onClose],
  );

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, Math.max(items.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = items[effectiveActiveIndex];
      if (target) commit(target.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  }

  return (
    <Modal opened={opened} onClose={onClose} title={resolvedTitle} centered size="md" withinPortal>
      <div className="flex flex-col gap-3">
        <TextInput
          ref={inputRef}
          value={effectiveQuery}
          onChange={(e) => {
            setQuery(e.currentTarget.value);
            setLoading(true);
            setError(null);
          }}
          onKeyDown={handleKeyDown}
          placeholder={resolvedPlaceholder}
          leftSection={<Search size={14} aria-hidden="true" />}
          size="sm"
          autoComplete="off"
          data-testid="tile-picker-search"
        />
        {effectiveError && <div className="text-[11px] text-status-danger">{effectiveError}</div>}
        {currentValue && (
          <div className="text-[10px] text-foreground-muted">
            {t("quickCreate.tilePickerCurrent")}: <span className="font-mono">{currentValue}</span>
          </div>
        )}
        <ScrollArea h={320} type="auto" viewportRef={listRef}>
          {loading && items.length === 0 ? (
            <div className="py-4 text-center text-[11px] text-foreground-muted">
              {t("quickCreate.tilePickerLoading")}
            </div>
          ) : items.length === 0 ? (
            <div className="py-4 text-center text-[11px] text-foreground-muted">
              {t("quickCreate.tilePickerEmpty")}
            </div>
          ) : (
            <ul className="flex flex-col" data-testid="tile-picker-results">
              {items.map((it) => (
                <li key={it.id}>
                  <button
                    type="button"
                    onClick={() => commit(it.id)}
                    onMouseEnter={() => setActiveIndex(items.findIndex((x) => x.id === it.id))}
                    className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
                      it.active
                        ? "bg-surface-2 text-foreground"
                        : "text-foreground-subtle hover:bg-surface-1 hover:text-foreground"
                    }`}
                    data-testid={`tile-picker-item-${it.id}`}
                  >
                    <span className="min-w-0 flex-1 truncate font-medium">{it.title}</span>
                    <span className="shrink-0 rounded bg-surface-1 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-foreground-muted">
                      {it.sub}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => commit(null)}
            data-testid="tile-picker-clear"
          >
            {t("quickCreate.tilePickerClear")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={onClose}
            data-testid="tile-picker-close"
          >
            {t("quickCreate.tilePickerClose")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
