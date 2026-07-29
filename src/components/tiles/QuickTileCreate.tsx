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
  Modal,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  SimpleGrid,
  Stack,
  TagsInput,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  FolderOpen,
  Info,
  Layers,
  Link2,
  ListChecks,
  MessageSquare,
  Pencil,
  Play,
  Plus,
  Repeat,
  Search,
  SlidersHorizontal,
  Tag,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { defaultTerm } from "@/components/tiles/editor/ConditionEditor";
import { ConditionPanel } from "@/components/tiles/editor/ConditionPanel";
import { FieldRow } from "@/components/tiles/editor/FieldRow";
import { FlowSequencePanel } from "@/components/tiles/editor/FlowSequencePanel";
import { PlacementRulesPanel } from "@/components/tiles/editor/PlacementRulesPanel";
import { SEGMENT_STYLES } from "@/components/tiles/editor/panel-styles";
import { RelationPanel } from "@/components/tiles/editor/RelationPanel";
import { SchedulePanel } from "@/components/tiles/editor/SchedulePanel";
import { SourceGenerationPanel } from "@/components/tiles/editor/SourceGenerationPanel";
import { SourceWindowPanel } from "@/components/tiles/editor/SourceWindowPanel";
import { SubPanelShell } from "@/components/tiles/editor/SubPanelShell";
import { SubmitBar } from "@/components/tiles/editor/SubmitBar";
import { TileReferencePicker } from "@/components/tiles/editor/TileReferencePicker";
import { FormPanel, FormRow, SectionHeader } from "@/components/ui/form";
import { Textarea } from "@/components/ui/Input";
import { makeClient, submitCreateTile } from "@/lib/api/v1/submit";
import type { ConditionNode } from "@/lib/domain/v1/condition";
import {
  ConditionKind,
  PlanRole,
  type PlanRoleValue,
  TaskOrderRelation,
  TileKind,
} from "@/lib/domain/v1/constants";
import { uuidv7 } from "@/lib/domain/v1/envelope";
import type { Window } from "@/lib/domain/v1/window";
import { notifyEventsChanged } from "@/lib/hooks/calendar/use-events";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { createWorkspace, useProjects } from "@/lib/hooks/use-projects";
import { useTileList } from "@/lib/hooks/use-tile-list";
import { translations } from "@/lib/i18n/translations";
import { useTranslation } from "@/lib/i18n/use-translation";
import type { Locale } from "@/lib/stores/locale-store";
import {
  hasTaskOrderCycle,
  type RepeatChoice,
  useQuickCreateStore,
} from "@/lib/stores/quick-create-store";
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
  {
    key: "time",
    icon: Calendar,
    panel: "time" as const,
    titleKey: "quickCreate.intentNarrowTime",
    subKey: "quickCreate.intentNarrowTimeSub",
  },
  {
    key: "references",
    icon: Link2,
    panel: "references" as const,
    titleKey: "quickCreate.intentReferenceTile",
    subKey: "quickCreate.intentReferenceTileSub",
  },
  {
    key: "recurring",
    icon: Layers,
    panel: "recurring" as const,
    titleKey: "quickCreate.intentNestStructure",
    subKey: "quickCreate.intentNestStructureSub",
  },
  {
    key: "placement",
    icon: SlidersHorizontal,
    panel: "meta" as const,
    titleKey: "quickCreate.intentAdjustPlacement",
    subKey: "quickCreate.intentAdjustPlacementSub",
  },
  {
    key: "completion",
    icon: ListChecks,
    panel: "completion" as const,
    titleKey: "quickCreate.intentCombineConditions",
    subKey: "quickCreate.intentCombineConditionsSub",
  },
  {
    key: "addCompletion",
    icon: CheckCircle2,
    panel: "completion" as const,
    titleKey: "quickCreate.intentAddCompletion",
    subKey: "quickCreate.intentAddCompletionSub",
  },
  {
    key: "onSuccess",
    icon: Play,
    panel: "meta" as const,
    titleKey: "quickCreate.intentDefineOnSuccess",
    subKey: "quickCreate.intentDefineOnSuccessSub",
  },
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
  const addTask = useQuickCreateStore((s) => s.addTask);
  const removeTask = useQuickCreateStore((s) => s.removeTask);
  const setTaskField = useQuickCreateStore((s) => s.setTaskField);
  const mode = useQuickCreateStore((s) => s.mode);
  const _editingId = useQuickCreateStore((s) => s.editingId);
  const loadError = useQuickCreateStore((s) => s.loadError);
  const submitBlocked = useQuickCreateStore((s) => s.submitBlocked);

  const identity = useQuickCreateStore((s) => s.identity);
  const plan = useQuickCreateStore((s) => s.plan);
  const time = useQuickCreateStore((s) => s.time);
  const windows = useQuickCreateStore((s) => s.windows);
  const source = useQuickCreateStore((s) => s.source);
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
    | "source-rules"
    | "relations"
    | "flows"
    | "placement-rules"
    | "meta"
    | "task"
  >("base");
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
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
    () =>
      tiles.tiles
        .filter((tile) => tile.plan_id)
        .map((tile) => ({ value: tile.plan_id as string, label: tile.title || tile.id })),
    [tiles.tiles],
  );
  const taskPickerData = useMemo(
    () =>
      plan.completion.tasks.map((task) => ({
        value: task.id,
        label: task.content?.title?.trim() || task.id,
      })),
    [plan.completion.tasks],
  );
  const requirementPickerData = useMemo(
    () =>
      plan.completion.timeRequirements.map((tr, i) => {
        const min = tr.required.minMs;
        const minLabel = min === null || min === undefined ? "" : `${Math.round(min / 60000)}m`;
        const scopeLabel = tr.observation?.scope ?? "";
        const label = minLabel
          ? `${scopeLabel ? `${scopeLabel} · ` : ""}${minLabel} ${i + 1}`
          : `Time req ${i + 1}`;
        return { value: tr.id, label };
      }),
    [plan.completion.timeRequirements],
  );
  useEffect(() => {
    void refreshProjects();
  }, [refreshProjects]);
  const [_memoExpanded, setMemoExpanded] = useState(meta.memo.trim().length > 0);
  const submitState = useQuickCreateStore((s) => s.submitState);
  const setSubmitState = useQuickCreateStore((s) => s.setSubmitState);
  const submitBlockedReason = useQuickCreateStore((s) => s.submitBlockedReason);
  const getFieldError = useQuickCreateStore((s) => s.getFieldError);
  const setFieldErrors = useQuickCreateStore((s) => s.setFieldErrors);
  const setCanSubmitFromStore = useQuickCreateStore((s) => s.setCanSubmit);
  const setSubmitBlockedReasonFromStore = useQuickCreateStore((s) => s.setSubmitBlockedReason);
  const submitting = submitState.kind === "submitting";
  const serverError =
    submitState.kind === "error"
      ? { title: t("quickCreate.createError"), body: submitState.message }
      : null;
  const [invalidField, setInvalidField] = useState<"title" | null>(null);
  const [lastConditionTab, setLastConditionTab] = useState<string | null>(null);
  const [projectModalOpen, { open: openProjectModal, close: closeProjectModal }] =
    useDisclosure(false);
  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectSlug, setNewProjectSlug] = useState("");
  const [newProjectBusy, setNewProjectBusy] = useState(false);
  const [newProjectError, setNewProjectError] = useState<string | null>(null);
  const [referencePickerIndex, setReferencePickerIndex] = useState<number | null>(null);

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
      // Defer the open transition to a microtask so the state changes don't
      // run synchronously inside the effect body.
      const reset = () => {
        setMounted(true);
        setIsClosing(false);
      };
      if (typeof queueMicrotask === "function") queueMicrotask(reset);
      else Promise.resolve().then(reset);
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
    if (identity.externalId === null) {
      setField("identity.externalId", uuidv7());
    }
  }, [identity.externalId, setField]);

  // --- validity (must be before early return — refer to these below) ---
  const titleOk = identity.title.trim().length > 0;
  const spanHasStart = !!time.span.start;
  const spanHasEnd = !!time.span.end;
  const spanOrderValid = !spanHasStart || !spanHasEnd || time.span.end > time.span.start;
  const durationValid =
    plan.role === PlanRole.LABEL ||
    time.durationMinMax.minMs === null ||
    time.durationMinMax.maxMs === null ||
    time.durationMinMax.minMs <= time.durationMinMax.maxMs;
  const taskOrderValid = !hasTaskOrderCycle(plan.completion.tasks);
  const canSubmit = titleOk && spanOrderValid && durationValid && taskOrderValid && !submitBlocked;

  // --- field-level error sync ---
  useEffect(() => {
    const errors = new Map<string, string>();
    if (!titleOk) errors.set("identity.title", t("quickCreate.titleRequired"));
    if (!spanOrderValid) errors.set("time.span", t("quickCreate.invalidTemporalOrder"));
    if (!durationValid) errors.set("time.durationMinMax", t("quickCreate.invalidDurationRange"));
    setFieldErrors(errors);
    setCanSubmitFromStore(errors.size === 0 && !submitBlocked);
    setSubmitBlockedReasonFromStore(
      errors.size > 0 ? (errors.values().next().value ?? null) : (submitBlocked ? t("quickCreate.submitBlockedHint") : null),
    );
  }, [titleOk, spanOrderValid, durationValid, submitBlocked, t, setFieldErrors, setCanSubmitFromStore, setSubmitBlockedReasonFromStore]);

  if (!mounted) return null;

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
    setSubmitState({ kind: "idle" });
    setInvalidField(null);
    if (!titleOk) {
      setSubmitState({ kind: "error", reason: "validation", message: t("quickCreate.titleRequired") });
      setInvalidField("title");
      return;
    }
    if (!spanOrderValid) {
      setSubmitState({ kind: "error", reason: "validation", message: t("quickCreate.invalidTemporalOrder") });
      return;
    }
    if (!canSubmit) return;

    const client = makeClient();
    setSubmitState({ kind: "submitting" });
    await submitCreateTile({ client })
      .then((result) => {
        if (!result.ok) {
          throw new Error(
            `${t("quickCreate.createError")} (api:${result.error.kind}) ${result.error.message}`,
          );
        }
        setSubmitState({ kind: "success" });
        reset();
        setActivePanel("base");
        setMemoExpanded(false);
        notifyEventsChanged();
        close();
      })
      .catch((err: unknown) => {
        setSubmitState({
          kind: "error",
          reason: "api",
          message: err instanceof Error ? err.message : t("quickCreate.createError"),
        });
      });
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
      <section className={panelClass} aria-label={headingLabel} data-testid="quick-create-panel">
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
              <FieldRow
                label={t("quickCreate.titlePlaceholder")}
                htmlFor="tile-title-input"
                required
                error={getFieldError("identity.title")}
              >
                <TextInput
                  id="tile-title-input"
                  value={identity.title}
                  onChange={(e) => {
                    setField("identity.title", e.target.value);
                    if (invalidField === "title") setInvalidField(null);
                  }}
                  placeholder={t("quickCreate.titlePlaceholder")}
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
              </FieldRow>

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
                  testId="quick-create-duration"
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
                  testId="quick-create-repeat"
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
                        {recurring.repeatMode === "interval" ? (
                          <span className="text-foreground-muted">
                            ({recurring.intervalValue}
                            {recurring.intervalUnit === "min"
                              ? "min"
                              : recurring.intervalUnit === "hour"
                                ? "h"
                                : "d"}
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
                <V4EssentialRow
                  icon={SlidersHorizontal}
                  label="配置・分割"
                  chip={
                    <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-accent-soft px-2.5 text-xs font-bold text-accent-ink">
                      priority {source.priority}
                      {source.splitPolicy.kind === 1 ? " · split" : ""}
                    </span>
                  }
                  clearable={false}
                  onClick={() => setActivePanel("source-rules")}
                  editAria="配置・分割を編集"
                  clearAria=""
                  confirmClearAria=""
                  confirmClearLabel=""
                />
                <V4EssentialRow
                  icon={Link2}
                  label="Source関係"
                  chip={
                    source.relations.length === 0 ? (
                      <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-surface-1 px-2.5 text-xs font-bold text-foreground-muted">
                        {t("quickCreate.essentialsNotSet")}
                      </span>
                    ) : (
                      <span className="inline-flex h-[30px] items-center gap-1.5 truncate rounded-lg bg-accent-soft px-2.5 text-xs font-bold text-accent-ink">
                        {source.relations
                          .slice(0, 2)
                          .map((r) => r.referencedTitle || "—")
                          .join(" / ")}
                        {source.relations.length > 2 ? ` · +${source.relations.length - 2}` : ""}
                      </span>
                    )
                  }
                  clearable={false}
                  onClick={() => setActivePanel("relations")}
                  editAria="Source関係を編集"
                  clearAria=""
                  confirmClearAria=""
                  confirmClearLabel=""
                />
                <V4EssentialRow
                  icon={Layers}
                  label="条件駆動Flow"
                  chip={
                    source.flowSequences.length === 0 ? (
                      <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-surface-1 px-2.5 text-xs font-bold text-foreground-muted">
                        {t("quickCreate.essentialsNotSet")}
                      </span>
                    ) : (
                      <span className="inline-flex h-[30px] items-center gap-1.5 truncate rounded-lg bg-accent-soft px-2.5 text-xs font-bold text-accent-ink">
                        {`${source.flowSequences.length}${t("quickCreate.essentialsItemsUnit")}`}
                        {source.flowSequences[0]?.minimumGapMs
                          ? ` · ${Math.round(source.flowSequences[0].minimumGapMs / 60000)}m`
                          : ""}
                      </span>
                    )
                  }
                  clearable={false}
                  onClick={() => setActivePanel("flows")}
                  editAria="Flow sequenceを編集"
                  clearAria=""
                  confirmClearAria=""
                  confirmClearLabel=""
                />
                <V4EssentialRow
                  icon={SlidersHorizontal}
                  label="配置ルール"
                  chip={
                    plan.planning.placementRules.length === 0 ? (
                      <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg bg-surface-1 px-2.5 text-xs font-bold text-foreground-muted">
                        {t("quickCreate.essentialsNotSet")}
                      </span>
                    ) : (
                      <span className="inline-flex h-[30px] items-center gap-1.5 truncate rounded-lg bg-accent-soft px-2.5 text-xs font-bold text-accent-ink">
                        {`${plan.planning.placementRules.length}${t("quickCreate.essentialsItemsUnit")}`}
                        {plan.planning.placementRules[0]?.effect
                          ? ` · rank ${plan.planning.placementRules[0].rank}`
                          : ""}
                      </span>
                    )
                  }
                  clearable={false}
                  onClick={() => setActivePanel("placement-rules")}
                  editAria="配置ルールを編集"
                  clearAria=""
                  confirmClearAria=""
                  confirmClearLabel=""
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
                  {plan.completion.tasks.length === 0
                    ? t("quickCreate.completionAddHint")
                    : (() => {
                        const titles = plan.completion.tasks
                          .map((tk) => (tk.content?.title ?? "").trim())
                          .filter((t) => t.length > 0);
                        if (titles.length === 0) {
                          return t("quickCreate.completionTasksUnnamed");
                        }
                        const preview = titles.slice(0, 2).join(" / ");
                        const overflow = titles.length > 2 ? ` · +${titles.length - 2}` : "";
                        return `${preview}${overflow} ${t("quickCreate.completionSummaryTail")}`;
                      })()}
                </div>
                <div className="space-y-1.5">
                  {plan.completion.tasks.length === 0 ? (
                    <p
                      data-testid="quick-create-tasks-empty"
                      className="rounded-md bg-surface-1 px-2.5 py-3 text-center text-[10px] text-foreground-muted"
                    >
                      {t("quickCreate.taskNoTasksHint")}
                    </p>
                  ) : (
                    plan.completion.tasks.map((tk) => (
                      <div
                        key={tk.id}
                        data-testid="quick-create-task-row"
                        className="flex min-h-[32px] items-center gap-2 rounded-md border border-border/50 bg-surface-0 px-2 py-1 text-xs"
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border bg-surface-0" />
                        <TextInput
                          value={tk.content?.title ?? ""}
                          onChange={(e) => setTaskField(tk.id, "content.title", e.target.value)}
                          placeholder={t("quickCreate.taskUntitled")}
                          variant="unstyled"
                          size="xs"
                          className="min-w-0 flex-1"
                          styles={{ input: { padding: 0, height: 20, minHeight: 20 } }}
                        />
                        {tk.content?.note && (
                          <span
                            role="img"
                            aria-label={t("quickCreate.taskHasNote")}
                            title={t("quickCreate.taskHasNote")}
                            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded text-foreground-muted"
                          >
                            <MessageSquare size={10} aria-hidden="true" />
                          </span>
                        )}
                        {tk.order.length > 0 && (
                          <span
                            role="img"
                            aria-label={t("quickCreate.taskHasOrder", { count: tk.order.length })}
                            title={t("quickCreate.taskHasOrder", { count: tk.order.length })}
                            className="inline-flex h-4 shrink-0 items-center rounded bg-surface-1 px-1 text-[9px] font-semibold text-foreground-muted"
                          >
                            <Link2 size={9} aria-hidden="true" className="mr-0.5" />
                            {tk.order.length}
                          </span>
                        )}
                        <ActionIcon
                          type="button"
                          variant="subtle"
                          size="xs"
                          aria-label={t("quickCreate.taskEditAria")}
                          data-testid="quick-create-task-edit"
                          onClick={() => {
                            setEditingTaskId(tk.id);
                            setActivePanel("task");
                          }}
                        >
                          <ChevronRight size={12} />
                        </ActionIcon>
                      </div>
                    ))
                  )}
                  <Button
                    type="button"
                    variant="subtle"
                    size="xs"
                    leftSection={<Plus size={12} />}
                    onClick={() => {
                      const newId = addTask();
                      setEditingTaskId(newId);
                      setActivePanel("task");
                    }}
                    className="mt-1 text-foreground-muted"
                    data-testid="quick-create-task-add"
                  >
                    {t("quickCreate.taskAdd")}
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
                <strong className="text-xs font-semibold text-foreground">
                  {t("quickCreate.conditionHeading")}
                </strong>
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
        <SubmitBar
          canSubmit={canSubmit}
          blockedReason={
            submitBlockedReason ??
            (submitBlocked ? t("quickCreate.submitBlockedHint") : null)
          }
          isSubmitting={submitting}
          serverError={serverError}
          onClose={close}
          onSubmit={handleSubmit}
          submitLabel={t("quickCreate.commit")}
          cancelLabel={t("quickCreate.cancel")}
        />
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
      <SubPanelShell
        panelKey="intent"
        activeKey={activePanel}
        onClose={() => setActivePanel("base")}
        headingId="intent-heading"
        title={t("quickCreate.addConditionOrGroup")}
        description={t("quickCreate.intentSubTitle")}
        layout={isDesktop ? "drawer" : "sheet"}
      >
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
                  <Text size="xs" fw={600}>
                    {t(item.titleKey)}
                  </Text>
                  <Text size="10" c="var(--foreground-muted)">
                    {t(item.subKey)}
                  </Text>
                </div>
              </UnstyledButton>
            </Paper>
          ))}
          <Paper withBorder radius="md" opacity={0.5}>
            <div className="flex min-h-[64px] items-center gap-2.5 px-3 py-2">
              <Type size={14} className="shrink-0 text-foreground-muted" />
              <div className="min-w-0">
                <Text size="xs" fw={600}>
                  {t("quickCreate.intentTextCondition")}
                </Text>
                <Text size="10" c="var(--foreground-muted)">
                  {t("quickCreate.intentTextConditionSub")}
                </Text>
              </div>
            </div>
          </Paper>
        </SimpleGrid>
      </SubPanelShell>

      {/* ─── time sub-panel ─── */}
<SubPanelShell
        panelKey="time"
        activeKey={activePanel}
        onClose={() => setActivePanel("base")}
        headingId="time-heading"
        title={t("quickCreate.timeNavTitle")}
        description={t("quickCreate.timeNavSub")}
        layout={isDesktop ? "drawer" : "sheet"}
      >
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
      </SubPanelShell>

      {/* ─── duration sub-panel ─── */}
<SubPanelShell
        panelKey="duration"
        activeKey={activePanel}
        onClose={() => setActivePanel("base")}
        headingId="duration-heading"
        title={t("quickCreate.durationTitle")}
        description={t("quickCreate.durationSub")}
        layout={isDesktop ? "drawer" : "sheet"}
      >
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
                  } else if (value === "custom") {
                    const fallback = 30 * 60_000;
                    setField("time.durationMinMax.minMs", fallback);
                    setField("time.durationMinMax.maxMs", fallback);
                  }
                }}
                styles={SEGMENT_STYLES}
              />
            </div>

            {time.durationMinMax.minMs !== null && (
              <div className="mb-4">
                <FieldRow
                  label={t("quickCreate.durationInputLabel")}
                  htmlFor="tile-duration-input"
                  error={getFieldError("time.durationMinMax")}
                >
                  <NumberInput
                    id="tile-duration-input"
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
                    suffix={t("quickCreate.minutesUnit")}
                    styles={{ input: { backgroundColor: "var(--surface-2)" } }}
                  />
                </FieldRow>
              </div>
            )}
      </SubPanelShell>

      {/* ─── recurring sub-panel ─── */}
<SubPanelShell
        panelKey="recurring"
        activeKey={activePanel}
        onClose={() => setActivePanel("base")}
        headingId="recurring-heading"
        title={t("quickCreate.repeatChip")}
        layout={isDesktop ? "drawer" : "sheet"}
      >
            <SourceGenerationPanel recurring={recurring} setField={setField} locale={locale} t={t} />
      </SubPanelShell>

<SubPanelShell
        panelKey="source-rules"
        activeKey={activePanel}
        onClose={() => setActivePanel("base")}
        headingId="source-rules-heading"
        title={"配置・分割・ローカル日付"}
        layout={isDesktop ? "drawer" : "sheet"}
      >
            <SourceWindowPanel source={source} time={time} setField={setField} />
      </SubPanelShell>

<SubPanelShell
        panelKey="relations"
        activeKey={activePanel}
        onClose={() => setActivePanel("base")}
        headingId="relations-heading"
        title={"Source参照関係"}
        layout={isDesktop ? "drawer" : "sheet"}
      >
            <RelationPanel
              relations={source.relations}
              setRelations={(relations) => setField("source.relations", relations)}
            />
      </SubPanelShell>

<SubPanelShell
        panelKey="flows"
        activeKey={activePanel}
        onClose={() => setActivePanel("base")}
        headingId="flows-heading"
        title={"条件駆動Flow"}
        layout={isDesktop ? "drawer" : "sheet"}
      >
            <FlowSequencePanel
              flows={source.flowSequences}
              setFlows={(flowSequences) => setField("source.flowSequences", flowSequences)}
              t={t}
              tileOptions={tilePickerData}
              taskOptions={taskPickerData}
              requirementOptions={requirementPickerData}
            />
      </SubPanelShell>

<SubPanelShell
        panelKey="placement-rules"
        activeKey={activePanel}
        onClose={() => setActivePanel("base")}
        headingId="placement-rules-heading"
        title={"配置ルール"}
        layout={isDesktop ? "drawer" : "sheet"}
      >
            <PlacementRulesPanel
              rules={plan.planning.placementRules}
              setRules={(placementRules) => setField("plan.planning.placementRules", placementRules)}
              t={t}
              tileOptions={tilePickerData}
              taskOptions={taskPickerData}
              requirementOptions={requirementPickerData}
            />
      </SubPanelShell>

      {/* ─── references sub-panel ─── */}
<SubPanelShell
        panelKey="references"
        activeKey={activePanel}
        onClose={() => setActivePanel("base")}
        headingId="references-heading"
        title={t("quickCreate.referencesNavTitle")}
        layout={isDesktop ? "drawer" : "sheet"}
      >
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
                      <Button
                        type="button"
                        size="sm"
                        variant={hasTarget ? "light" : "filled"}
                        onClick={() => setReferencePickerIndex(i)}
                        leftSection={<Search size={14} aria-hidden="true" />}
                        data-testid={`reference-picker-trigger-${i}`}
                        aria-label={t("quickCreate.tilePickerPickAria")}
                        className="justify-start"
                        styles={{
                          root: {
                            backgroundColor: hasTarget
                              ? "var(--accent-soft, var(--surface-2))"
                              : "var(--surface-2)",
                            color: "var(--foreground)",
                          },
                        }}
                      >
                        {hasTarget ? ref.target.referenceId : t("quickCreate.referenceIdPlaceholder")}
                      </Button>
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
            <TileReferencePicker
              opened={referencePickerIndex !== null}
              onClose={() => setReferencePickerIndex(null)}
              onSelect={(tileId) => {
                if (referencePickerIndex === null) return;
                const idx = referencePickerIndex;
                const ref = plan.references[idx];
                if (!ref) return;
                const next = plan.references.slice();
                next[idx] = {
                  ...ref,
                  target: { ...ref.target, referenceId: tileId ?? null },
                };
                setField("plan.references", next);
              }}
              currentValue={
                referencePickerIndex !== null
                  ? (plan.references[referencePickerIndex]?.target.referenceId ?? null)
                  : null
              }
            />
          </FormPanel>
      </SubPanelShell>

      {/* ─── completion sub-panel ─── */}
<SubPanelShell
        panelKey="completion"
        activeKey={activePanel}
        onClose={() => setActivePanel("base")}
        headingId="completion-heading"
        title={t("quickCreate.completionNavTitle")}
        layout={isDesktop ? "drawer" : "sheet"}
      >
          <FormPanel>
            <SectionHeader icon={ListChecks} title={t("quickCreate.completionNavTitle")} />
            <ConditionPanel
              root={plan.completion.root}
              setField={setField}
              t={t}
              tileOptions={tilePickerData}
              taskOptions={taskPickerData}
              requirementOptions={requirementPickerData}
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
                    <Clock size={16} className="shrink-0 text-foreground-muted" aria-hidden="true" />
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
                        tr.required.minMs === null ? "" : Math.round((tr.required.minMs ?? 0) / 60000)
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
      </SubPanelShell>

      {/* ─── meta sub-panel ─── */}
<SubPanelShell
        panelKey="meta"
        activeKey={activePanel}
        onClose={() => setActivePanel("base")}
        headingId="meta-heading"
        title={t("quickCreate.metaNavTitle")}
        layout={isDesktop ? "drawer" : "sheet"}
      >
          <FormPanel>
            <SectionHeader icon={FolderOpen} title={t("quickCreate.metaNavTitle")} />
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
                <span>{t("quickCreate.organizeProject")}</span>
              </div>
              <div className="flex flex-col gap-2" data-testid="meta-project-catalog">
                <div className="flex items-center gap-1">
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
                    className="flex-1"
                    styles={{
                      input: { backgroundColor: "var(--surface-2)" },
                    }}
                  />
                  <ActionIcon
                    type="button"
                    variant="outline"
                    size="md"
                    radius="md"
                    aria-label={t("quickCreate.projectCreateLabel")}
                    data-testid="meta-project-create"
                    onClick={openProjectModal}
                  >
                    <Plus size={14} aria-hidden="true" />
                  </ActionIcon>
                </div>
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
      </SubPanelShell>

      {/* ─── task sub-panel ─── */}
<SubPanelShell
        panelKey="task"
        activeKey={activePanel}
        onClose={() => setActivePanel("base")}
        headingId="task-heading"
        title={t("quickCreate.taskDetailTitle")}
        description={t("quickCreate.taskDetailSub")}
        layout={isDesktop ? "drawer" : "sheet"}
      >
          <FormPanel>
            {(() => {
              const task = plan.completion.tasks.find((tk) => tk.id === editingTaskId);
              if (!task || !editingTaskId) {
                return (
                  <p className="text-xs text-foreground-muted">{t("quickCreate.taskNoTasksHint")}</p>
                );
              }
              const otherTasks = plan.completion.tasks.filter((tk) => tk.id !== task.id);
              const orderHasCycle = hasTaskOrderCycle(plan.completion.tasks);
              return (
                <div className="flex flex-col gap-4" data-testid="task-detail-panel">
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
                      {t("quickCreate.taskNoteLabel")}
                    </div>
                    <Textarea
                      value={task.content.note ?? ""}
                      onChange={(e) => setTaskField(task.id, "content.note", e.target.value || null)}
                      placeholder={t("quickCreate.taskNotePlaceholder")}
                      aria-label={t("quickCreate.taskNoteLabel")}
                      rows={4}
                      className="w-full resize-none border-0 bg-surface-1 p-2 text-sm focus:ring-0"
                    />
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
                      <span>{t("quickCreate.taskOrderSection")}</span>
                    </div>
                    {task.order.length === 0 ? (
                      <p className="rounded-md bg-surface-1 px-2.5 py-3 text-center text-[10px] text-foreground-muted">
                        {t("quickCreate.taskOrderEmpty")}
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {task.order.map((rule, i) => {
                          const targetTask = plan.completion.tasks.find(
                            (tk) => tk.id === rule.targetTaskId,
                          );
                          const targetTitle =
                            targetTask?.content.title || t("quickCreate.taskUntitled");
                          return (
                            <div
                              key={rule.id}
                              data-testid={`task-order-row-${i}`}
                              className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-surface-0 p-2"
                            >
                              <div className="flex items-center gap-2">
                                <Select
                                  aria-label={t("quickCreate.taskOrderTarget")}
                                  value={rule.targetTaskId}
                                  onChange={(value) => {
                                    if (!value) return;
                                    const next = task.order.slice();
                                    next[i] = { ...rule, targetTaskId: value };
                                    setTaskField(task.id, "order", next);
                                  }}
                                  data={otherTasks.map((tk) => ({
                                    value: tk.id,
                                    label: tk.content.title || t("quickCreate.taskUntitled"),
                                  }))}
                                  placeholder={t("quickCreate.taskOrderTargetPlaceholder")}
                                  size="xs"
                                  variant="filled"
                                  comboboxProps={{ withinPortal: true }}
                                  className="flex-1"
                                  styles={{ input: { backgroundColor: "var(--surface-2)" } }}
                                />
                                <ActionIcon
                                  type="button"
                                  variant="subtle"
                                  size="xs"
                                  aria-label={t("quickCreate.removeItem")}
                                  onClick={() => {
                                    const next = task.order.slice();
                                    next.splice(i, 1);
                                    setTaskField(task.id, "order", next);
                                  }}
                                  className="text-foreground-muted hover:text-danger"
                                >
                                  <Trash2 size={12} aria-hidden="true" />
                                </ActionIcon>
                              </div>
                              <SegmentedControl
                                fullWidth
                                size="xs"
                                radius="md"
                                withItemsBorders={false}
                                value={String(rule.relation)}
                                onChange={(value) => {
                                  const next = task.order.slice();
                                  next[i] = {
                                    ...rule,
                                    relation: Number(value) as
                                      | typeof TaskOrderRelation.BEFORE
                                      | typeof TaskOrderRelation.AFTER,
                                  };
                                  setTaskField(task.id, "order", next);
                                }}
                                data={[
                                  {
                                    value: String(TaskOrderRelation.BEFORE),
                                    label: t("quickCreate.referenceRelationBefore"),
                                  },
                                  {
                                    value: String(TaskOrderRelation.AFTER),
                                    label: t("quickCreate.referenceRelationAfter"),
                                  },
                                ]}
                                styles={SEGMENT_STYLES}
                              />
                              <p className="text-[10px] text-foreground-muted">
                                {rule.relation === TaskOrderRelation.BEFORE
                                  ? `${task.content.title || t("quickCreate.taskUntitled")} → ${targetTitle}`
                                  : `${targetTitle} → ${task.content.title || t("quickCreate.taskUntitled")}`}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <Button
                      type="button"
                      size="xs"
                      variant="default"
                      leftSection={<Plus size={12} aria-hidden="true" />}
                      onClick={() => {
                        const fallbackTarget = otherTasks[0]?.id ?? null;
                        if (!fallbackTarget) return;
                        const newRule = {
                          id: uuidv7(),
                          targetTaskId: fallbackTarget,
                          relation: TaskOrderRelation.BEFORE,
                          when: null,
                        };
                        setTaskField(task.id, "order", [...task.order, newRule]);
                      }}
                      data-testid="task-order-add"
                      disabled={otherTasks.length === 0}
                    >
                      {t("quickCreate.taskOrderAdd")}
                    </Button>
                    {orderHasCycle ? (
                      <p
                        role="alert"
                        data-testid="task-order-cycle"
                        className="rounded-md bg-danger/10 px-2 py-1 text-[10px] font-semibold text-danger"
                      >
                        {t("quickCreate.taskOrderCycle")}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex items-center gap-2 border-t border-border/40 pt-3">
                    <Button
                      type="button"
                      size="sm"
                      variant="subtle"
                      leftSection={<Trash2 size={12} aria-hidden="true" />}
                      onClick={() => {
                        removeTask(task.id);
                        setEditingTaskId(null);
                        setActivePanel("base");
                      }}
                      data-testid="task-remove"
                      className="text-danger hover:bg-danger/10"
                    >
                      {t("quickCreate.taskRemoveLabel")}
                    </Button>
                    <div className="flex-1" />
                    <Button
                      type="button"
                      size="sm"
                      variant="default"
                      leftSection={<X size={12} aria-hidden="true" />}
                      onClick={() => {
                        setEditingTaskId(null);
                        setActivePanel("base");
                      }}
                    >
                      {t("quickCreate.completionCancelLabel")}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="filled"
                      leftSection={<Check size={12} aria-hidden="true" />}
                      onClick={() => {
                        setEditingTaskId(null);
                        setActivePanel("base");
                      }}
                      data-testid="task-apply"
                    >
                      {t("quickCreate.referenceApplyLabel")}
                    </Button>
                  </div>
                </div>
              );
            })()}
          </FormPanel>
      </SubPanelShell>

      <Modal
        opened={projectModalOpen}
        onClose={() => {
          if (newProjectBusy) return;
          setNewProjectName("");
          setNewProjectSlug("");
          setNewProjectError(null);
          closeProjectModal();
        }}
        title={t("quickCreate.projectCreateModalTitle")}
        centered
        size="sm"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const trimmedName = newProjectName.trim();
            if (!trimmedName) {
              setNewProjectError(t("quickCreate.projectCreateNameRequired"));
              return;
            }
            if (newProjectBusy) return;
            setNewProjectBusy(true);
            setNewProjectError(null);
            void createWorkspace({
              display_name: trimmedName,
              slug: newProjectSlug.trim() || null,
              color: null,
              parent_subject_id: null,
            })
              .then(async (ws) => {
                await refreshProjects();
                setField("meta.ownerSubjectId", ws.id);
                setNewProjectName("");
                setNewProjectSlug("");
                closeProjectModal();
              })
              .catch((err: unknown) => {
                setNewProjectError((err as Error).message);
              })
              .finally(() => {
                setNewProjectBusy(false);
              });
          }}
          className="flex flex-col gap-3"
        >
          <TextInput
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.currentTarget.value)}
            placeholder={t("quickCreate.projectCreateNamePlaceholder")}
            maxLength={80}
            required
            disabled={newProjectBusy}
            data-testid="meta-project-create-name"
            label={t("quickCreate.projectCreateNameLabel")}
            size="sm"
          />
          <TextInput
            value={newProjectSlug}
            onChange={(e) => {
              const normalized = e.currentTarget.value.toLowerCase().replace(/[^a-z0-9-]/g, "-");
              setNewProjectSlug(normalized);
            }}
            placeholder={t("quickCreate.projectCreateSlugPlaceholder")}
            pattern="[a-z0-9-]+"
            maxLength={40}
            disabled={newProjectBusy}
            data-testid="meta-project-create-slug"
            label={t("quickCreate.projectCreateSlugLabel")}
            size="sm"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={newProjectBusy}
              onClick={() => {
                setNewProjectName("");
                setNewProjectSlug("");
                setNewProjectError(null);
                closeProjectModal();
              }}
              data-testid="meta-project-create-cancel"
            >
              {t("quickCreate.projectCreateCancelLabel")}
            </Button>
            <Button
              type="submit"
              size="sm"
              loading={newProjectBusy}
              data-testid="meta-project-create-submit"
            >
              {t("quickCreate.projectCreateSubmitLabel")}
            </Button>
          </div>
          {newProjectError && (
            <span className="text-[11px] text-status-danger">{newProjectError}</span>
          )}
        </form>
      </Modal>
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
  testId,
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
  testId?: string;
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
        data-testid={testId}
        className="group flex min-h-[48px] w-full items-center gap-2.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-foreground-muted">
          <Icon size={14} />
        </div>
        <span className="w-[58px] shrink-0 select-none text-[11px] font-bold text-foreground-muted">
          {label}
        </span>
        <div className="min-w-0 flex-1 text-left">{chip}</div>
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
