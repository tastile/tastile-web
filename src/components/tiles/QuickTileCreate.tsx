/**
 * QuickTileCreate — v1 structure editor.
 *
 * Single panel with seven sections, each 1:1 with a v1 spec chapter:
 *   §1 Identity   — Tile.Base (title, description, kind, visual, externalId)
 *   §2 Plan       — Plan.role, completion, references, planning, metrics, decisions
 *   §3 Time       — Span, DurationRange
 *   §4 Windows    — Window[] editor (kind + bounds + referenceId; Phase A scope per HARNESS.md)
 *   §5 Recurring  — life + FrameRule editor (kind picker + per-kind fields); only when kind = RECURRING
 *   §6 Advanced   — changeSets[], rules[] (ChangeSet layer; stub until Phase D)
 *   §7 Meta       — project, tags, memo
 *
 * All field state lives in `useQuickCreateStore`. The submit flow
 * (`@/lib/api/v1/submit`) reads the store directly and posts the v1
 * envelope sequence — there is no v7-shaped intermediate form state.
 *
 * Phase scope per HARNESS.md "Phase A: Core":
 *   Phase A (live): Tile.Base (Visual + Description) / Plan.role / Span /
 *     DurationRange / Window / Recurring.life / FrameRule kind picker
 *   Phase B (stub): Condition tree editor (completion.root, timeRequirements, tasks)
 *   Phase C (stub): Metrics / Flows / Candidates / ChangeSet conflicts
 *   Phase D (stub): DecisionRun / Session / InteractionTree / Delivery
 */

"use client";

import {
  ActionIcon,
  Button,
  CloseButton,
  Group,
  Menu,
  NumberInput,
  Paper,
  SegmentedControl,
  SimpleGrid,
  Select,
  Stack,
  TagsInput,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { TimeInput } from "@mantine/dates";
import {
  Bell,
  Calendar,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Clock,
  Coffee,
  FileText,
  Flame,
  FolderOpen,
  Heart,
  Inbox,
  Info,
  Layers,
  Link2,
  ListChecks,
  MessageSquare,
  MoreHorizontal,
  Palette,
  Pencil,
  Play,
  Plus,
  Repeat,
  Settings2,
  SlidersHorizontal,
  Star,
  Tag,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { AutomationPanel } from "@/components/tiles/editor/AutomationPanel";
import { ConditionEditor, defaultTerm } from "@/components/tiles/editor/ConditionEditor";
import { SEGMENT_STYLES } from "@/components/tiles/editor/panel-styles";
import { SchedulePanel } from "@/components/tiles/editor/SchedulePanel";
import { SubPanelHeader } from "@/components/tiles/editor/SubPanelHeader";
import { FormPanel, FormRow, RowSegmented, SectionHeader } from "@/components/ui/form";
import { Textarea } from "@/components/ui/Input";
import { makeClient, submitCreateTile } from "@/lib/api/v1/submit";
import { closePlacementCommand } from "@/lib/api/v1/tile-commands";
import type { ConditionNode, Term } from "@/lib/domain/v1/condition";
import {
  ConditionKind,
  HolidayKind,
  PlanRole,
  type PlanRoleValue,
  TileKind,
  type TileKindValue,
} from "@/lib/domain/v1/constants";
import { uuidv7 } from "@/lib/domain/v1/envelope";
import type { Window } from "@/lib/domain/v1/window";
import { notifyEventsChanged } from "@/lib/hooks/calendar/use-events";
import { useCurrentActorSubjectId } from "@/lib/hooks/use-current-actor";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { useProjects } from "@/lib/hooks/use-projects";
import { useTileList } from "@/lib/hooks/use-tile-list";
import { useTranslation } from "@/lib/i18n/use-translation";
import { translations } from "@/lib/i18n/translations";
import type { Locale } from "@/lib/stores/locale-store";
import { type RepeatChoice, useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { cn } from "@/lib/utils/cn";

// Bit 0 = Sunday … bit 6 = Saturday (matches WindowEditor.weekdayMask convention).
// Locale-specific weekday labels live in translations.ts. Placeholder locales
// fall back to the English list (Intl.DateTimeFormat drives richer output for
// ja via the active Intl context, but the masked-chip display here is just a
// short abbreviation).
type LocaleTree = { weekdays: readonly string[] };
const jaTree = translations.ja as unknown as LocaleTree;
const enTree = translations.en as unknown as LocaleTree;
function weekdayLabelsFor(locale: Locale): readonly string[] {
  if (locale === "ja") return jaTree.weekdays;
  return enTree.weekdays;
}

const REPEAT_MODE_LABEL_KEY: Record<RepeatChoice, string> = {
  once: "quickCreate.repeatOnce",
  daily: "quickCreate.repeatDaily",
  weekly: "quickCreate.repeatWeekly",
  interval: "quickCreate.repeatInterval",
  condition: "quickCreate.repeatCondition",
};

const INTENT_ITEMS = [
  { key: "time", icon: Calendar, panel: "time" as const, titleKey: "quickCreate.intentNarrowTime", subKey: "quickCreate.intentNarrowTimeSub" },
  { key: "references", icon: Link2, panel: "references" as const, titleKey: "quickCreate.intentReferenceTile", subKey: "quickCreate.intentReferenceTileSub" },
  { key: "recurring", icon: Layers, panel: "recurring" as const, titleKey: "quickCreate.intentNestStructure", subKey: "quickCreate.intentNestStructureSub" },
  { key: "placement", icon: SlidersHorizontal, panel: "meta" as const, titleKey: "quickCreate.intentAdjustPlacement", subKey: "quickCreate.intentAdjustPlacementSub" },
  { key: "completion", icon: ListChecks, panel: "completion" as const, titleKey: "quickCreate.intentCombineConditions", subKey: "quickCreate.intentCombineConditionsSub" },
  { key: "addCompletion", icon: CheckCircle2, panel: "completion" as const, titleKey: "quickCreate.intentAddCompletion", subKey: "quickCreate.intentAddCompletionSub" },
  { key: "onSuccess", icon: Play, panel: "meta" as const, titleKey: "quickCreate.intentDefineOnSuccess", subKey: "quickCreate.intentDefineOnSuccessSub" },
] as const;

function _localDateTimeToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function _isoToLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function _localDateToIsoDate(value: string): string {
  return value ? `${value}T00:00:00.000Z` : "";
}

function _isoToLocalDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function _hexToEventColorName(hex: string | null | undefined): string | null {
  if (!hex) return null;
  const m = hex.toLowerCase().match(/^#([0-9a-f]{6})$/);
  if (!m) return null;
  const v = m[1];
  const map: Record<string, string> = {
    "3b82f6": "blue",
    "22c55e": "green",
    a855f7: "purple",
    f97316: "orange",
    ec4899: "pink",
    "06b6d4": "cyan",
    eab308: "yellow",
    ef4444: "red",
    "14b8a6": "teal",
    "6366f1": "indigo",
    "84cc16": "lime",
    "6b7280": "gray",
  };
  return map[v] ?? null;
}

function formatDisplayDate(
  iso: string | null | undefined,
  allDay: boolean,
  locale: Locale,
  t: (key: string) => string,
): string {
  if (!iso) return t("tiles.notSet");
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return t("tiles.notSet");

  const localeTree = translations[locale] as unknown as {
    weekdays: readonly string[];
    months: readonly string[];
  };
  const weekdays = localeTree.weekdays;
  const months = localeTree.months;

  const day = date.getDate();
  const weekday = date.getDay();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  if (locale === "ja") {
    const dayStr = new Intl.DateTimeFormat("ja-JP", {
      month: "numeric",
      day: "numeric",
      weekday: "short",
    }).format(date);
    return allDay ? dayStr : `${dayStr} ${hours}:${minutes}`;
  }
  // Non-ja placeholder locales route through the English label table; the
  // existing translations.ts already provides weekday / month abbreviations.
  const dayStr = `${months[date.getMonth()]} ${day} (${weekdays[weekday]})`;
  return allDay ? dayStr : `${dayStr}, ${hours}:${minutes}`;
}

function _normalizeHexColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
}

// ============================================================
// Main component
// ============================================================

export function QuickTileCreate() {
  const isOpen = useQuickCreateStore((s) => s.isOpen);
  const close = useQuickCreateStore((s) => s.close);
  const reset = useQuickCreateStore((s) => s.reset);
  const setField = useQuickCreateStore((s) => s.setField);
  const mode = useQuickCreateStore((s) => s.mode);
  const editingId = useQuickCreateStore((s) => s.editingId);
  const loadError = useQuickCreateStore((s) => s.loadError);
  const submitBlocked = useQuickCreateStore((s) => s.submitBlocked);

  const identity = useQuickCreateStore((s) => s.identity);
  const plan = useQuickCreateStore((s) => s.plan);
  const time = useQuickCreateStore((s) => s.time);
  const windows = useQuickCreateStore((s) => s.windows);
  const recurring = useQuickCreateStore((s) => s.recurring);
  const meta = useQuickCreateStore((s) => s.meta);

  const isDesktop = useIsDesktop();
  const { t, locale } = useTranslation();

  const [visualOpen, setVisualOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<
    | "base"
    | "intent"
    | "time"
    | "duration"
    | "recurring"
    | "references"
    | "completion"
    | "meta"
  >("base");
  const projects = useProjects();
  const refreshProjects = projects.refresh;
  const tiles = useTileList({ limit: 200 });
  const knownTags = useMemo(() => {
    const seen = new Set<string>();
    for (const tile of tiles.tiles) {
      for (const label of tile.labels ?? []) {
        const trimmed = label.trim();
        if (trimmed) seen.add(trimmed);
      }
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b, "ja"));
  }, [tiles.tiles]);
  const tilePickerData = useMemo(
    () => tiles.tiles.map((t) => ({ value: t.id, label: t.title || t.id })),
    [tiles.tiles],
  );
  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);
  const [_memoExpanded, setMemoExpanded] = useState(meta.memo.trim().length > 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<"title" | null>(null);
  const [lastConditionTab, setLastConditionTab] = useState<string | null>(null);

  const headingLabel = (() => {
    const isEdit = mode === "edit";
    if (identity.kind === TileKind.RECURRING) {
      return t(isEdit ? "quickCreate.titleEditRecurring" : "quickCreate.titleCreateRecurring");
    }
    if (plan.role === PlanRole.LABEL) {
      return t(isEdit ? "quickCreate.titleEditLabel" : "quickCreate.titleCreateLabel");
    }
    return t(isEdit ? "quickCreate.titleEditTask" : "quickCreate.titleCreateTask");
  })();

  const [mounted, setMounted] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isOpen) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setMounted(true);
      setIsClosing(false);
    } else if (mounted) {
      setIsClosing(true);
      closeTimerRef.current = setTimeout(() => {
        setMounted(false);
        setIsClosing(false);
        closeTimerRef.current = null;
      }, 220);
    }
    return () => {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
    };
  }, [isOpen, mounted]);

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setVisualOpen(false);
      }
    }
    if (visualOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [visualOpen]);

  useEffect(() => {
    if (activePanel === "base") return;
    function handleSubPanelOutsideClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const subPanel = document.querySelector(`[data-subpanel="${activePanel}"]`);
      if (subPanel?.contains(target)) return;
      if (target.closest("[data-mantine-portal]")) return;
      if (target.closest("[data-subpanel]")) return;
      setActivePanel("base");
    }
    document.addEventListener("mousedown", handleSubPanelOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleSubPanelOutsideClick);
    };
  }, [activePanel]);

  useEffect(() => {
    if (identity.externalId === null) {
      setField("identity.externalId", uuidv7());
    }
  }, [identity.externalId, setField]);

  if (!mounted) return null;

  // --- validity ---
  const titleOk = identity.title.trim().length > 0;
  const spanHasStart = !!time.span.start;
  const spanHasEnd = !!time.span.end;
  const spanOrderValid = !spanHasStart || !spanHasEnd || time.span.end > time.span.start;
  const durationValid =
    plan.role === PlanRole.LABEL ||
    time.durationMinMax.minMs === null ||
    time.durationMinMax.maxMs === null ||
    time.durationMinMax.minMs <= time.durationMinMax.maxMs;
  const canSubmit = titleOk && spanOrderValid && durationValid && !submitBlocked;

  // --- completion root summary ---
  function countConditionChildren(node: ConditionNode | null): number {
    if (!node) return 0;
    if (node.kind === ConditionKind.TERM) return 1;
    let total = 1;
    for (const child of node.children) total += countConditionChildren(child);
    return total;
  }
  const completionRootNode = plan.completion.root;
  const _completionRootLabel = (() => {
    if (!completionRootNode) return t("quickCreate.completionNoRoot");
    switch (completionRootNode.kind) {
      case ConditionKind.ALL:
        return t("quickCreate.completionAll");
      case ConditionKind.ANY:
        return t("quickCreate.completionAny");
      case ConditionKind.NOT:
        return t("quickCreate.completionNot");
      case ConditionKind.TERM:
        return t("quickCreate.completionTerm");
      default:
        return t("quickCreate.completionNoRoot");
    }
  })();
  const _completionRootCount = countConditionChildren(completionRootNode);

  // --- windows array helpers ---
  function addWindow() {
    const newWindow: Window = {
      id: uuidv7(),
      owner: "self",
      kind: 0,
      bounds: { start: "", end: "" },
      rules: [],
      referenceId: null,
    };
    setField("windows", [...windows, newWindow]);
  }

  function removeWindow(index: number) {
    setField(
      "windows",
      windows.filter((_, i) => i !== index),
    );
  }

  function updateWindow(index: number, updater: (current: Window) => Window) {
    setField(
      "windows",
      windows.map((w, i) => (i === index ? updater(w) : w)),
    );
  }

  // --- submit ---
  async function handleSubmit() {
    setError(null);
    setInvalidField(null);
    if (!titleOk) {
      setError(t("quickCreate.titleRequired"));
      setInvalidField("title");
      return;
    }
    if (!spanOrderValid) {
      setError(t("quickCreate.invalidTemporalOrder"));
      return;
    }
    if (!canSubmit) return;

    const client = makeClient();
    setSubmitting(true);
    try {
      const result = await submitCreateTile({ client });
      if (!result.ok) {
        throw new Error(
          `${t("quickCreate.createError")} (api:${result.error.kind}) ${result.error.message}`,
        );
      }

      reset();
      setActivePanel("base");
      setMemoExpanded(false);
      notifyEventsChanged();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("quickCreate.createError"));
    } finally {
      setSubmitting(false);
    }
  }


  // --- layout classes ---
  const panelClass = isDesktop
    ? cn(
      "fixed inset-y-0 right-0 z-[56]",
      "w-[36rem] flex flex-col bg-surface-0 shadow-lg border-l border-border transition-all duration-300 ease-out",
      isClosing
        ? "translate-x-full opacity-0"
        : activePanel !== "base"
          ? "-translate-x-6"
          : "translate-x-0",
      "[animation:slideInFromRight_0.22s_ease-out]",
    )
    : cn(
      "fixed inset-x-0 bottom-0 z-[56]",
      "h-[85vh] flex flex-col rounded-t-2xl bg-surface-0 shadow-lg transition-all duration-300 ease-out",
      isClosing
        ? "translate-y-full opacity-0"
        : activePanel !== "base"
          ? "translate-y-6"
          : "translate-y-0",
      "[animation:slideInFromBottom_0.22s_ease-out]",
    );

  const subPanelClass = (
    panel:
      | "intent"
      | "time"
      | "duration"
      | "recurring"
      | "references"
      | "completion"
      | "meta",
  ) =>
    isDesktop
      ? cn(
        "fixed inset-y-0 right-0 z-[57]",
        "w-[28rem] flex flex-col bg-surface-0 border-l border-border",
        "transition-transform duration-300 ease-out",
        activePanel === panel ? "translate-x-0" : "translate-x-full pointer-events-none",
      )
      : cn(
        "fixed inset-x-0 bottom-0 z-[57]",
        "h-[85vh] flex flex-col rounded-t-2xl bg-surface-0 transition-transform duration-300 ease-out",
        activePanel === panel ? "translate-y-0" : "translate-y-full pointer-events-none",
      );

  // --- condition count ---
  const conditionCount = windows.length + recurring.frameRules.length;
  const ownerId = meta.ownerSubjectId;
  const currentProject = ownerId ? projects.workspaces.find((w) => w.id === ownerId) : null;

  return (
    <>
      {/* backdrop */}
      <div
        data-testid="quick-create-backdrop"
        className={cn(
          "fixed inset-0 z-[55] bg-foreground/10 backdrop-blur-[1px] transition-opacity duration-300 ease-out",
          isClosing ? "opacity-0 pointer-events-none" : "opacity-100",
        )}
        onClick={() => {
          if (activePanel !== "base") setActivePanel("base");
          else close();
        }}
        aria-hidden
      />

      {/* main panel */}
      <section className={panelClass} aria-label={headingLabel}>
        {/* ─── composer head ─── */}
        <div className="flex h-[68px] shrink-0 items-center gap-3 border-b border-border px-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent-ink">
            <Layers className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[15px] font-semibold leading-tight text-foreground">
              {headingLabel}
            </h2>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <CloseButton onClick={close} aria-label={t("tiles.closePanel")} />
          </div>
        </div>

        {/* ─── composer body ─── */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-[640px]">
            {/* ── main card ── */}
            <section className="py-2">
              {/* title input */}
              <TextInput
                value={identity.title}
                onChange={(e) => {
                  setField("identity.title", e.target.value);
                  if (invalidField === "title") setInvalidField(null);
                }}
                placeholder={t("quickCreate.titlePlaceholder")}
                aria-label={t("quickCreate.titlePlaceholder")}
                aria-required="true"
                aria-invalid={invalidField === "title" ? "true" : "false"}
                aria-describedby={invalidField === "title" ? "quick-create-error" : undefined}
                variant="unstyled"
                size="xl"
                fw={700}
                styles={{
                  input: {
                    fontSize: "1.5rem",
                    lineHeight: "2rem",
                    fontWeight: 700,
                    letterSpacing: "-0.025em",
                    padding: 0,
                    paddingBottom: "0.75rem",
                  },
                }}
              />

              {/* organize row: project + tags + add button */}
              <div
                className="flex flex-wrap items-center gap-1.5 pb-3"
                data-testid="quick-create-organize-row"
              >
                {currentProject && (
                  <Button
                    type="button"
                    onClick={() => setActivePanel("meta")}
                    radius="xl"
                    size="xs"
                    variant="light"
                    leftSection={<FolderOpen size={12} />}
                  >
                    {currentProject.display_name}
                  </Button>
                )}
                {meta.tags.map((tag) => (
                  <Button
                    key={tag}
                    type="button"
                    onClick={() => setActivePanel("meta")}
                    radius="xl"
                    size="xs"
                    variant="light"
                    leftSection={<Tag size={12} />}
                  >
                    #{tag}
                  </Button>
                ))}
                <Button
                  type="button"
                  onClick={() => setActivePanel("meta")}
                  leftSection={<Plus size={12} />}
                  variant="subtle"
                  size="xs"
                  radius="xl"
                >
                  {t("quickCreate.metaExpandLabel") || "Refine"}
                </Button>
              </div>

              {/* ─── essentials ─── */}
              <div className="pt-2" data-testid="quick-create-essentials">
                <hr className="border-border mb-2" />
                <V4EssentialRow
                  icon={Calendar}
                  label={t("quickCreate.timeNavTitle")}
                  chip={
                    time.whenMode === "none" ? (
                      <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-surface-1 px-2.5 text-xs font-bold text-foreground-muted">
                        {t("quickCreate.whenNoneTitle")}
                      </span>
                    ) : time.whenMode === "reference" ? (
                      <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 text-xs font-bold text-accent-ink">
                        {t("quickCreate.referenceRangeTitle")}
                      </span>
                    ) : time.span.start || time.span.end ? (
                      <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 text-xs font-bold text-accent-ink">
                        {time.whenMode === "day"
                          ? formatDisplayDate(time.span.start, true, locale, t)
                          : `${time.span.start ? formatDisplayDate(time.span.start, false, locale, t) : t("quickCreate.spanUnset")} → ${time.span.end ? formatDisplayDate(time.span.end, false, locale, t) : t("quickCreate.spanUnset")}`}
                      </span>
                    ) : (
                      <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-surface-1 px-2.5 text-xs font-bold text-foreground-muted">
                        {t("tiles.notSet")}
                      </span>
                    )
                  }
                  clearable={
                    time.whenMode === "reference"
                      ? Boolean(time.referenceId)
                      : time.whenMode !== "none"
                        ? Boolean(time.span.start || time.span.end)
                        : false
                  }
                  onClear={() => {
                    if (time.whenMode === "reference") {
                      setField("time.referenceId", null);
                      setField("time.referenceLabel", "");
                    } else {
                      setField("time.span.start", "");
                      setField("time.span.end", "");
                    }
                  }}
                  onClick={() => setActivePanel("time")}
                  editAria={t("quickCreate.essentialRowEditAria")}
                  clearAria={t("quickCreate.essentialRowClearAria")}
                  confirmClearAria={t("quickCreate.essentialRowClearConfirmAria")}
                  confirmClearLabel={t("quickCreate.essentialRowClearConfirmLabel")}
                />
                <V4EssentialRow
                  icon={Clock}
                  label={t("quickCreate.duration")}
                  chip={
                    time.durationMinMax.minMs !== null || time.durationMinMax.maxMs !== null ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 text-xs font-bold text-accent-ink">
                          {time.durationMinMax.minMs !== null
                            ? `${Math.round(time.durationMinMax.minMs / 60000)} min`
                            : "—"}
                          {time.durationMinMax.maxMs !== null
                            ? ` – ${Math.round(time.durationMinMax.maxMs / 60000)} min`
                            : ""}
                        </span>
                        <span className="inline-flex items-center gap-1 text-[10px] font-medium text-foreground-muted">
                          <Link2 size={10} aria-hidden="true" />
                          {t("quickCreate.durationLinkedNote")}
                        </span>
                      </span>
                    ) : (
                      <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-surface-1 px-2.5 text-xs font-bold text-foreground-muted">
                        {t("tiles.notSet")}
                      </span>
                    )
                  }
                  clearable={
                    time.durationMinMax.minMs !== null || time.durationMinMax.maxMs !== null
                  }
                  onClear={() => {
                    setField("time.durationMinMax.minMs", null);
                    setField("time.durationMinMax.maxMs", null);
                  }}
                  onClick={() => setActivePanel("duration")}
                  editAria={t("quickCreate.essentialRowEditAria")}
                  clearAria={t("quickCreate.essentialRowClearAria")}
                  confirmClearAria={t("quickCreate.essentialRowClearConfirmAria")}
                  confirmClearLabel={t("quickCreate.essentialRowClearConfirmLabel")}
                />
                <V4EssentialRow
                  icon={Repeat}
                  label={t("quickCreate.repeatChip")}
                  chip={
                    recurring.repeatMode === "once" ? (
                      <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-surface-1 px-2.5 text-xs font-bold text-foreground-muted">
                        {t("tiles.notSet")}
                      </span>
                    ) : (
                      <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 text-xs font-bold text-accent-ink">
                        <span>{t(REPEAT_MODE_LABEL_KEY[recurring.repeatMode])}</span>
                        {recurring.repeatMode === "weekly" && recurring.weekdayMask > 0 ? (
                          <span className="text-foreground-muted">
                            (
                            {weekdayLabelsFor(locale)
                              .filter((_, i) => (recurring.weekdayMask & (1 << i)) !== 0)
                              .join(", ")}
                            )
                          </span>
                        ) : null}
                        {recurring.repeatMode !== "condition" && recurring.endDate ? (
                          <span className="text-foreground-muted">
                            ~ {recurring.endDate.slice(0, 10)}
                          </span>
                        ) : null}
                      </span>
                    )
                  }
                  clearable={recurring.repeatMode !== "once" || Boolean(recurring.endDate)}
                  onClear={() => {
                    setField("recurring.repeatMode", "once");
                    setField("recurring.weekdayMask", 0);
                    setField("recurring.endDate", "");
                  }}
                  onClick={() => setActivePanel("recurring")}
                  editAria={t("quickCreate.essentialRowEditAria")}
                  clearAria={t("quickCreate.essentialRowClearAria")}
                  confirmClearAria={t("quickCreate.essentialRowClearConfirmAria")}
                  confirmClearLabel={t("quickCreate.essentialRowClearConfirmLabel")}
                />
              </div>

              {/* ─── tasks block ─── */}
              <div className="pt-3">
                <hr className="border-border mb-3" />
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                  <ListChecks size={14} aria-hidden="true" />
                  <span>{t("quickCreate.completionRequires")}</span>
                  <ActionIcon
                    type="button"
                    variant="subtle"
                    onClick={() => setActivePanel("completion")}
                    aria-label={t("quickCreate.completionRequires")}
                    className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-1 hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <ChevronRight size={14} aria-hidden="true" />
                  </ActionIcon>
                </div>
                <div className="mt-1 mb-2 text-[10px] text-foreground-muted">
                  {plan.completion.tasks.length > 0
                    ? `${plan.completion.tasks.length}${t("quickCreate.completionItemsHint")}`
                    : t("quickCreate.completionAddHint")}
                </div>
                <div className="space-y-1.5">
                  {plan.completion.tasks.map((tk, i) => (
                    <div
                      key={tk.id}
                      data-testid="quick-create-task-row"
                      className="flex min-h-[32px] items-center gap-2 rounded-md border border-border/50 bg-surface-0 px-2 py-1 text-xs"
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border bg-surface-0" />
                      <TextInput
                        value={tk.content?.title ?? ""}
                        onChange={(e) => {
                          const next = plan.completion.tasks.slice();
                          next[i] = {
                            ...tk,
                            content: { ...tk.content, title: e.target.value },
                          };
                          setField("plan.completion.tasks", next);
                        }}
                        placeholder={t("quickCreate.taskUntitled")}
                        variant="unstyled"
                        size="xs"
                        className="min-w-0 flex-1"
                        styles={{ input: { padding: 0, height: 20, minHeight: 20 } }}
                      />
                      <Menu position="bottom-end" withArrow shadow="md">
                        <Menu.Target>
                          <ActionIcon
                            type="button"
                            variant="subtle"
                            size="xs"
                            aria-label={t("quickCreate.taskMoreAria")}
                          >
                            <MoreHorizontal size={12} />
                          </ActionIcon>
                        </Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item
                            leftSection={<ChevronUp size={14} />}
                            disabled={i === 0}
                            onClick={() => {
                              const target = i - 1;
                              if (target < 0) return;
                              const next = plan.completion.tasks.slice();
                              const [moved] = next.splice(i, 1);
                              next.splice(target, 0, moved);
                              setField("plan.completion.tasks", next);
                            }}
                          >
                            {t("quickCreate.taskMoveUp")}
                          </Menu.Item>
                          <Menu.Item
                            leftSection={<ChevronDown size={14} />}
                            disabled={i === plan.completion.tasks.length - 1}
                            onClick={() => {
                              const target = i + 1;
                              if (target >= plan.completion.tasks.length) return;
                              const next = plan.completion.tasks.slice();
                              const [moved] = next.splice(i, 1);
                              next.splice(target, 0, moved);
                              setField("plan.completion.tasks", next);
                            }}
                          >
                            {t("quickCreate.taskMoveDown")}
                          </Menu.Item>
                          <Menu.Divider />
                          <Menu.Item
                            leftSection={<Trash2 size={14} />}
                            color="red"
                            onClick={() => {
                              const next = plan.completion.tasks.slice();
                              next.splice(i, 1);
                              setField("plan.completion.tasks", next);
                            }}
                          >
                            {t("quickCreate.taskMoreTitle")}
                          </Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </div>
                  ))}
                  <Button
                    type="button"
                    variant="subtle"
                    size="xs"
                    leftSection={<Plus size={12} />}
                    onClick={() => {
                      setField("plan.completion.tasks", [
                        ...plan.completion.tasks,
                        {
                          id: `tk_${Math.random().toString(36).slice(2, 9)}`,
                          content: { title: "", note: null },
                          show: null,
                          complete: {
                            id: `c_${Math.random().toString(36).slice(2, 9)}`,
                            kind: 0,
                            children: [],
                            term: null,
                          },
                          order: [],
                        },
                      ]);
                    }}
                    className="mt-1 text-foreground-muted"
                  >
                    {t("quickCreate.completionAddHint")}
                  </Button>
                </div>
              </div>

              {/* ─── behavior block ─── */}
              <div className="mt-3 pt-3" data-testid="quick-create-behavior-block">
                <hr className="border-border mb-3" />
                <div className="mb-2 flex items-baseline justify-between">
                  <strong className="text-xs font-semibold text-foreground">
                    {t("quickCreate.behaviorTitle")}
                  </strong>
                </div>
                <SegmentedControl
                  fullWidth
                  size="sm"
                  radius="md"
                  value={String(plan.role)}
                  onChange={(value) => setField("plan.role", Number(value) as PlanRoleValue)}
                  data-testid="behavior-role-inline"
                  data={[
                    {
                      value: String(PlanRole.EXECUTABLE),
                      label: t("quickCreate.behaviorExecutable"),
                    },
                    {
                      value: String(PlanRole.LABEL),
                      label: t("quickCreate.behaviorLabel"),
                    },
                  ]}
                  styles={SEGMENT_STYLES}
                />
              </div>
            </section>

            {/* ── condition card ── */}
            <section className="pt-3">
              <hr className="border-border mb-3" />
              <div className="flex items-center justify-between mb-2">
                <strong className="text-xs font-semibold text-foreground">{t("quickCreate.conditionHeading")}</strong>
                <span className="text-[10px] text-foreground-muted">{conditionCount}</span>
              </div>
              <div className="p-2.5" data-testid="quick-create-condition-tree">
                {windows.length + recurring.frameRules.length === 0 ? (
                  <p
                    data-testid="quick-create-condition-empty"
                    className="rounded-md bg-surface-1 px-2.5 py-3 text-center text-[10px] text-foreground-muted"
                  >
                    {t("quickCreate.conditionEmpty")}
                  </p>
                ) : (
                  <Stack gap="xs">
                    {windows.map((w, i) => (
                      <div
                        key={w.id ?? i}
                        className="flex items-center gap-2 rounded-md border border-border/50 bg-surface-0 px-2 py-1.5 text-xs"
                      >
                        <Clock
                          size={12}
                          className="shrink-0 text-foreground-muted"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate text-foreground">
                          {w.bounds.start && w.bounds.end
                            ? `${w.bounds.start} → ${w.bounds.end}`
                            : t("quickCreate.conditionWindowOpen")}
                        </span>
                        <ActionIcon
                          type="button"
                          variant="subtle"
                          size="xs"
                          onClick={() => setActivePanel("time")}
                          aria-label={t("quickCreate.edit")}
                        >
                          <Pencil size={12} />
                        </ActionIcon>
                        <ActionIcon
                          type="button"
                          variant="subtle"
                          size="xs"
                          onClick={() => {
                            const next = windows.filter((_, idx) => idx !== i);
                            setField("windows", next);
                          }}
                          aria-label={t("quickCreate.removeItem")}
                        >
                          <Trash2 size={12} />
                        </ActionIcon>
                      </div>
                    ))}

                    {recurring.frameRules.map((r, i) => (
                      <div
                        key={r.id ?? i}
                        className="flex items-center gap-2 rounded-md border border-border/50 bg-surface-0 px-2 py-1.5 text-xs"
                      >
                        <Repeat
                          size={12}
                          className="shrink-0 text-foreground-muted"
                          aria-hidden="true"
                        />
                        <span className="min-w-0 flex-1 truncate text-foreground">
                          {r.generator?.kind === "step"
                            ? t("quickCreate.conditionFrameStep")
                            : t("quickCreate.conditionFrameOpen")}
                        </span>
                        <ActionIcon
                          type="button"
                          variant="subtle"
                          size="xs"
                          onClick={() => setActivePanel("recurring")}
                          aria-label={t("quickCreate.edit")}
                        >
                          <Pencil size={12} />
                        </ActionIcon>
                        <ActionIcon
                          type="button"
                          variant="subtle"
                          size="xs"
                          onClick={() => {
                            const next = recurring.frameRules.filter((_, idx) => idx !== i);
                            setField("recurring.frameRules", next);
                          }}
                          aria-label={t("quickCreate.removeItem")}
                        >
                          <Trash2 size={12} />
                        </ActionIcon>
                      </div>
                    ))}
                  </Stack>
                )}
              </div>
              <Button
                type="button"
                variant="subtle"
                size="xs"
                leftSection={<Plus size={12} />}
                onClick={() => setActivePanel("intent")}
                data-testid="quick-create-condition-add"
                className="mt-2 text-foreground-muted"
              >
                {t("quickCreate.addConditionOrGroup")}
              </Button>
            </section>

            {/* simple note */}
            <p
              className="flex items-start gap-1.5 text-[10px] text-foreground-muted"
              data-testid="quick-create-simple-note"
            >
              <Info className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>{t("quickCreate.simpleNote")}</span>
            </p>
          </div>
        </div>

        {/* ─── composer foot ─── */}
        <Group h={62} justify="space-between" px="md" className="shrink-0 border-t border-border bg-surface-0">
          <div className="flex items-center gap-2 text-[11px] text-foreground-muted">
            <span className="h-[7px] w-[7px] rounded-full bg-green-500" />
            <span id="validationText">{t("quickCreate.validationOk") || "Ready to create"}</span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="filled"
              size="sm"
              data-testid="quick-create-submit"
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitting || !canSubmit || !titleOk || !spanOrderValid || submitBlocked}
              leftSection={submitting ? undefined : <Check size={16} />}
            >
              {submitting ? t("quickCreate.saving") : t("quickCreate.commit")}
            </Button>
          </div>
        </Group>
        {error ? <p className="px-4 pb-2 text-center text-xs text-danger">{error}</p> : null}
        {loadError ? (
          <p
            role="alert"
            data-testid="quick-create-load-error"
            className="px-4 pb-2 text-center text-xs text-warning"
          >
            {loadError}
          </p>
        ) : null}
      </section>

      {/* ─── intent sub-panel ─── */}
      <section
        data-subpanel="intent"
        className={subPanelClass("intent")}
        aria-hidden={activePanel !== "intent"}
      >
        <SubPanelHeader
          onBack={() => setActivePanel("base")}
          backAriaLabel={t("quickCreate.back")}
          title={t("quickCreate.addConditionOrGroup")}
          subtitle={t("quickCreate.intentSubTitle")}
        />
        <div className="flex-1 overflow-auto p-4">
          <p className="mb-3 text-[11px] text-foreground-muted">
            {t("quickCreate.intentDescription")}
          </p>
          <SimpleGrid cols={2} spacing="xs" data-testid="intent-grid">
            {INTENT_ITEMS.map((item) => (
              <Paper key={item.key} withBorder radius="md">
                <UnstyledButton
                  onClick={() => setActivePanel(item.panel)}
                  className="flex min-h-[64px] w-full items-center gap-2.5 px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <item.icon size={14} className="shrink-0 text-primary" />
                  <div className="min-w-0">
                    <Text size="xs" fw={600}>{t(item.titleKey)}</Text>
                    <Text size="10" c="var(--foreground-muted)">{t(item.subKey)}</Text>
                  </div>
                </UnstyledButton>
              </Paper>
            ))}
            <Paper withBorder radius="md" opacity={0.5}>
              <div className="flex min-h-[64px] items-center gap-2.5 px-3 py-2">
                <Type size={14} className="shrink-0 text-foreground-muted" />
                <div className="min-w-0">
                  <Text size="xs" fw={600}>{t("quickCreate.intentTextCondition")}</Text>
                  <Text size="10" c="var(--foreground-muted)">{t("quickCreate.intentTextConditionSub")}</Text>
                </div>
              </div>
            </Paper>
          </SimpleGrid>
        </div>
      </section>

      {/* ─── time sub-panel ─── */}
      <section
        data-subpanel="time"
        className={subPanelClass("time")}
        aria-hidden={activePanel !== "time"}
      >
        <SubPanelHeader
          onBack={() => setActivePanel("base")}
          backAriaLabel={t("quickCreate.back")}
          title={t("quickCreate.timeNavTitle")}
          subtitle={t("quickCreate.timeNavSub")}
        />
        <FormPanel>
          <SchedulePanel
            time={time}
            windows={windows}
            setField={setField}
            updateWindow={updateWindow}
            addWindow={addWindow}
            removeWindow={removeWindow}
            locale={locale}
            t={t}
          />
        </FormPanel>
      </section>

      {/* ─── duration sub-panel ─── */}
      <section
        data-subpanel="duration"
        className={subPanelClass("duration")}
        aria-hidden={activePanel !== "duration"}
      >
        <SubPanelHeader
          onBack={() => setActivePanel("base")}
          backAriaLabel={t("quickCreate.back")}
          title={t("quickCreate.durationTitle")}
          subtitle={t("quickCreate.durationSub")}
        />
        <div className="flex-1 overflow-auto p-4">
          <div className="mb-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
              {t("quickCreate.durationInputLabel")}
            </div>
            <SegmentedControl
              fullWidth
              size="sm"
              radius="md"
              data={[
                { value: "none", label: t("quickCreate.durationNoneTitle") },
                { value: "custom", label: t("quickCreate.durationInputLabel") },
              ]}
              value={
                time.durationMinMax.minMs === null && time.durationMinMax.maxMs === null
                  ? "none"
                  : "custom"
              }
              onChange={(value) => {
                if (value === "none") {
                  setField("time.durationMinMax.minMs", null);
                  setField("time.durationMinMax.maxMs", null);
                }
              }}
              styles={SEGMENT_STYLES}
            />
          </div>

          {time.durationMinMax.minMs !== null && (
            <div className="mb-4">
              <NumberInput
                min={10}
                step={10}
                value={Math.round(time.durationMinMax.minMs / 60000)}
                onChange={(value) => {
                  const num = typeof value === "number" ? value : Number(value);
                  if (!Number.isFinite(num)) return;
                  const clamped = Math.max(10, Math.min(720, num));
                  setField("time.durationMinMax.minMs", clamped * 60000);
                  setField("time.durationMinMax.maxMs", clamped * 60000);
                }}
                size="sm"
                aria-label={t("quickCreate.durationInputLabel")}
                suffix={t("quickCreate.minutesUnit")}
                styles={{ input: { backgroundColor: "var(--surface-2)" } }}
              />
            </div>
          )}

        </div>
      </section>

      {/* ─── recurring sub-panel ─── */}
      <section
        data-subpanel="recurring"
        className={subPanelClass("recurring")}
        aria-hidden={activePanel !== "recurring"}
      >
        <SubPanelHeader
          onBack={() => setActivePanel("base")}
          backAriaLabel={t("quickCreate.back")}
          title={t("quickCreate.repeatChip")}
        />
        <AutomationPanel recurring={recurring} setField={setField} locale={locale} t={t} />
      </section>

      {/* ─── references sub-panel ─── */}
      <section
        data-subpanel="references"
        className={subPanelClass("references")}
        aria-hidden={activePanel !== "references"}
      >
        <SubPanelHeader
          onBack={() => setActivePanel("base")}
          backAriaLabel={t("quickCreate.back")}
          title={t("quickCreate.referencesNavTitle")}
        />
        <FormPanel>
          <SectionHeader icon={Link2} title={t("quickCreate.referencesNavTitle")} />
          {plan.references.length === 0 ? (
            <p className="text-xs text-foreground-muted">
              {t("quickCreate.referenceEmptyListHint")}
            </p>
          ) : null}
          <div className="flex flex-col gap-4">
            {plan.references.map((ref, i) => {
              const refIdDisplay = ref.id || `ref_${i + 1}`;
              const hasTarget = ref.target.referenceId !== null && ref.target.referenceId !== "";
              const intervalValue = (() => {
                const m = ref.pick.momentId ? Number(ref.pick.momentId) : 10;
                return Number.isFinite(m) && m > 0 ? m : 10;
              })();
              return (
                <div
                  key={`${refIdDisplay}-${i}`}
                  className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface-0 p-3"
                  data-testid={`reference-card-${i}`}
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
                      {t("quickCreate.referenceTargetLabel")}
                    </div>
                    <div
                      className={cn(
                        "flex items-center gap-3 rounded-lg border bg-surface-0 p-3",
                        hasTarget ? "bg-accent-soft" : "border-border",
                      )}
                      data-testid={`reference-target-card-${i}`}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-foreground-muted">
                        <Calendar size={18} aria-hidden="true" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-foreground">
                          {hasTarget
                            ? ref.target.referenceId
                            : t("quickCreate.referenceTargetEmpty")}
                        </span>
                        <span className="truncate text-xs text-foreground-muted">
                          {t("quickCreate.referenceTargetBadge")}
                        </span>
                      </div>
                    </div>
                    <Select
                      aria-label={t("quickCreate.referenceIdPlaceholder")}
                      placeholder={t("quickCreate.referenceIdPlaceholder")}
                      value={ref.target.referenceId ?? null}
                      onChange={(value) => {
                        const next = plan.references.slice();
                        next[i] = {
                          ...ref,
                          target: { ...ref.target, referenceId: value || null },
                        };
                        setField("plan.references", next);
                      }}
                      data={tiles.tiles.map((t) => ({
                        value: t.id,
                        label: t.title || t.id,
                      }))}
                      searchable
                      clearable
                      size="sm"
                      variant="filled"
                      styles={{ input: { backgroundColor: "var(--surface-2)" } }}
                      comboboxProps={{ withinPortal: false }}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
                      {t("quickCreate.referenceRelationLabel")}
                    </div>
                    <SegmentedControl
                      size="sm"
                      fullWidth
                      radius="md"
                      withItemsBorders={false}
                      value={String(ref.pick.kind)}
                      onChange={(next) => {
                        const updated = plan.references.slice();
                        updated[i] = { ...ref, pick: { ...ref.pick, kind: Number(next) } };
                        setField("plan.references", updated);
                      }}
                      data={[
                        { value: "4", label: t("quickCreate.referenceRelationAfter") },
                        { value: "3", label: t("quickCreate.referenceRelationBefore") },
                        { value: "1", label: t("quickCreate.referenceRelationFirst") },
                        { value: "2", label: t("quickCreate.referenceRelationLast") },
                        { value: "0", label: t("quickCreate.referenceRelationAll") },
                      ]}
                      data-testid={`reference-relation-tabs-${i}`}
                      styles={SEGMENT_STYLES}
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
                      {t("quickCreate.referenceIntervalLabel")}
                    </div>
                    <div
                      className="flex items-center gap-2"
                      data-testid={`reference-interval-stepper-${i}`}
                    >
                      <NumberInput
                        min={5}
                        max={120}
                        step={5}
                        value={intervalValue}
                        onChange={(value) => {
                          const num = typeof value === "number" ? value : Number(value);
                          if (!Number.isFinite(num)) return;
                          const next = Math.max(5, Math.min(120, num));
                          if (next === intervalValue) return;
                          const updated = plan.references.slice();
                          updated[i] = { ...ref, pick: { ...ref.pick, momentId: String(next) } };
                          setField("plan.references", updated);
                        }}
                        size="xs"
                        aria-label={t("quickCreate.referenceIntervalLabel")}
                        suffix={t("quickCreate.referenceIntervalUnitMin")}
                        styles={{ input: { backgroundColor: "var(--surface-2)" } }}
                        className="flex-1"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-t border-border/40 pt-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="subtle"
                      leftSection={<Trash2 size={12} aria-hidden="true" />}
                      onClick={() => {
                        const next = plan.references.slice();
                        next.splice(i, 1);
                        setField("plan.references", next);
                      }}
                      className="text-danger hover:bg-danger/10"
                    >
                      {t("quickCreate.referenceRemoveLabel")}
                    </Button>
                    <div className="flex-1" />
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      leftSection={<X size={12} aria-hidden="true" />}
                      onClick={() => setActivePanel("base")}
                    >
                      {t("quickCreate.referenceCancelLabel")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="filled"
                      leftSection={<Check size={12} aria-hidden="true" />}
                      onClick={() => setActivePanel("base")}
                    >
                      {t("quickCreate.referenceApplyLabel")}
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button
              type="button"
              size="sm"
              variant="default"
              leftSection={<Plus size={12} aria-hidden="true" />}
              onClick={() => {
                setField("plan.references", [
                  ...plan.references,
                  {
                    id: "",
                    target: { kind: 0, contextKind: null, referenceId: null, conditionId: null },
                    pick: { kind: 4, momentId: "10" },
                  },
                ]);
              }}
              data-testid="reference-add-button"
            >
              {t("quickCreate.addReference")}
            </Button>
          </div>
        </FormPanel>
      </section>

      {/* ─── completion sub-panel ─── */}
      <section
        data-subpanel="completion"
        className={subPanelClass("completion")}
        aria-hidden={activePanel !== "completion"}
      >
        <SubPanelHeader
          onBack={() => setActivePanel("base")}
          backAriaLabel={t("quickCreate.back")}
          title={t("quickCreate.completionNavTitle")}
        />
        <FormPanel>
          <SectionHeader icon={ListChecks} title={t("quickCreate.completionNavTitle")} />
          <div
            className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface-0 p-3"
            data-testid="completion-condition-box"
          >
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm font-semibold text-foreground">
                {t("quickCreate.completionBuilderLogicLabel")}
              </strong>
              <Select
                aria-label={t("quickCreate.completionBuilderLogicLabel")}
                value={String(plan.completion.root.kind) ?? null}
                onChange={(value) => {
                  if (value == null) return;
                  const nextKind = Number(value);
                  setField("plan.completion.root", {
                    ...plan.completion.root,
                    kind: nextKind as never,
                  });
                }}
                data-testid="completion-logic-select"
                data={[
                  {
                    value: String(ConditionKind.ALL),
                    label: t("quickCreate.completionBuilderLogicAll"),
                  },
                  {
                    value: String(ConditionKind.ANY),
                    label: t("quickCreate.completionBuilderLogicAny"),
                  },
                  { value: String(ConditionKind.NOT), label: t("quickCreate.completionNot") },
                ]}
                comboboxProps={{ withinPortal: true }}
                allowDeselect={false}
              />
            </div>
            <ConditionEditor
              node={plan.completion.root}
              onChange={(next) => setField("plan.completion.root", next)}
              t={t}
              tileOptions={tilePickerData}
            />
            {plan.completion.timeRequirements.length > 0 && (
              <div
                className="flex flex-col gap-1.5 border-t border-border/40 pt-2"
                data-testid="completion-time-requirement-lines"
              >
                {plan.completion.timeRequirements.map((tr, i) => (
                  <div
                    key={tr.id}
                    className="flex items-center gap-2 rounded-md bg-surface-1 px-2 py-1.5 text-sm"
                    data-testid={`completion-time-line-${i}`}
                  >
                    <Clock
                      size={16}
                      className="shrink-0 text-foreground-muted"
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-foreground">
                      {tr.required.minMs !== null
                        ? `${Math.round(tr.required.minMs / 60000)} ${t("quickCreate.minutesUnit")}`
                        : t("quickCreate.duration")}
                    </span>
                    <NumberInput
                      min={5}
                      step={5}
                      aria-label={t("quickCreate.minutesUnit")}
                      value={
                        tr.required.minMs === null
                          ? ""
                          : Math.round((tr.required.minMs ?? 0) / 60000)
                      }
                      onChange={(value) => {
                        const next = plan.completion.timeRequirements.slice();
                        const v = value;
                        next[i] = {
                          ...tr,
                          required: {
                            ...tr.required,
                            minMs: v === "" || v === null ? null : Number(v) * 60000,
                          },
                        };
                        setField("plan.completion.timeRequirements", next);
                      }}
                      className="w-16"
                      size="xs"
                    />
                    <span className="text-xs text-foreground-muted">
                      {t("quickCreate.minutesUnit")}
                    </span>
                    <Button
                      type="button"
                      size="xs"
                      variant="subtle"
                      leftSection={<Trash2 size={12} aria-hidden="true" />}
                      onClick={() => {
                        const next = plan.completion.timeRequirements.slice();
                        next.splice(i, 1);
                        setField("plan.completion.timeRequirements", next);
                      }}
                      aria-label={t("quickCreate.removeItem")}
                      className="text-foreground-muted hover:text-danger"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
              {t("quickCreate.conditionAddTitle")}
            </div>
            <SegmentedControl
              fullWidth
              size="sm"
              radius="md"
              withItemsBorders={false}
              data-testid="completion-condition-tabs"
              value={lastConditionTab ?? undefined}
              onChange={(value) => {
                const termKind =
                  value === "time"
                    ? null
                    : value === "task"
                      ? "task"
                      : value === "relation"
                        ? "relation"
                        : "metric";
                if (termKind === null) {
                  const newTr = {
                    id: `tr_${Math.random().toString(36).slice(2, 9)}`,
                    observation: { scope: 0 as never },
                    required: { minMs: time.durationMinMax.minMs ?? 60 * 60000 },
                  };
                  setField("plan.completion.timeRequirements", [
                    ...plan.completion.timeRequirements,
                    newTr,
                  ]);
                  setLastConditionTab(value);
                  return;
                }
                const child = defaultTerm(termKind);
                setField("plan.completion.root", {
                  ...plan.completion.root,
                  children: [...plan.completion.root.children, child],
                });
                setLastConditionTab(value);
              }}
              data={[
                { value: "time", label: t("quickCreate.completionBuilderTabTime") },
                { value: "task", label: t("quickCreate.completionBuilderTabTask") },
                { value: "relation", label: t("quickCreate.completionBuilderTabTile") },
                { value: "metric", label: t("quickCreate.completionBuilderTabRecord") },
              ]}
              styles={SEGMENT_STYLES}
            />
          </div>
          <div className="flex items-center gap-2 border-t border-border/40 pt-3">
            <Button
              type="button"
              size="sm"
              variant="subtle"
              leftSection={<Trash2 size={12} aria-hidden="true" />}
              onClick={() =>
                setField("plan.completion.root", {
                  kind: ConditionKind.ALL,
                  children: [],
                  term: null,
                })
              }
              className="text-danger hover:bg-danger/10"
            >
              {t("quickCreate.completionRemoveLabel")}
            </Button>
            <div className="flex-1" />
            <Button
              type="button"
              size="sm"
              variant="default"
              leftSection={<X size={12} aria-hidden="true" />}
              onClick={() => setActivePanel("base")}
            >
              {t("quickCreate.completionCancelLabel")}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="filled"
              leftSection={<Check size={12} aria-hidden="true" />}
              onClick={() => setActivePanel("base")}
              data-testid="completion-apply"
            >
              {t("quickCreate.completionBuilderApply")}
            </Button>
          </div>
        </FormPanel>
      </section>

      {/* ─── meta sub-panel ─── */}
      <section
        data-subpanel="meta"
        className={subPanelClass("meta")}
        aria-hidden={activePanel !== "meta"}
      >
        <SubPanelHeader
          onBack={() => setActivePanel("base")}
          backAriaLabel={t("quickCreate.back")}
          title={t("quickCreate.metaNavTitle")}
        />
        <FormPanel>
          <SectionHeader icon={FolderOpen} title={t("quickCreate.metaNavTitle")} />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
              <span>{t("quickCreate.organizeProject")}</span>
            </div>
            <div className="flex flex-col gap-2" data-testid="meta-project-catalog">
              <Select
                size="xs"
                variant="filled"
                aria-label={t("quickCreate.organizeProject")}
                placeholder={t("quickCreate.organizeProject")}
                value={meta.ownerSubjectId ?? ""}
                onChange={(value) => setField("meta.ownerSubjectId", value ? value : null)}
                allowDeselect={false}
                leftSection={<FolderOpen size={14} aria-hidden="true" />}
                data={[
                  {
                    value: "",
                    label: t("quickCreate.projectOwnerDefault"),
                  },
                  ...projects.workspaces.map((w) => ({
                    value: w.id,
                    label: w.display_name,
                  })),
                ]}
                comboboxProps={{ withinPortal: true }}
                searchable
                styles={{
                  input: { backgroundColor: "var(--surface-2)" },
                }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
              <span>{t("quickCreate.organizeTags")}</span>
              <span className="text-[10px] font-normal text-foreground-muted">
                {t("quickCreate.organizeTagsMulti")}
              </span>
            </div>
            <TagsInput
              data-testid="meta-tag-chips"
              value={meta.tags}
              onChange={(values) => setField("meta.tags", values)}
              placeholder={t("quickCreate.tagsPlaceholder")}
              aria-label={t("quickCreate.tagsPlaceholder")}
              size="xs"
              variant="filled"
              splitChars={[",", " "]}
              clearable
              data={knownTags}
              styles={{
                input: { backgroundColor: "var(--surface-2)" },
                pill: { backgroundColor: "var(--accent-soft, var(--surface-2))" },
              }}
            />
          </div>
          <FormRow icon={null}>
            <Textarea
              value={meta.memo}
              onChange={(e) => setField("meta.memo", e.target.value)}
              placeholder={t("quickCreate.memoPlaceholder")}
              aria-label={t("quickCreate.memoPlaceholder")}
              rows={6}
              className="w-full resize-none border-0 bg-transparent p-0 text-sm focus:ring-0"
            />
          </FormRow>
          <div className="flex items-center gap-2 border-t border-border/40 pt-3">
            <Button
              type="button"
              size="sm"
              variant="subtle"
              leftSection={<Trash2 size={12} aria-hidden="true" />}
              onClick={() => {
                setField("meta.ownerSubjectId", null);
                setField("meta.tags", []);
                setField("meta.memo", "");
              }}
              className="text-danger hover:bg-danger/10"
            >
              {t("quickCreate.completionRemoveLabel")}
            </Button>
          </div>
        </FormPanel>
      </section>
    </>
  );
}

// ============================================================
// Helper components
// ============================================================

function V4EssentialRow({
  icon: Icon,
  label,
  chip,
  clearable,
  onClear,
  onClick,
  editAria,
  clearAria,
  confirmClearAria,
  confirmClearLabel,
}: {
  icon: typeof Calendar;
  label: string;
  chip: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  onClick: () => void;
  editAria?: string;
  clearAria?: string;
  confirmClearAria?: string;
  confirmClearLabel?: string;
}) {
  const [armed, setArmed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tear down the auto-disarm timer on unmount so a navigated-away row
  // doesn't leave a dangling timeout that fires into a stale component.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  function disarm() {
    setArmed(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleClearClick() {
    if (!onClear) return;
    if (armed) {
      disarm();
      onClear();
    } else {
      setArmed(true);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setArmed(false);
      }, 4000);
    }
  }

  const canClear = Boolean(clearable && onClear);

  return (
    <div className="relative min-h-[48px]">
      <UnstyledButton
        onClick={onClick}
        aria-label={editAria ?? `${label} Edit`}
        className="group flex min-h-[48px] w-full items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-foreground-muted">
          <Icon size={14} />
        </div>
        <span className="w-[58px] shrink-0 select-none text-[11px] font-bold text-foreground-muted">
          {label}
        </span>
        <div className="min-w-0 flex-1 text-left">
          {chip}
        </div>
        <ChevronRight size={14} className="shrink-0 text-foreground-muted" />
      </UnstyledButton>
      {canClear ? (
        <div className="absolute right-8 top-1/2 -translate-y-1/2">
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClearClick();
            }}
            aria-label={armed ? (confirmClearAria ?? "Confirm") : (clearAria ?? "Clear selection")}
            data-armed={armed ? "true" : undefined}
            variant="subtle"
            size="xs"
            className={cn(
              "transition-colors",
              armed
                ? "animate-pulse bg-danger text-white hover:bg-danger/90"
                : "text-foreground-muted hover:bg-danger/15 hover:text-danger",
            )}
            onBlur={() => armed && disarm()}
          >
            {armed ? (
              <>
                <Check size={12} />
                {confirmClearLabel ?? "Confirm"}
              </>
            ) : (
              <X size={12} />
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}


