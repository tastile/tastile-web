"use client";

import { type Workspace, useWorkspaces } from "@/shared/hooks/use-workspaces";
import { useTranslation } from "@/shared/i18n/use-translation";
import { cn } from "@/shared/lib/cn";
import type { RenderTreeNodePayload, TreeNodeData } from "@mantine/core";
import {
  ActionIcon,
  Button,
  Checkbox,
  SegmentedControl,
  Tree,
  getTreeExpandedState,
  useTree,
} from "@mantine/core";
import { CalendarClock, ChevronRight, Folder, RefreshCw } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useTransition } from "react";

const SEGMENT_STYLES = {
  root: { backgroundColor: "var(--surface-2)" },
  indicator: { backgroundColor: "var(--surface-1)" },
  label: { color: "var(--foreground)" },
} as const;

const SCHEDULE_VIEW_IDS = ["recurring", "upcoming"] as const;

export function ScheduleSidePanel() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();
  const { t } = useTranslation();

  const currentView = searchParams.get("view") ?? "recurring";

  function handleSelect(id: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", id);

    startTransition(() => {
      router.replace(`${pathname}?${params.toString()}`);
    });
  }

  const scheduleViews = [
    {
      id: "recurring",
      label: t("panels.schedule.views.recurring"),
      icon: RefreshCw,
    },
    {
      id: "upcoming",
      label: t("panels.schedule.views.upcoming"),
      icon: CalendarClock,
    },
  ] as const;

  return (
    <div className="flex flex-col gap-6 pt-2 select-none">
      <div className="px-4 pb-1 pt-2">
        <span className="text-caption font-semibold uppercase tracking-wider text-foreground-subtle">
          {t("panels.schedule.scheduleViews")}
        </span>
      </div>

      <div className="px-2">
        <SegmentedControl
          fullWidth
          size="xs"
          radius="md"
          withItemsBorders={false}
          value={currentView}
          onChange={(next) => handleSelect(next)}
          data={scheduleViews.map((v) => ({
            value: v.id,
            label: (
              <span className="inline-flex items-center gap-1.5">
                <v.icon size={12} aria-hidden />
                {v.label}
              </span>
            ),
          }))}
          styles={SEGMENT_STYLES}
          data-testid="schedule-view-tabs"
        />
      </div>

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
  const { workspaces, loading } = useWorkspaces();
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="px-3 text-caption text-foreground-subtle">
        {t("panels.schedule.loadingProjects")}
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
              aria-label={expanded ? t("shell.activityBar.expanded") : t("shell.activityBar.collapsed")}
              onClick={() => tree.toggleExpanded(node.value)}
              className="flex size-4 shrink-0 items-center justify-center text-foreground-lighter hover:text-foreground"
            >
              <ChevronRight
                size={12}
                aria-hidden
                className={cn("transition-transform", expanded && "rotate-90")}
              />
            </ActionIcon>
          ) : (
            <span aria-hidden className="size-4 shrink-0" />
          )}
          <Checkbox.Indicator
            checked={checked}
            indeterminate={indeterminate}
            size="xs"
            color={color}
            onClick={() => toggleCascade(node.value)}
            data-testid={`schedule-project-${node.value}`}
            style={{ cursor: "pointer" }}
          />
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full"
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
    <div className="px-3 pt-4">
      <div className="mb-3 flex items-center gap-1.5">
        <Folder size={12} aria-hidden className="text-foreground-subtle" />
        <p className="text-caption font-bold uppercase tracking-wider text-foreground-lighter">
          {t("panels.schedule.projects")}
        </p>
        <span className="ml-auto font-mono text-caption text-foreground-lighter">
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
