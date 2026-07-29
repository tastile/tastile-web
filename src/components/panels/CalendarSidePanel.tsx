"use client";

import type { DisplayMode } from "@/lib/calendar/layout";
import { type Workspace, useProjects } from "@/lib/hooks/use-projects";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";
import type { RenderTreeNodePayload, TreeNodeData } from "@mantine/core";
import {
  ActionIcon,
  Button,
  Checkbox,
  Select,
  Tree,
  getTreeExpandedState,
  useTree,
} from "@mantine/core";
import { DatePicker } from "@mantine/dates";
import { ChevronRight, Clock, Filter } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

type CalendarSidePanelView = "day" | "week" | "month" | "year" | "list";

// ─────────────────────────────────────────────
// Calendar Side Panel
// ─────────────────────────────────────────────
interface CalendarSidePanelProps {
  /** Currently selected date (YYYY-MM-DD) */
  anchor: string;
  /** Current view — used to determine the highlight range. */
  view?: CalendarSidePanelView;
  /** Timeline display mode — used to adjust the highlight range. */
  mode?: DisplayMode;
  minDuration?: number;
  /** Called when the user picks a date. */
  onSelectDate?: (date: string) => void;
  onModeChange?: (mode: DisplayMode) => void;
  onMinDurationChange?: (minutes: number) => void;
}

// Given anchor (YYYY-MM-DD) and view, return the list of dates to shade on
// the mini calendar. Day / List views only need the single selected date;
// the Year view has too many days to highlight.
//
// DisplayMode (around / future) makes the range extend past the boundaries,
// but the mini calendar only operates in day-resolution, so:
//   around → today only (current position indicator)
//   future → today through the last day of the range
//   scope  → existing per-view scope shading
function _getHighlightDates(
  view: CalendarSidePanelView | undefined,
  mode: DisplayMode | undefined,
  anchor: string,
): string[] | undefined {
  if (!view) return undefined;
  if (view === "year") return undefined;
  if (mode === "around") {
    // Range straddles boundaries; just mark "today" so the user can
    // visually anchor on it.
    return [anchor];
  }
  if (mode === "future") {
    // From now until end of forward-scope range.
    const d = new Date(`${anchor}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return undefined;
    const dayMs = 24 * 60 * 60 * 1000;
    const out: string[] = [anchor];
    const days = view === "week" ? 7 : view === "month" ? 31 : 1;
    for (let i = 1; i < days; i++) {
      out.push(new Date(d.getTime() + i * dayMs).toISOString().slice(0, 10));
    }
    return out;
  }
  // mode === "scope" — existing per-view behavior.
  if (view === "day" || view === "list") return undefined;
  const d = new Date(`${anchor}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return undefined;
  if (view === "week") {
    const start = new Date(d);
    start.setUTCDate(start.getUTCDate() - start.getUTCDay()); // Sun = 0
    return Array.from({ length: 7 }, (_, i) => {
      const x = new Date(start);
      x.setUTCDate(start.getUTCDate() + i);
      return x.toISOString().slice(0, 10);
    });
  }
  // view === "month"
  const _start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  const end = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  const out: string[] = [];
  for (let day = 1; day <= end.getUTCDate(); day++) {
    out.push(
      new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), day)).toISOString().slice(0, 10),
    );
  }
  return out;
}

export function CalendarSidePanel({
  anchor,
  view: _view,
  mode,
  minDuration = 0,
  onSelectDate,
  onModeChange,
  onMinDurationChange,
}: CalendarSidePanelProps) {
  // Around / future modes always anchor to today; the mini calendar
  // is read-only so the user can't pick a date the main view will
  // ignore anyway.
  const _locked = mode === "around" || mode === "future";

  return (
    <div className="flex flex-col gap-4 pt-2 overflow-hidden">
      {/* Mini calendar */}
      <div className="px-3">
        <DatePicker
          aria-label="Select date"
          value={anchor}
          onChange={(value) => {
            if (value) onSelectDate?.(value);
          }}
          size="xs"
        />
      </div>

      <div className="mx-3 h-px bg-border" />

      <section className="space-y-3 px-3">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground-lighter">
            <Clock className="h-3 w-3" aria-hidden />
            <span>Time range</span>
          </div>
          <Select
            aria-label="Time range"
            value={mode ?? "scope"}
            onChange={(value) => value && onModeChange?.(value as DisplayMode)}
            data={[
              { value: "scope", label: "Selected date" },
              { value: "around", label: "Around now" },
              { value: "future", label: "From now" },
            ]}
            size="xs"
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
            data-testid="panel-time-range"
          />
        </div>
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-foreground-lighter">
            <Filter className="h-3 w-3" aria-hidden />
            <span>Min duration</span>
          </div>
          <Select
            aria-label="Min duration"
            value={String(minDuration)}
            onChange={(value) => value && onMinDurationChange?.(Number(value))}
            data={[
              { value: "0", label: "Show all (including 5 min breaks)" },
              { value: "5", label: "5 minutes+" },
              { value: "15", label: "15 minutes+" },
              { value: "30", label: "30 minutes+" },
            ]}
            size="xs"
            allowDeselect={false}
            comboboxProps={{ withinPortal: true }}
            data-testid="panel-min-duration"
          />
        </div>
      </section>

      <div className="mx-3 h-px bg-border" />

      {/* Projects checkbox section */}
      <ProjectsCheckboxSection />
    </div>
  );
}

// ─────────────────────────────────────────────
// Projects tree section — Mantine Tree over the workspace hierarchy.
// State lives in the URL (?projects=u1,u2,...). Empty/unset means "all".
// Checking a node cascades to its whole subtree; the URL is the single
// source of truth so checked/indeterminate are derived, not stored.
// ─────────────────────────────────────────────

/** Nested TreeNodeData built from the flat workspace list via parent links. */
function buildProjectTree(workspaces: Workspace[]): TreeNodeData[] {
  const byParent = new Map<string | null, Workspace[]>();
  const ids = new Set(workspaces.map((w) => w.id));
  for (const w of workspaces) {
    const parent = w.parent_subject_id && ids.has(w.parent_subject_id) ? w.parent_subject_id : null;
    const arr = byParent.get(parent) ?? [];
    arr.push(w);
    byParent.set(parent, arr);
  }
  for (const arr of byParent.values()) {
    arr.sort((a, b) => a.display_name.localeCompare(b.display_name, "ja"));
  }
  const build = (parent: string | null): TreeNodeData[] =>
    (byParent.get(parent) ?? []).map((w) => ({
      value: w.id,
      label: w.display_name,
      children: build(w.id),
    }));
  return build(null);
}

/** id → [id, ...all descendant ids], for cascade toggling and tri-state. */
function buildDescendantMap(workspaces: Workspace[]): Map<string, string[]> {
  const childrenOf = new Map<string, string[]>();
  const ids = new Set(workspaces.map((w) => w.id));
  for (const w of workspaces) {
    const parent = w.parent_subject_id && ids.has(w.parent_subject_id) ? w.parent_subject_id : null;
    if (parent === null) continue;
    const arr = childrenOf.get(parent) ?? [];
    arr.push(w.id);
    childrenOf.set(parent, arr);
  }
  const map = new Map<string, string[]>();
  const collect = (id: string): string[] => {
    const cached = map.get(id);
    if (cached) return cached;
    const acc = [id];
    for (const child of childrenOf.get(id) ?? []) acc.push(...collect(child));
    map.set(id, acc);
    return acc;
  };
  for (const w of workspaces) collect(w.id);
  return map;
}

function ProjectsCheckboxSection() {
  const { workspaces, loading } = useProjects();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="px-3 text-[10px] text-foreground-subtle">
        {t("panels.calendar.loadingProjects")}
      </div>
    );
  }
  if (workspaces.length === 0) return null;

  return <ProjectsTree workspaces={workspaces} />;
}

// Inner component so useTree() sees the loaded workspace data at mount
// (getTreeExpandedState needs the full tree to expand everything up front).
function ProjectsTree({ workspaces }: { workspaces: Workspace[] }) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const { t } = useTranslation();

  const treeData = useMemo(() => buildProjectTree(workspaces), [workspaces]);
  const descendantMap = useMemo(() => buildDescendantMap(workspaces), [workspaces]);
  const colorById = useMemo(
    () => new Map(workspaces.map((w) => [w.id, w.color] as const)),
    [workspaces],
  );
  const allIds = useMemo(() => workspaces.map((w) => w.id), [workspaces]);
  const selected = useMemo(() => {
    const raw = searchParams.get("projects");
    if (!raw) return new Set(allIds);
    return new Set(raw.split(",").filter(Boolean));
  }, [searchParams, allIds]);

  const tree = useTree({ initialExpandedState: getTreeExpandedState(treeData, "*") });

  const commit = useCallback(
    (next: Set<string>) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next.size === allIds.length) params.delete("projects");
      else params.set("projects", [...next].join(","));
      startTransition(() => {
        router.replace(`${pathname}?${params.toString()}`);
      });
    },
    [searchParams, router, pathname, allIds],
  );

  const toggleCascade = useCallback(
    (id: string) => {
      const family = descendantMap.get(id) ?? [id];
      const fullyChecked = family.every((x) => selected.has(x));
      const next = new Set(selected);
      if (fullyChecked) for (const x of family) next.delete(x);
      else for (const x of family) next.add(x);
      commit(next);
    },
    [selected, descendantMap, commit],
  );

  const renderNode = useCallback(
    ({ node, expanded, hasChildren, elementProps }: RenderTreeNodePayload) => {
      const family = descendantMap.get(node.value) ?? [node.value];
      const selCount = family.reduce((n, x) => (selected.has(x) ? n + 1 : n), 0);
      const checked = selCount === family.length;
      const indeterminate = selCount > 0 && selCount < family.length;
      const color = colorById.get(node.value) ?? undefined;
      return (
        <div {...elementProps} className="flex items-center gap-2 py-0.5">
          {hasChildren ? (
            <ActionIcon
              variant="subtle"
              size="sm"
              type="button"
              aria-label={expanded ? "Collapse" : "Expand"}
              onClick={() => tree.toggleExpanded(node.value)}
              className="flex h-4 w-4 shrink-0 items-center justify-center text-foreground-lighter hover:text-foreground"
            >
              <ChevronRight
                size={12}
                aria-hidden
                className={cn("transition-transform", expanded && "rotate-90")}
              />
            </ActionIcon>
          ) : (
            <span aria-hidden className="h-4 w-4 shrink-0" />
          )}
          <Checkbox.Indicator
            checked={checked}
            indeterminate={indeterminate}
            size="xs"
            color={color}
            onClick={() => toggleCascade(node.value)}
            data-testid={`panel-project-${node.value}`}
            style={{ cursor: "pointer" }}
          />
          <span
            aria-hidden
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: color ?? "#6b7280" }}
          />
          <Button
            type="button"
            onClick={() => toggleCascade(node.value)}
            className="min-w-0 flex-1 truncate text-left text-xs text-foreground-subtle hover:text-foreground"
          >
            {node.label}
          </Button>
        </div>
      );
    },
    [tree, descendantMap, colorById, selected, toggleCascade],
  );

  return (
    <div className="border-t border-border/40 px-3 pt-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wider text-foreground-lighter">
          {t("panels.calendar.projects")}
        </p>
        <span className="font-mono text-[10px] text-foreground-lighter">
          {selected.size}/{workspaces.length}
        </span>
      </div>
      <Tree
        data={treeData}
        tree={tree}
        levelOffset={20}
        expandOnClick={false}
        renderNode={renderNode}
      />
    </div>
  );
}
