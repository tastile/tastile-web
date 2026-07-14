/**
 * QuickTileCreate — v1 構造エディタ.
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
 * Phase scope per HARNESS.md "Phase A: 核":
 *   Phase A (live): Tile.Base (Visual + Description) / Plan.role / Span /
 *     DurationRange / Window / Recurring.life / FrameRule kind picker
 *   Phase B (stub): Condition tree editor (completion.root, timeRequirements, tasks)
 *   Phase C (stub): Metrics / Flows / Candidates / ChangeSet conflicts
 *   Phase D (stub): DecisionRun / Session / InteractionTree / Delivery
 */

"use client";

import {
  type AlertCircle,
  Bell,
  Circle,
  MoreHorizontal,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Clock,
  Coffee,
  FileText,
  Flame,
  FolderOpen,
  GitBranch,
  Heart,
  Inbox,
  Info,
  Layers,
  Link2,
  ListChecks,
  MessageSquare,
  Palette,
  Play,
  Plus,
  Repeat,
  SlidersHorizontal,
  Settings2,
  Star,
  Tag,
  Trash2,
  Type,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Dropdown } from "@/components/ui/Dropdown";
import {
  FormDivider,
  FormPanel,
  FormRow,
  RowInput,
  RowSegmented,
  RowSubPanel,
  RowToggle,
  SectionHeader,
} from "@/components/ui/form";
import { Textarea } from "@/components/ui/Input";
import { AutomationPanel } from "@/components/tiles/editor/AutomationPanel";
import { SchedulePanel, ScheduleRow } from "@/components/tiles/editor/SchedulePanel";
import { makeClient } from "@/lib/api/v1/submit";
import {
  closePlacementCommand,
  createManualPlacementCommand,
  createRecurringCommand,
  setPlanCommand,
  updatePlacementSpanCommand,
  updateTileCommand,
} from "@/lib/api/v1/tile-commands";
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
import { useTranslation } from "@/lib/i18n/use-translation";
import { useQuickCreateStore, type RepeatChoice } from "@/lib/stores/quick-create-store";
import { cn } from "@/lib/utils/cn";

const PRESET_COLORS = [
  "#5e6ad2",
  "#0d8a72",
  "#c08a2b",
  "#c34141",
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#6b7280",
];

const AVAILABLE_ICONS = [
  { name: "FileText", icon: FileText },
  { name: "Clock", icon: Clock },
  { name: "Repeat", icon: Repeat },
  { name: "Tag", icon: Tag },
  { name: "Calendar", icon: Calendar },
  { name: "Palette", icon: Palette },
  { name: "CheckCircle2", icon: CheckCircle2 },
  { name: "Settings2", icon: Settings2 },
  { name: "MessageSquare", icon: MessageSquare },
  { name: "FolderOpen", icon: FolderOpen },
  { name: "Flame", icon: Flame },
  { name: "Inbox", icon: Inbox },
  { name: "Bell", icon: Bell },
  { name: "Coffee", icon: Coffee },
  { name: "Heart", icon: Heart },
  { name: "Star", icon: Star },
];

const TILE_KIND_OPTIONS: ReadonlyArray<{ value: TileKindValue; label: string }> = [
  { value: TileKind.PLACEMENT, label: "quickCreate.kindPlacement" },
  { value: TileKind.RECURRING, label: "quickCreate.kindRecurring" },
];

const _PLAN_ROLE_OPTIONS: ReadonlyArray<{ value: PlanRoleValue; label: string }> = [
  { value: PlanRole.EXECUTABLE, label: "quickCreate.roleExecutable" },
  { value: PlanRole.LABEL, label: "quickCreate.roleLabel" },
];

// Bit 0 = Sunday … bit 6 = Saturday (matches WindowEditor.weekdayMask convention).
const WEEKDAY_LABELS_SHORT: Record<"ja" | "en", readonly string[]> = {
  ja: ["日", "月", "火", "水", "木", "金", "土"],
  en: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
};

const REPEAT_MODE_LABEL_KEY: Record<RepeatChoice, string> = {
  once: "quickCreate.repeatOnce",
  daily: "quickCreate.repeatDaily",
  weekly: "quickCreate.repeatWeekly",
  interval: "quickCreate.repeatInterval",
  condition: "quickCreate.repeatCondition",
};

function localDateTimeToIso(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function isoToLocalDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localDateToIsoDate(value: string): string {
  return value ? `${value}T00:00:00.000Z` : "";
}

function isoToLocalDate(iso: string | null | undefined): string {
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
  locale: "ja" | "en",
  t: (key: string) => string,
): string {
  if (!iso) return t("tiles.notSet");
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return t("tiles.notSet");

  const weekdaysJa = ["日", "月", "火", "水", "木", "金", "土"];
  const weekdaysEn = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const monthsEn = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = date.getDay();
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");

  if (locale === "ja") {
    const dayStr = `${month}月${day}日 (${weekdaysJa[weekday]})`;
    return allDay ? dayStr : `${dayStr} ${hours}:${minutes}`;
  } else {
    const dayStr = `${monthsEn[date.getMonth()]} ${day} (${weekdaysEn[weekday]})`;
    return allDay ? dayStr : `${dayStr}, ${hours}:${minutes}`;
  }
}

function normalizeHexColor(value: string): string {
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
  const editingTileId = useQuickCreateStore((s) => s.editingTileId);
  const loadError = useQuickCreateStore((s) => s.loadError);
  const submitBlocked = useQuickCreateStore((s) => s.submitBlocked);

  const identity = useQuickCreateStore((s) => s.identity);
  const plan = useQuickCreateStore((s) => s.plan);
  const time = useQuickCreateStore((s) => s.time);
  const windows = useQuickCreateStore((s) => s.windows);
  const recurring = useQuickCreateStore((s) => s.recurring);
  const recurrence = useQuickCreateStore((s) => s.recurrence);
  const _advanced = useQuickCreateStore((s) => s.advanced);
  const meta = useQuickCreateStore((s) => s.meta);

  const isDesktop = useIsDesktop();
  const { t, locale } = useTranslation();

  const [allDay, setAllDay] = useState(false);
  const [visualOpen, setVisualOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<
    "base" | "intent" | "time" | "duration" | "recurring" | "references" | "completion" | "meta" | "behavior"
  >("base");
  const projects = useProjects();
  const actorSubjectId = useCurrentActorSubjectId();
  useEffect(() => {
    void projects.refresh();
  }, [projects.refresh]);
  const [intentPickerOpen, setIntentPickerOpen] = useState(false);
  const [_memoExpanded, setMemoExpanded] = useState(meta.memo.trim().length > 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<"title" | null>(null);
  const [taskMenuIndex, setTaskMenuIndex] = useState<number | null>(null);
  const taskMenuButtonRefs = useRef<Array<HTMLButtonElement | null>>([]);

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

  useEffect(() => {
    if (taskMenuIndex === null) return;
    const menuIndex = taskMenuIndex;
    function handlePointerDown(e: PointerEvent) {
      const target = e.target as Node;
      const anchor = taskMenuButtonRefs.current[menuIndex];
      if (anchor && anchor.contains(target)) return;
      const popover = document.getElementById("quick-create-task-menu");
      if (popover && popover.contains(target)) return;
      setTaskMenuIndex(null);
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setTaskMenuIndex(null);
    }
    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [taskMenuIndex]);

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
      if (subPanel && subPanel.contains(target)) return;
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
  const completionRootLabel = (() => {
    if (!completionRootNode) return t("quickCreate.completionNoRoot");
    switch (completionRootNode.kind) {
      case ConditionKind.ALL: return t("quickCreate.completionAll");
      case ConditionKind.ANY: return t("quickCreate.completionAny");
      case ConditionKind.NOT: return t("quickCreate.completionNot");
      case ConditionKind.TERM: return t("quickCreate.completionTerm");
      default: return t("quickCreate.completionNoRoot");
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
    setField("windows", windows.filter((_, i) => i !== index));
  }

  function updateWindow(index: number, updater: (current: Window) => Window) {
    setField("windows", windows.map((w, i) => (i === index ? updater(w) : w)));
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

    setSubmitting(true);
    try {
      if (mode === "edit" && editingId && identity.kind === TileKind.RECURRING) {
        const tileBody = {
          idempotency_key: crypto.randomUUID(),
          payload: {
            tile_id: editingId,
            title: identity.title,
            description: identity.description ?? null,
            color: identity.visual.color ?? null,
            icon: identity.visual.icon ?? null,
          },
        };
        const res = await fetch(`/api/proxy/v1/tiles/${editingId}/update`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(tileBody),
        });
        if (!res.ok) {
          const detail = await res.json().catch(() => null);
          const message = detail?.error ?? `HTTP ${res.status}`;
          throw new Error(`${t("quickCreate.updateError")} (api:v1) ${message}`);
        }
        const planRes = await setPlanCommand({
          client: makeClient(),
          tileId: editingId,
          role: plan.role,
          references: plan.references,
          completion: plan.completion,
          planning: plan.planning,
          metrics: plan.metrics,
          decisions: plan.decisions,
        });
        if (!planRes.ok) throw new Error(`${t("quickCreate.updateError")} (api:v1 stage:plan) ${planRes.error.message}`);
      } else if (mode === "edit" && editingId) {
        const startIso = time.span.start;
        let endIso = time.span.end;
        if (allDay && startIso) {
          const startDate = new Date(startIso);
          const dayStart = new Date(startDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);
          if (!endIso || new Date(endIso) <= startDate) endIso = dayEnd.toISOString();
        }
        if (!startIso || !endIso) throw new Error(`${t("quickCreate.updateError")} (api:v1) start/end required`);
        const tileUpdateRes = await updateTileCommand({
          client: makeClient(),
          tileId: editingTileId ?? editingId,
          title: identity.title,
          description: identity.description ?? null,
          color: identity.visual.color ?? null,
          icon: identity.visual.icon ?? null,
        });
        if (!tileUpdateRes.ok) throw new Error(`${t("quickCreate.updateError")} (api:v1 stage:tile) ${tileUpdateRes.error.message}`);
        if (!actorSubjectId) throw new Error("actorSubjectId required");
        const spanRes = await updatePlacementSpanCommand({
          client: makeClient(),
          placementId: editingId,
          start: startIso,
          end: endIso,
          ownerSubjectId: actorSubjectId,
          actorSubjectId: actorSubjectId,
        });
        if (!spanRes.ok) throw new Error(`${t("quickCreate.updateError")} (api:v1 stage:span) ${spanRes.error.message}`);
        const editPlacementTileId = editingTileId ?? editingId;
        const planRes = await setPlanCommand({
          client: makeClient(),
          tileId: editPlacementTileId,
          role: plan.role,
          references: plan.references,
          completion: plan.completion,
          planning: plan.planning,
          metrics: plan.metrics,
          decisions: plan.decisions,
        });
        if (!planRes.ok) throw new Error(`${t("quickCreate.updateError")} (api:v1 stage:plan) ${planRes.error.message}`);
      } else if (identity.kind === TileKind.RECURRING) {
        const startIso = time.span.start;
        let endIso = time.span.end;
        if (allDay && startIso) {
          const startDate = new Date(startIso);
          const dayStart = new Date(startDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);
          if (!endIso || new Date(endIso) <= startDate) endIso = dayEnd.toISOString();
        }
        if (!startIso || !endIso) throw new Error(`${t("quickCreate.createError")} (api:v1) start/end required`);
        const windowMask = recurrence?.window?.weekday_mask ?? 0;
        const weeklyV1Mask = (() => {
          let v1 = 0;
          for (let i = 0; i < 7; i++) {
            if ((windowMask & (1 << i)) !== 0) {
              const v1Bit = (i + 6) % 7;
              v1 |= 1 << v1Bit;
            }
          }
          return v1;
        })();
        const timeOfDay = (() => {
          const w = recurrence?.window;
          if (!w) return undefined;
          const toHHMM = (mins: number) => {
            const clamped = ((Math.floor(mins) % 1440) + 1440) % 1440;
            const h = Math.floor(clamped / 60);
            const m = clamped % 60;
            return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
          };
          const start = toHHMM(w.start_offset_min);
          const end = toHHMM(w.end_offset_min);
          if (start === end) return undefined;
          return { start, end };
        })();
        const recurrencePattern = weeklyV1Mask !== 0 ? ({ kind: "weekly", weekdays: weeklyV1Mask } as const) : undefined;
        const recurringRes = await createRecurringCommand({
          client: makeClient(),
          title: identity.title,
          description: identity.description ?? null,
          color: identity.visual.color,
          icon: identity.visual.icon,
          start: startIso,
          end: endIso,
          stepMs: 86_400_000,
          planRole: plan.role,
          pattern: recurrencePattern,
          timeOfDay,
          occurrences: 14,
        });
        if (!recurringRes.ok) throw new Error(`${t("quickCreate.createError")} (api:v1 stage:${recurringRes.stage}) ${recurringRes.error.message}`);
        const planRes = await setPlanCommand({
          client: makeClient(),
          tileId: recurringRes.tileId,
          role: plan.role,
          references: plan.references,
          completion: plan.completion,
          planning: plan.planning,
          metrics: plan.metrics,
          decisions: plan.decisions,
        });
        if (!planRes.ok) throw new Error(`${t("quickCreate.createError")} (api:v1 stage:plan) ${planRes.error.message}`);
      } else {
        const startIso = time.span.start;
        let endIso = time.span.end;
        if (allDay && startIso) {
          const startDate = new Date(startIso);
          const dayStart = new Date(startDate);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(dayStart);
          dayEnd.setDate(dayEnd.getDate() + 1);
          if (!endIso || new Date(endIso) <= startDate) endIso = dayEnd.toISOString();
        }
        if (!startIso || !endIso) throw new Error(`${t("quickCreate.createError")} (api:v1) start/end required`);
        const res = await createManualPlacementCommand({
          client: makeClient(),
          title: identity.title,
          description: identity.description ?? null,
          color: identity.visual.color ?? null,
          icon: identity.visual.icon ?? null,
          start: startIso,
          end: endIso,
          planRole: plan.role,
        });
        if (!res.ok) throw new Error(`${t("quickCreate.createError")} (api:v1 stage:${res.stage}) ${res.error.message}`);
        const planRes = await setPlanCommand({
          client: makeClient(),
          tileId: res.tileId,
          role: plan.role,
          references: plan.references,
          completion: plan.completion,
          planning: plan.planning,
          metrics: plan.metrics,
          decisions: plan.decisions,
        });
        if (!planRes.ok) throw new Error(`${t("quickCreate.createError")} (api:v1 stage:plan) ${planRes.error.message}`);
      }

      reset();
      setAllDay(false);
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

  async function handleDelete() {
    if (mode !== "edit" || !editingId) return;
    const confirmed = typeof window !== "undefined" ? window.confirm(t("quickCreate.confirmDelete")) : true;
    if (!confirmed) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await closePlacementCommand({ client: makeClient(), placementId: editingId });
      if (!res.ok) throw new Error(`${t("quickCreate.deleteError")} (api:v1) ${res.error.message}`);
      reset();
      setAllDay(false);
      setActivePanel("base");
      setMemoExpanded(false);
      notifyEventsChanged();
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("quickCreate.deleteError"));
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

  const subPanelClass = (panel: "intent" | "time" | "duration" | "recurring" | "references" | "completion" | "meta" | "behavior") =>
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
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-foreground text-background">
            <Layers className="h-4 w-4" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="block truncate text-[15px] font-semibold leading-tight text-foreground">
              {headingLabel}
            </h2>
            <p className="block truncate text-xs text-foreground-muted">
              {mode === "edit" ? t("quickCreate.subtitleEdit") : t("quickCreate.subtitleCreate")}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => {/* schema view — placeholder */}}
              className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-surface-0 px-3 text-xs font-semibold text-foreground-muted hover:bg-surface-1"
            >
              <GitBranch className="h-3.5 w-3.5" aria-hidden />
              <span>{t("quickCreate.schemaTitle")}</span>
            </button>
            <button
              type="button"
              onClick={close}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-surface-0 text-foreground-muted transition-colors hover:bg-surface-1 hover:text-foreground"
              aria-label={t("tiles.closePanel")}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* ─── composer body ─── */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-[640px]">
              {/* ── main card ── */}
              <section className="py-2">
                {/* title input */}
                <input
                  type="text"
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
                  className="w-full border-0 bg-transparent pb-3 text-2xl font-bold tracking-tight text-foreground placeholder:text-foreground-muted focus:outline-hidden"
                />

                {/* organize row: project + tags + add button */}
                <div className="flex flex-wrap items-center gap-1.5 pb-3" data-testid="quick-create-organize-row">
                  {currentProject && (
                    <button
                      type="button"
                      onClick={() => setActivePanel("meta")}
                      className="inline-flex h-[29px] items-center gap-1.5 rounded-lg border border-[#d9e5f3] bg-[#eef3fb] px-2.5 text-[11px] font-bold text-[#37689e] hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <FolderOpen className="h-3 w-3" aria-hidden />
                      <span>{currentProject.display_name}</span>
                    </button>
                  )}
                  {meta.tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setActivePanel("meta")}
                      className="inline-flex h-[29px] items-center gap-1.5 rounded-lg border border-[#e1dbf5] bg-[#f2effc] px-2.5 text-[11px] font-bold text-[#6754a8] hover:opacity-90 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <Tag className="h-3 w-3" aria-hidden />
                      <span>#{tag}</span>
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setActivePanel("meta")}
                    className="inline-flex h-[29px] items-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-0 px-2.5 text-[11px] font-bold text-foreground-muted hover:bg-surface-2 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <Plus className="h-3 w-3" aria-hidden />
                    <span>{t("quickCreate.metaExpandLabel") || "整理"}</span>
                  </button>
                </div>

                {/* tile kind selector */}
                <RowSegmented
                  icon={CheckCircle2}
                  data-testid="quick-create-tile-kind"
                  options={TILE_KIND_OPTIONS.map((opt) => ({
                    value: String(opt.value),
                    label: t(opt.label),
                  }))}
                  value={String(identity.kind)}
                  onChange={(value) => {
                    const next = Number(value) as TileKindValue;
                    setField("identity.kind", next);
                  }}
                />

                {/* ─── essentials ─── */}
                <div className="pt-2" data-testid="quick-create-essentials">
                  <hr className="border-border mb-2" />
                  <V4EssentialRow
                    icon={Calendar}
                    label={t("quickCreate.timeNavTitle")}
                    chip={
                      time.span.start || time.span.end ? (
                        <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-2.5 text-xs font-bold text-accent-ink">
                          {allDay
                            ? formatDisplayDate(time.span.start, true, locale, t)
                            : `${time.span.start ? formatDisplayDate(time.span.start, false, locale, t) : t("quickCreate.spanUnset")} → ${time.span.end ? formatDisplayDate(time.span.end, false, locale, t) : t("quickCreate.spanUnset")}`}
                        </span>
                      ) : (
                        <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-dashed border-line bg-surface-0 px-2.5 text-xs font-bold text-foreground-muted">
                          {t("tiles.notSet")}
                        </span>
                      )
                    }
                    clearable={Boolean(time.span.start || time.span.end)}
                    onClear={() => {
                      setField("time.span.start", "");
                      setField("time.span.end", "");
                    }}
                    onClick={() => setActivePanel("time")}
                  />
                  <V4EssentialRow
                    icon={Clock}
                    label={t("quickCreate.duration")}
                    chip={
                      time.durationMinMax.minMs !== null || time.durationMinMax.maxMs !== null ? (
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-accent/40 bg-accent-soft px-2.5 text-xs font-bold text-accent-ink">
                            {time.durationMinMax.minMs !== null
                              ? `${Math.round(time.durationMinMax.minMs / 60000)}分`
                              : "—"}
                            {time.durationMinMax.maxMs !== null
                              ? ` – ${Math.round(time.durationMinMax.maxMs / 60000)}分`
                              : ""}
                          </span>
                          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-foreground-muted">
                            <Link2 size={10} aria-hidden="true" />
                            {t("quickCreate.durationLinkedNote")}
                          </span>
                        </span>
                      ) : (
                        <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-dashed border-line bg-surface-0 px-2.5 text-xs font-bold text-foreground-muted">
                          {t("tiles.notSet")}
                        </span>
                      )
                    }
                    clearable={time.durationMinMax.minMs !== null || time.durationMinMax.maxMs !== null}
                    onClear={() => {
                      setField("time.durationMinMax.minMs", null);
                      setField("time.durationMinMax.maxMs", null);
                    }}
                    onClick={() => setActivePanel("duration")}
                  />
                  <V4EssentialRow
                    icon={Repeat}
                    label={t("quickCreate.repeatChip")}
                    chip={
                      <span className="inline-flex h-[30px] items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-2.5 text-xs font-bold text-foreground">
                        <span>{t(REPEAT_MODE_LABEL_KEY[recurring.repeatMode])}</span>
                        {recurring.repeatMode === "weekly" && recurring.weekdayMask > 0 ? (
                          <span className="text-foreground-muted">
                            ({WEEKDAY_LABELS_SHORT[locale].filter((_, i) => (recurring.weekdayMask & (1 << i)) !== 0).join(", ")})
                          </span>
                        ) : null}
                        {recurring.repeatMode !== "once" && recurring.repeatMode !== "condition" && recurring.endDate ? (
                          <span className="text-foreground-muted">~ {recurring.endDate.slice(0, 10)}</span>
                        ) : null}
                      </span>
                    }
                    onClick={() => setActivePanel("recurring")}
                  />
                </div>

                {/* ─── tasks block ─── */}
                <div className="pt-3">
                  <hr className="border-border mb-3" />
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
                    <ListChecks size={14} aria-hidden="true" />
                    <span>{t("quickCreate.completionRequires")}</span>
                    <button
                      type="button"
                      onClick={() => setActivePanel("completion")}
                      aria-label={t("quickCreate.completionRequires")}
                      className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-1 hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <ChevronRight size={14} aria-hidden="true" />
                    </button>
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
                        className="flex min-h-[38px] items-center gap-2 rounded-lg border border-border bg-surface-0 px-2.5 py-1.5 text-xs"
                      >
                        <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border border-border bg-surface-0" />
                        <span
                          className={
                            tk.content?.title
                              ? "min-w-0 flex-1 truncate text-foreground"
                              : "min-w-0 flex-1 truncate text-foreground-muted"
                          }
                        >
                          {tk.content?.title || t("quickCreate.taskUntitled")}
                        </span>
                        <button
                          type="button"
                          ref={(el) => {
                            taskMenuButtonRefs.current[i] = el;
                          }}
                          onClick={() =>
                            setTaskMenuIndex((prev) => (prev === i ? null : i))
                          }
                          aria-label={t("quickCreate.taskMoreAria")}
                          aria-haspopup="menu"
                          aria-expanded={taskMenuIndex === i}
                          title={t("quickCreate.taskMoreTitle")}
                          className={cn(
                            "flex h-6 w-6 items-center justify-center rounded-md focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                            taskMenuIndex === i
                              ? "bg-surface-2 text-foreground"
                              : "text-foreground-muted hover:bg-surface-1 hover:text-foreground",
                          )}
                        >
                          <MoreHorizontal size={14} aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
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
                      className="mt-2 flex h-[35px] w-full items-center justify-center rounded-lg border border-dashed border-border bg-surface-0 text-xs font-bold text-foreground-muted hover:bg-surface-1"
                    >
                      ＋ タスクを追加
                    </button>
                    {taskMenuIndex !== null && plan.completion.tasks[taskMenuIndex] ? (
                      <TaskRowMenu
                        anchor={taskMenuButtonRefs.current[taskMenuIndex] ?? null}
                        index={taskMenuIndex}
                        total={plan.completion.tasks.length}
                        onClose={() => setTaskMenuIndex(null)}
                        onMove={(dir) => {
                          const j = taskMenuIndex;
                          const target = dir === "up" ? j - 1 : j + 1;
                          if (target < 0 || target >= plan.completion.tasks.length) return;
                          const next = plan.completion.tasks.slice();
                          const [moved] = next.splice(j, 1);
                          next.splice(target, 0, moved);
                          setField("plan.completion.tasks", next);
                          setTaskMenuIndex(target);
                        }}
                        onDelete={() => {
                          const next = plan.completion.tasks.slice();
                          next.splice(taskMenuIndex, 1);
                          setField("plan.completion.tasks", next);
                          setTaskMenuIndex(null);
                        }}
                        t={t}
                      />
                    ) : null}
                  </div>
                </div>

                {/* ─── behavior block ─── */}
                <div className="mt-3 pt-3" data-testid="quick-create-behavior-block">
                  <hr className="border-border mb-3" />
                  <div className="mb-2 flex items-baseline justify-between">
                    <strong className="text-xs font-semibold text-foreground">
                      {t("quickCreate.behaviorTitle")}
                    </strong>
                    <small className="text-[10px] text-foreground-muted">
                      {t("quickCreate.behaviorSub")}
                    </small>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActivePanel("meta")}
                    aria-label={t("quickCreate.behaviorEdit")}
                    className="flex w-full min-h-[48px] items-center gap-2 rounded-lg border border-border bg-surface-0 px-2.5 py-2 text-left hover:bg-surface-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg bg-surface-2 text-foreground-muted">
                      {plan.role === PlanRole.LABEL ? (
                        <Tag className="h-3.5 w-3.5" aria-hidden />
                      ) : (
                        <Play className="h-3.5 w-3.5" aria-hidden />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold text-foreground">
                        {plan.role === PlanRole.LABEL
                          ? t("quickCreate.behaviorLabel")
                          : t("quickCreate.behaviorExecutable")}
                      </div>
                      <div className="text-[10px] text-foreground-muted">
                        {plan.role === PlanRole.LABEL
                          ? t("quickCreate.behaviorLabelSub")
                          : t("quickCreate.behaviorExecutableSub")}
                      </div>
                    </div>
                    <span className="rounded-md border border-border bg-surface-0 px-2 py-1 text-[10px] font-bold text-foreground-muted">
                      {t("quickCreate.behaviorEdit")}
                    </span>
                  </button>
                </div>
              </section>

              {/* ── condition card ── */}
              <section className="pt-3">
                <hr className="border-border mb-3" />
                <div className="flex items-center justify-between mb-2">
                  <strong className="text-xs font-semibold text-foreground">条件の組み合わせ</strong>
                  <span className="text-[10px] text-foreground-muted">
                    {conditionCount}
                  </span>
                </div>
                <div className="p-2.5" data-testid="quick-create-condition-tree">
                  {windows.length + recurring.frameRules.length === 0 ? (
                    <p
                      data-testid="quick-create-condition-empty"
                      className="rounded-md border border-dashed border-border bg-surface-0 px-2.5 py-3 text-center text-[10px] text-foreground-muted"
                    >
                      {t("quickCreate.conditionEmpty")}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {windows.length > 0 && (
                        <div className="rounded-lg bg-surface-1 px-2 py-1.5">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                              ALL
                            </span>
                            <strong className="text-[11px] font-semibold text-foreground">
                              {t("quickCreate.conditionGroupWindow")}
                            </strong>
                            <button
                              type="button"
                              onClick={() => setActivePanel("time")}
                              className="ml-auto text-[10px] font-bold text-foreground-muted hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              編集
                            </button>
                          </div>
                          <div className="space-y-1">
                            {windows.map((w, i) => (
                              <div
                                key={w.id ?? i}
                                className="flex items-center gap-2 rounded bg-surface-0 px-2 py-1 text-[11px]"
                              >
                                <Clock size={11} className="shrink-0 text-primary" aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate text-foreground">
                                  {w.bounds.start && w.bounds.end
                                    ? `${w.bounds.start} → ${w.bounds.end}`
                                    : t("quickCreate.conditionWindowOpen")}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = windows.filter((_, idx) => idx !== i);
                                    setField("windows", next);
                                  }}
                                  aria-label={t("quickCreate.removeItem")}
                                  className="flex h-5 w-5 items-center justify-center rounded text-foreground-muted hover:text-danger"
                                >
                                  <MoreHorizontal size={12} aria-hidden="true" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {recurring.frameRules.length > 0 && (
                        <div className="rounded-lg bg-surface-1 px-2 py-1.5">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[10px] font-bold text-primary">
                              ALL
                            </span>
                            <strong className="text-[11px] font-semibold text-foreground">
                              {t("quickCreate.conditionGroupFrame")}
                            </strong>
                            <button
                              type="button"
                              onClick={() => setActivePanel("recurring")}
                              className="ml-auto text-[10px] font-bold text-foreground-muted hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                            >
                              編集
                            </button>
                          </div>
                          <div className="space-y-1">
                            {recurring.frameRules.map((r, i) => (
                              <div
                                key={r.id ?? i}
                                className="flex items-center gap-2 rounded bg-surface-0 px-2 py-1 text-[11px]"
                              >
                                <Repeat size={11} className="shrink-0 text-primary" aria-hidden="true" />
                                <span className="min-w-0 flex-1 truncate text-foreground">
                                  {r.generator?.kind === "step"
                                    ? t("quickCreate.conditionFrameStep")
                                    : t("quickCreate.conditionFrameOpen")}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    const next = recurring.frameRules.filter((_, idx) => idx !== i);
                                    setField("recurring.frameRules", next);
                                  }}
                                  aria-label={t("quickCreate.removeItem")}
                                  className="flex h-5 w-5 items-center justify-center rounded text-foreground-muted hover:text-danger"
                                >
                                  <MoreHorizontal size={12} aria-hidden="true" />
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setActivePanel("intent")}
                  data-testid="quick-create-condition-add"
                  className="mx-2.5 mb-2.5 flex h-10 w-[calc(100%-20px)] items-center justify-center gap-1.5 rounded-lg border border-dashed border-border bg-surface-0 text-[11px] font-bold text-foreground-muted hover:bg-surface-1"
                >
                  <><Plus size={14} aria-hidden="true" />{t("quickCreate.addConditionOrGroup")}</>
                </button>
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
        <div className="flex h-[62px] shrink-0 items-center justify-between border-t border-border bg-surface-0 px-4">
          <div className="flex items-center gap-2 text-[11px] text-foreground-muted">
            <span className="h-[7px] w-[7px] rounded-full bg-green-500" />
            <span id="validationText">{t("quickCreate.validationOk") || "作成できます"}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="h-[37px] rounded-lg border border-border bg-surface-0 px-3 text-xs font-semibold text-foreground-muted hover:bg-surface-1"
            >
              下書き保存
            </button>
            <Button
              type="button"
              variant="primary"
              size="large"
              data-testid="quick-create-submit"
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitting || !canSubmit || !titleOk || !spanOrderValid || submitBlocked}
              className="h-10 bg-foreground text-background hover:bg-foreground/90"
            >
              {submitting ? t("quickCreate.saving") : t("quickCreate.commit")}
            </Button>
          </div>
        </div>
        {error ? <p className="px-4 pb-2 text-center text-xs text-danger">{error}</p> : null}
        {loadError ? (
          <p role="alert" data-testid="quick-create-load-error" className="px-4 pb-2 text-center text-xs text-warning">
            {loadError}
          </p>
        ) : null}
      </section>

      {/* ─── intent sub-panel ─── */}
      <section data-subpanel="intent" className={subPanelClass("intent")} aria-hidden={activePanel !== "intent"}>
        <div className="flex h-[62px] items-center gap-2 border-b border-border px-3 shrink-0 bg-surface-0">
          <button type="button" onClick={() => setActivePanel("base")} className="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-1">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <strong className="block truncate text-sm font-semibold">{t("quickCreate.addConditionOrGroup")}</strong>
            <small className="block truncate text-[10px] text-foreground-muted">{t("quickCreate.intentSubTitle")}</small>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <p className="mb-3 text-[11px] text-foreground-muted">{t("quickCreate.intentDescription")}</p>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setActivePanel("time")} className="flex min-h-[91px] flex-col items-start rounded-[10px] border border-border bg-surface-0 p-3 text-left hover:bg-surface-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary">
              <Calendar size={16} className="mb-1.5 text-primary" aria-hidden="true" />
              <strong className="mb-0.5 text-xs font-semibold">{t("quickCreate.intentNarrowTime")}</strong>
              <small className="text-[10px] text-foreground-muted">{t("quickCreate.intentNarrowTimeSub")}</small>
            </button>
            <button type="button" onClick={() => setActivePanel("references")} className="flex min-h-[91px] flex-col items-start rounded-[10px] border border-border bg-surface-0 p-3 text-left hover:bg-surface-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary">
              <Link2 size={16} className="mb-1.5 text-primary" aria-hidden="true" />
              <strong className="mb-0.5 text-xs font-semibold">{t("quickCreate.intentReferenceTile")}</strong>
              <small className="text-[10px] text-foreground-muted">{t("quickCreate.intentReferenceTileSub")}</small>
            </button>
            <button type="button" onClick={() => setActivePanel("recurring")} className="flex min-h-[91px] flex-col items-start rounded-[10px] border border-border bg-surface-0 p-3 text-left hover:bg-surface-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary">
              <Layers size={16} className="mb-1.5 text-primary" aria-hidden="true" />
              <strong className="mb-0.5 text-xs font-semibold">{t("quickCreate.intentNestStructure")}</strong>
              <small className="text-[10px] text-foreground-muted">{t("quickCreate.intentNestStructureSub")}</small>
            </button>
            <button type="button" onClick={() => setActivePanel("meta")} className="flex min-h-[91px] flex-col items-start rounded-[10px] border border-border bg-surface-0 p-3 text-left hover:bg-surface-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary">
              <SlidersHorizontal size={16} className="mb-1.5 text-primary" aria-hidden="true" />
              <strong className="mb-0.5 text-xs font-semibold">{t("quickCreate.intentAdjustPlacement")}</strong>
              <small className="text-[10px] text-foreground-muted">{t("quickCreate.intentAdjustPlacementSub")}</small>
            </button>
            <button type="button" onClick={() => setActivePanel("completion")} className="flex min-h-[91px] flex-col items-start rounded-[10px] border border-border bg-surface-0 p-3 text-left hover:bg-surface-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary">
              <ListChecks size={16} className="mb-1.5 text-primary" aria-hidden="true" />
              <strong className="mb-0.5 text-xs font-semibold">{t("quickCreate.intentCombineConditions")}</strong>
              <small className="text-[10px] text-foreground-muted">{t("quickCreate.intentCombineConditionsSub")}</small>
            </button>
            <button type="button" onClick={() => setActivePanel("completion")} className="flex min-h-[91px] flex-col items-start rounded-[10px] border border-border bg-surface-0 p-3 text-left hover:bg-surface-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary">
              <CheckCircle2 size={16} className="mb-1.5 text-primary" aria-hidden="true" />
              <strong className="mb-0.5 text-xs font-semibold">{t("quickCreate.intentAddCompletion")}</strong>
              <small className="text-[10px] text-foreground-muted">{t("quickCreate.intentAddCompletionSub")}</small>
            </button>
            <button type="button" onClick={() => setActivePanel("meta")} className="flex min-h-[91px] flex-col items-start rounded-[10px] border border-border bg-surface-0 p-3 text-left hover:bg-surface-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary">
              <Play size={16} className="mb-1.5 text-primary" aria-hidden="true" />
              <strong className="mb-0.5 text-xs font-semibold">{t("quickCreate.intentDefineOnSuccess")}</strong>
              <small className="text-[10px] text-foreground-muted">{t("quickCreate.intentDefineOnSuccessSub")}</small>
            </button>
            <button type="button" disabled className="flex min-h-[91px] flex-col items-start rounded-[10px] border border-border bg-surface-0 p-3 text-left opacity-60">
              <Type size={16} className="mb-1.5" aria-hidden="true" />
              <strong className="mb-0.5 text-xs font-semibold">{t("quickCreate.intentTextCondition")}</strong>
              <small className="text-[10px] text-foreground-muted">{t("quickCreate.intentTextConditionSub")}</small>
            </button>
          </div>
        </div>
      </section>

      {/* ─── time sub-panel ─── */}
      <section data-subpanel="time" className={subPanelClass("time")} aria-hidden={activePanel !== "time"}>
        <div className="flex h-[62px] items-center gap-2 border-b border-border px-3 shrink-0 bg-surface-0">
          <button type="button" onClick={() => setActivePanel("base")} className="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-1">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <strong className="block truncate text-sm font-semibold">{t("quickCreate.timeNavTitle")}</strong>
            <small className="block truncate text-[10px] text-foreground-muted">{t("quickCreate.timeNavSub")}</small>
          </div>
        </div>
        <FormPanel>
          <SchedulePanel
            allDay={allDay}
            setAllDay={setAllDay}
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
      <section data-subpanel="duration" className={subPanelClass("duration")} aria-hidden={activePanel !== "duration"}>
        <div className="flex h-[62px] items-center gap-2 border-b border-border px-3 shrink-0 bg-surface-0">
          <button type="button" onClick={() => setActivePanel("base")} className="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-1">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <strong className="block truncate text-sm font-semibold">{t("quickCreate.durationTitle")}</strong>
            <small className="block truncate text-[10px] text-foreground-muted">{t("quickCreate.durationSub")}</small>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <button
            type="button"
            onClick={() => { setField("time.durationMinMax.minMs", null); setField("time.durationMinMax.maxMs", null); }}
            className={cn(
              "mb-4 flex w-full items-center gap-3 rounded-xl border bg-surface-0 p-3 text-left transition-colors",
              time.durationMinMax.minMs === null && time.durationMinMax.maxMs === null
                ? "border-primary"
                : "border-border hover:bg-surface-1"
            )}
          >
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-foreground-muted" />
            <div>
              <strong className="block text-sm font-semibold">{t("quickCreate.durationNoneTitle")}</strong>
              <small className="block text-[10px] text-foreground-muted">{t("quickCreate.durationNoneSub")}</small>
            </div>
          </button>

          <div className="mb-4">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-wide text-foreground-muted">{t("quickCreate.durationInputLabel")}</div>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => { const cur = time.durationMinMax.minMs ?? 90 * 60000; const next = Math.max(10 * 60000, cur - 10 * 60000); setField("time.durationMinMax.minMs", next); setField("time.durationMinMax.maxMs", next); }}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-0 text-foreground-muted hover:bg-surface-1">
                −
              </button>
              <div className="flex-1 text-center text-lg font-semibold tabular-nums">
                {time.durationMinMax.minMs !== null ? Math.round(time.durationMinMax.minMs / 60000) : 90}
              </div>
              <button type="button" onClick={() => { const cur = time.durationMinMax.minMs ?? 90 * 60000; const next = cur + 10 * 60000; setField("time.durationMinMax.minMs", next); setField("time.durationMinMax.maxMs", next); }}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-surface-0 text-foreground-muted hover:bg-surface-1">
                ＋
              </button>
              <div className="flex rounded-lg border border-border bg-surface-0 p-0.5">
                <span className="rounded-md bg-primary px-3 py-1 text-xs font-bold text-primary-fg">{t("quickCreate.minutesUnit")}</span>
                <span className="rounded-md px-3 py-1 text-xs text-foreground-muted">{t("quickCreate.hoursUnit")}</span>
              </div>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between rounded-xl border border-border bg-surface-0 p-3">
            <div>
              <strong className="block text-xs font-semibold">{t("quickCreate.durationUseCompletionTitle")}</strong>
              <small className="block text-[10px] text-foreground-muted">{t("quickCreate.durationUseCompletionSub")}</small>
            </div>
            <button type="button" className="h-6 w-11 rounded-full bg-primary p-0.5 transition-colors">
              <div className="h-5 w-5 translate-x-5 rounded-full bg-white transition-transform" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" size="small" variant="ghost" onClick={() => setActivePanel("base")}>
              {t("quickCreate.cancel")}
            </Button>
            <div className="flex-1" />
            <Button type="button" size="small" variant="default" onClick={() => setActivePanel("base")}>
              {t("quickCreate.metaApply")}
            </Button>
          </div>
        </div>
      </section>

      {/* ─── recurring sub-panel ─── */}
      <section data-subpanel="recurring" className={subPanelClass("recurring")} aria-hidden={activePanel !== "recurring"}>
        <div className="flex h-[62px] items-center gap-2 border-b border-border px-3 shrink-0 bg-surface-0">
          <button type="button" onClick={() => setActivePanel("base")} className="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-1">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <strong className="block truncate text-sm font-semibold">{t("quickCreate.repeatChip")}</strong>
          </div>
        </div>
        <AutomationPanel
          recurring={recurring}
          setField={setField}
          locale={locale}
          t={t}
        />
      </section>

      {/* ─── references sub-panel ─── */}
      <section data-subpanel="references" className={subPanelClass("references")} aria-hidden={activePanel !== "references"}>
        <div className="flex h-[62px] items-center gap-2 border-b border-border px-3 shrink-0 bg-surface-0">
          <button type="button" onClick={() => setActivePanel("base")} className="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-1">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <strong className="block truncate text-sm font-semibold">{t("quickCreate.referencesNavTitle")}</strong>
          </div>
        </div>
        <FormPanel>
          <SectionHeader icon={Link2} title={t("quickCreate.referencesNavTitle")} />
          {plan.references.length === 0 ? (
            <p className="text-xs text-foreground-muted">{t("quickCreate.referenceEmptyListHint")}</p>
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
                <div key={`${refIdDisplay}-${i}`} className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface-0 p-3" data-testid={`reference-card-${i}`}>
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
                      {t("quickCreate.referenceTargetLabel")}
                    </div>
                    <div className={cn("flex items-center gap-3 rounded-lg border bg-surface-0 p-3", hasTarget ? "border-primary" : "border-border")} data-testid={`reference-target-card-${i}`}>
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-foreground-muted">
                        <Calendar size={18} aria-hidden="true" />
                      </div>
                      <div className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-medium text-foreground">
                          {hasTarget ? ref.target.referenceId : t("quickCreate.referenceTargetEmpty")}
                        </span>
                        <span className="truncate text-xs text-foreground-muted">
                          {t("quickCreate.referenceTargetBadge")}
                        </span>
                      </div>
                    </div>
                    <input
                      type="text"
                      aria-label={t("quickCreate.referenceIdPlaceholder")}
                      placeholder={t("quickCreate.referenceIdPlaceholder")}
                      value={ref.target.referenceId ?? ""}
                      onChange={(e) => {
                        const next = plan.references.slice();
                        next[i] = { ...ref, target: { ...ref.target, referenceId: e.target.value || null } };
                        setField("plan.references", next);
                      }}
                      className="w-full rounded-md bg-surface-2 px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
                      {t("quickCreate.referenceRelationLabel")}
                    </div>
                    <div role="radiogroup" aria-label={t("quickCreate.referenceRelationLabel")} className="flex w-full gap-1" data-testid={`reference-relation-tabs-${i}`}>
                      {[
                        { kind: 4, key: "referenceRelationAfter" },
                        { kind: 3, key: "referenceRelationBefore" },
                        { kind: 1, key: "referenceRelationFirst" },
                        { kind: 2, key: "referenceRelationLast" },
                        { kind: 0, key: "referenceRelationAll" },
                      ].map((opt) => {
                        const active = ref.pick.kind === opt.kind;
                        return (
                          <button
                            key={opt.kind}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => {
                              const next = plan.references.slice();
                              next[i] = { ...ref, pick: { ...ref.pick, kind: opt.kind } };
                              setField("plan.references", next);
                            }}
                            className={cn(
                              "min-w-0 flex-1 truncate rounded-full border px-3 py-1.5 text-sm transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                              active
                                ? "bg-primary text-primary-fg border-primary shadow-sm"
                                : "bg-surface-1 text-foreground-muted border-border hover:text-foreground",
                            )}
                          >
                            {t(`quickCreate.${opt.key}`)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
                      {t("quickCreate.referenceIntervalLabel")}
                    </div>
                    <div className="flex items-center gap-2" data-testid={`reference-interval-stepper-${i}`}>
                      <button type="button" aria-label="-" onClick={() => {
                        const next = plan.references.slice();
                        const nextVal = Math.max(5, intervalValue - 5);
                        next[i] = { ...ref, pick: { ...ref.pick, momentId: String(nextVal) } };
                        setField("plan.references", next);
                      }} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-1 text-foreground hover:bg-surface-2">-</button>
                      <div className="flex h-9 min-w-[3.5rem] flex-1 items-center justify-center rounded-md bg-surface-2 px-2 text-sm tabular-nums" aria-live="polite">{intervalValue}</div>
                      <button type="button" aria-label="+" onClick={() => {
                        const next = plan.references.slice();
                        const nextVal = Math.min(120, intervalValue + 5);
                        next[i] = { ...ref, pick: { ...ref.pick, momentId: String(nextVal) } };
                        setField("plan.references", next);
                      }} className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface-1 text-foreground hover:bg-surface-2">+</button>
                      <div className="flex shrink-0 rounded-full border border-border bg-surface-1 p-0.5">
                        <button type="button" className="rounded-full bg-primary px-3 py-1 text-xs text-primary-fg" aria-pressed="true">
                          {t("quickCreate.referenceIntervalUnitMin")}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-t border-border/40 pt-2">
                    <Button type="button" size="small" variant="ghost" onClick={() => { const next = plan.references.slice(); next.splice(i, 1); setField("plan.references", next); }} className="text-danger hover:bg-danger/10">
                      {t("quickCreate.referenceRemoveLabel")}
                    </Button>
                    <div className="flex-1" />
                    <Button type="button" size="small" variant="default" onClick={() => setActivePanel("base")}>
                      {t("quickCreate.referenceCancelLabel")}
                    </Button>
                    <Button type="button" size="small" variant="primary" onClick={() => setActivePanel("base")}>
                      {t("quickCreate.referenceApplyLabel")}
                    </Button>
                  </div>
                </div>
              );
            })}
            <Button type="button" size="small" variant="default" rounded iconLeft={<Plus size={12} aria-hidden="true" />} onClick={() => {
              setField("plan.references", [...plan.references, { id: "", target: { kind: 0, contextKind: null, referenceId: null, conditionId: null }, pick: { kind: 4, momentId: "10" } }]);
            }} data-testid="reference-add-button">
              {t("quickCreate.addReference")}
            </Button>
          </div>
        </FormPanel>
      </section>

      {/* ─── completion sub-panel ─── */}
      <section data-subpanel="completion" className={subPanelClass("completion")} aria-hidden={activePanel !== "completion"}>
        <div className="flex h-[62px] items-center gap-2 border-b border-border px-3 shrink-0 bg-surface-0">
          <button type="button" onClick={() => setActivePanel("base")} className="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-1">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <strong className="block truncate text-sm font-semibold">{t("quickCreate.completionNavTitle")}</strong>
          </div>
        </div>
        <FormPanel>
          <SectionHeader icon={ListChecks} title={t("quickCreate.completionNavTitle")} />
          <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-surface-0 p-3" data-testid="completion-condition-box">
            <div className="flex items-center justify-between gap-2">
              <strong className="text-sm font-semibold text-foreground">
                {t("quickCreate.completionBuilderLogicLabel")}
              </strong>
              <select
                aria-label={t("quickCreate.completionBuilderLogicLabel")}
                value={String(plan.completion.root.kind)}
                onChange={(e) => {
                  const nextKind = Number(e.target.value);
                  setField("plan.completion.root", { ...plan.completion.root, kind: nextKind as never });
                }}
                className="rounded-md border border-border bg-surface-1 px-2 py-1 text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                data-testid="completion-logic-select"
              >
                <option value={String(ConditionKind.ALL)}>{t("quickCreate.completionBuilderLogicAll")}</option>
                <option value={String(ConditionKind.ANY)}>{t("quickCreate.completionBuilderLogicAny")}</option>
                <option value={String(ConditionKind.NOT)}>{t("quickCreate.completionNot")}</option>
              </select>
            </div>
            <ConditionEditor node={plan.completion.root} onChange={(next) => setField("plan.completion.root", next)} t={t} />
            {plan.completion.timeRequirements.length > 0 && (
              <div className="flex flex-col gap-1.5 border-t border-border/40 pt-2" data-testid="completion-time-requirement-lines">
                {plan.completion.timeRequirements.map((tr, i) => (
                  <div key={tr.id} className="flex items-center gap-2 rounded-md bg-surface-1 px-2 py-1.5 text-sm" data-testid={`completion-time-line-${i}`}>
                    <Clock size={16} className="shrink-0 text-foreground-muted" aria-hidden="true" />
                    <span className="flex-1 text-foreground">
                      {tr.required.minMs !== null ? `${Math.round(tr.required.minMs / 60000)} ${t("quickCreate.minutesUnit")}` : t("quickCreate.duration")}
                    </span>
                    <input
                      type="number"
                      min={5}
                      step={5}
                      aria-label={t("quickCreate.minutesUnit")}
                      value={tr.required.minMs === null ? "" : Math.round((tr.required.minMs ?? 0) / 60000)}
                      onChange={(e) => {
                        const next = plan.completion.timeRequirements.slice();
                        const v = e.target.value;
                        next[i] = { ...tr, required: { ...tr.required, minMs: v === "" ? null : Number(v) * 60000 } };
                        setField("plan.completion.timeRequirements", next);
                      }}
                      className="w-16 rounded-md bg-surface-2 px-2 py-1 text-right text-xs tabular-nums outline-none focus:ring-2 focus:ring-primary/40"
                    />
                    <span className="text-xs text-foreground-muted">{t("quickCreate.minutesUnit")}</span>
                    <Button type="button" size="icon-xs" variant="ghost" icon={<Trash2 size={12} aria-hidden="true" />} onClick={() => {
                      const next = plan.completion.timeRequirements.slice();
                      next.splice(i, 1);
                      setField("plan.completion.timeRequirements", next);
                    }} aria-label={t("quickCreate.removeItem")} className="text-foreground-muted hover:text-danger" />
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
              {t("quickCreate.conditionAddTitle")}
            </div>
            <div role="radiogroup" aria-label={t("quickCreate.conditionAddTitle")} className="flex w-full flex-wrap gap-1" data-testid="completion-condition-tabs">
              {[
                { key: "completionBuilderTabTime", termKind: null as null | "time" },
                { key: "completionBuilderTabTask", termKind: "task" as const },
                { key: "completionBuilderTabTile", termKind: "relation" as const },
                { key: "completionBuilderTabRecord", termKind: "metric" as const },
              ].map((opt) => (
                <button
                  key={opt.key}
                  type="button"
                  role="radio"
                  aria-checked="false"
                  onClick={() => {
                    if (opt.termKind === null) {
                      const newTr = { id: `tr_${Math.random().toString(36).slice(2, 9)}`, observation: { scope: 0 as never }, required: { minMs: time.durationMinMax.minMs ?? 60 * 60000 } };
                      setField("plan.completion.timeRequirements", [...plan.completion.timeRequirements, newTr]);
                      return;
                    }
                    const child = defaultTerm(opt.termKind === "relation" ? "relation" : opt.termKind === "metric" ? "metric" : "task");
                    setField("plan.completion.root", { ...plan.completion.root, children: [...plan.completion.root.children, child] });
                  }}
                  className="min-w-0 flex-1 truncate rounded-full border border-border bg-surface-1 px-3 py-1.5 text-sm text-foreground-muted hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {t(`quickCreate.${opt.key}`)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2 border-t border-border/40 pt-3">
            <Button type="button" size="small" variant="ghost" onClick={() => setField("plan.completion.root", { kind: ConditionKind.ALL, children: [], term: null })} className="text-danger hover:bg-danger/10">
              {t("quickCreate.completionRemoveLabel")}
            </Button>
            <div className="flex-1" />
            <Button type="button" size="small" variant="default" onClick={() => setActivePanel("base")}>
              {t("quickCreate.completionCancelLabel")}
            </Button>
            <Button type="button" size="small" variant="primary" onClick={() => setActivePanel("base")} data-testid="completion-apply">
              {t("quickCreate.completionBuilderApply")}
            </Button>
          </div>
        </FormPanel>
      </section>

      {/* ─── meta sub-panel ─── */}
      <section data-subpanel="meta" className={subPanelClass("meta")} aria-hidden={activePanel !== "meta"}>
        <div className="flex h-[62px] items-center gap-2 border-b border-border px-3 shrink-0 bg-surface-0">
          <button type="button" onClick={() => setActivePanel("base")} className="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-1">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <strong className="block truncate text-sm font-semibold">{t("quickCreate.metaNavTitle")}</strong>
          </div>
        </div>
        <FormPanel>
          <SectionHeader icon={FolderOpen} title={t("quickCreate.metaNavTitle")} />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
              <span>{t("quickCreate.organizeProject")}</span>
            </div>
            <div className="flex flex-col gap-2" data-testid="meta-project-catalog">
              <button type="button" onClick={() => setField("meta.ownerSubjectId", null)} aria-pressed={meta.ownerSubjectId === null}
                className={cn("flex items-center gap-3 rounded-lg border bg-surface-0 p-3 text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary", meta.ownerSubjectId === null ? "border-primary" : "border-border")}>
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-foreground-muted">
                  <FolderOpen size={18} aria-hidden="true" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">{t("quickCreate.projectOwnerDefault")}</span>
                  <span className="truncate text-xs text-foreground-muted">{t("quickCreate.organizeProjectDefaultSub")}</span>
                </div>
              </button>
              {projects.workspaces.map((w) => {
                const selected = meta.ownerSubjectId === w.id;
                return (
                  <button key={w.id} type="button" onClick={() => setField("meta.ownerSubjectId", w.id)} aria-pressed={selected}
                    className={cn("flex items-center gap-3 rounded-lg border bg-surface-0 p-3 text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary", selected ? "border-primary" : "border-border")}>
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-foreground-muted">
                      <FolderOpen size={18} aria-hidden="true" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-foreground">{w.display_name}</span>
                      <span className="truncate text-xs text-foreground-muted">{w.kind ?? "Project"}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
              <span>{t("quickCreate.organizeTags")}</span>
              <span className="text-[10px] font-normal text-foreground-muted">{t("quickCreate.organizeTagsMulti")}</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5" data-testid="meta-tag-chips">
              {meta.tags.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-xs text-primary-fg">
                  <span>#{tag}</span>
                  <button type="button" onClick={() => setField("meta.tags", meta.tags.filter((x) => x !== tag))} className="text-primary-fg/80 hover:text-white">
                    <X size={10} aria-hidden="true" />
                  </button>
                </span>
              ))}
              <input
                type="text"
                placeholder={t("quickCreate.tagsPlaceholder")}
                aria-label={t("quickCreate.tagsPlaceholder")}
                className="min-w-[8ch] flex-1 rounded-md bg-surface-2 px-2 py-1 text-sm text-foreground placeholder:text-foreground-muted focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === ",") {
                    e.preventDefault();
                    const v = (e.currentTarget.value || "").trim();
                    if (!v) return;
                    if (meta.tags.includes(v)) return;
                    setField("meta.tags", [...meta.tags, v]);
                    e.currentTarget.value = "";
                  }
                }}
              />
            </div>
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
            <Button type="button" size="small" variant="ghost" onClick={() => { setField("meta.ownerSubjectId", null); setField("meta.tags", []); setField("meta.memo", ""); }} className="text-danger hover:bg-danger/10">
              {t("quickCreate.completionRemoveLabel")}
            </Button>
            <div className="flex-1" />
            <Button type="button" size="small" variant="default" onClick={() => setActivePanel("base")}>
              {t("quickCreate.completionCancelLabel")}
            </Button>
            <Button type="button" size="small" variant="primary" onClick={() => setActivePanel("base")}>
              {t("quickCreate.metaApply")}
            </Button>
          </div>
        </FormPanel>
      </section>

      {/* ─── behavior sub-panel ─── */}
      <section data-subpanel="behavior" className={subPanelClass("behavior")} aria-hidden={activePanel !== "behavior"}>
        <div className="flex h-[62px] items-center gap-2 border-b border-border px-3 shrink-0 bg-surface-0">
          <button type="button" onClick={() => setActivePanel("base")} className="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-foreground-muted hover:bg-surface-1">
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <div className="flex-1 min-w-0">
            <strong className="block truncate text-sm font-semibold">{t("quickCreate.behaviorTitle")}</strong>
            <small className="block truncate text-[10px] text-foreground-muted">{t("quickCreate.behaviorSub")}</small>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <button
            type="button"
            onClick={() => setField("plan.role", PlanRole.EXECUTABLE)}
            className={cn(
              "mb-3 flex w-full items-center gap-3 rounded-xl border bg-surface-0 p-3 text-left transition-colors",
              plan.role === PlanRole.EXECUTABLE ? "border-primary" : "border-border hover:bg-surface-1"
            )}
          >
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-foreground-muted" />
            <div>
              <strong className="block text-sm font-semibold">{t("quickCreate.behaviorExecutable")}</strong>
              <small className="block text-[10px] text-foreground-muted">{t("quickCreate.behaviorExecutableSub")}</small>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setField("plan.role", PlanRole.LABEL)}
            className={cn(
              "mb-4 flex w-full items-center gap-3 rounded-xl border bg-surface-0 p-3 text-left transition-colors",
              plan.role === PlanRole.LABEL ? "border-primary" : "border-border hover:bg-surface-1"
            )}
          >
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-foreground-muted" />
            <div>
              <strong className="block text-sm font-semibold">{t("quickCreate.behaviorLabel")}</strong>
              <small className="block text-[10px] text-foreground-muted">{t("quickCreate.behaviorLabelSub")}</small>
            </div>
          </button>

          <div className="mb-4 rounded-lg border border-border bg-surface-0 p-3">
            <div className="flex items-start gap-2">
              <Info size={14} className="mt-0.5 shrink-0 text-foreground-muted" aria-hidden />
              <span className="text-[11px] text-foreground-muted">{t("quickCreate.behaviorSchemaNote")}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button type="button" size="small" variant="ghost" onClick={() => setActivePanel("base")}>
              {t("quickCreate.cancel")}
            </Button>
            <div className="flex-1" />
            <Button type="button" size="small" variant="default" onClick={() => setActivePanel("base")}>
              {t("quickCreate.metaApply")}
            </Button>
          </div>
        </div>
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
}: {
  icon: typeof Calendar;
  label: string;
  chip: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  onClick: () => void;
}) {
  return (
    <div className="grid min-h-[56px] grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2 py-2">
      <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-2 text-foreground-muted">
        <Icon className="h-3.5 w-3.5" aria-hidden />
      </div>
      <button type="button" onClick={onClick}
        aria-label={`${label} を編集`}
        className="group flex min-w-0 items-center gap-3 rounded-md px-2 py-1.5 -my-1.5 -mx-1 cursor-pointer text-left transition-colors hover:bg-surface-2 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary">
        <div className="shrink-0 text-[11px] font-bold text-foreground-muted">{label}</div>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">{chip}</div>
      </button>
      <div className="flex items-center gap-1">
        {clearable && onClear ? (
          <button type="button" onClick={onClear} aria-label="指定を消す"
            className="flex h-10 w-10 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-2 hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary">
            <X className="h-4 w-4" aria-hidden />
          </button>
        ) : null}
        <button type="button" onClick={onClick} aria-hidden="true" tabIndex={-1}
          className="flex h-10 w-10 items-center justify-center rounded-md text-foreground-muted group-hover:text-foreground hover:bg-surface-2 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary">
          <ChevronRight className="h-4 w-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}

function TaskRowMenu({
  anchor,
  index,
  total,
  onClose,
  onMove,
  onDelete,
  t,
}: {
  anchor: HTMLButtonElement | null;
  index: number;
  total: number;
  onClose: () => void;
  onMove: (dir: "up" | "down") => void;
  onDelete: () => void;
  t: (key: string) => string;
}) {
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  useEffect(() => {
    if (!anchor) return;
    const rect = anchor.getBoundingClientRect();
    const MENU_WIDTH = 168;
    const MENU_HEIGHT = 152;
    const top = Math.min(
      rect.bottom + 6,
      typeof window !== "undefined" ? window.innerHeight - MENU_HEIGHT - 8 : rect.bottom + 6,
    );
    const left = Math.max(
      8,
      Math.min(rect.right - MENU_WIDTH, (typeof window !== "undefined" ? window.innerWidth : rect.right) - MENU_WIDTH - 8),
    );
    setPos({ top, left });
  }, [anchor]);
  if (!anchor || !pos) return null;
  const canUp = index > 0;
  const canDown = index < total - 1;
  const itemClass =
    "flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground transition-colors hover:bg-surface-2 focus:outline-hidden focus-visible:bg-surface-2 disabled:cursor-not-allowed disabled:text-foreground-muted disabled:hover:bg-transparent";
  return (
    <div
      id="quick-create-task-menu"
      role="menu"
      aria-label={t("quickCreate.taskMenuLabel")}
      className="fixed z-50 min-w-[168px] overflow-hidden rounded-lg border border-border bg-surface-elevated shadow-lg"
      style={{ top: pos.top, left: pos.left }}
    >
      <button
        type="button"
        role="menuitem"
        disabled={!canUp}
        onClick={() => onMove("up")}
        className={itemClass}
      >
        <ChevronUp size={14} aria-hidden="true" />
        <span>{t("quickCreate.taskMoveUp")}</span>
      </button>
      <button
        type="button"
        role="menuitem"
        disabled={!canDown}
        onClick={() => onMove("down")}
        className={itemClass}
      >
        <ChevronDown size={14} aria-hidden="true" />
        <span>{t("quickCreate.taskMoveDown")}</span>
      </button>
      <div className="my-1 border-t border-border" role="separator" />
      <button
        type="button"
        role="menuitem"
        onClick={() => {
          onDelete();
          onClose();
        }}
        className={cn(itemClass, "text-danger hover:bg-danger/10 focus-visible:bg-danger/10")}
      >
        <Trash2 size={14} aria-hidden="true" />
        <span>{t("quickCreate.taskMoreTitle")}</span>
      </button>
    </div>
  );
}

function ConditionKindSegmented({ value, onChange, t }: { value: number | import("@/lib/domain/v1/constants").ConditionKindValue; onChange: (v: number) => void; t: (k: string) => string }) {
  const options = [
    { value: String(ConditionKind.ALL), label: t("quickCreate.conditionAll") },
    { value: String(ConditionKind.ANY), label: t("quickCreate.conditionAny") },
    { value: String(ConditionKind.NOT), label: t("quickCreate.conditionNot") },
    { value: String(ConditionKind.TERM), label: t("quickCreate.conditionTerm") },
  ];
  return <RowSegmented icon={GitBranch} options={options} value={String(value)} onChange={(v) => onChange(Number(v))} />;
}

function TermKindSegmented({ value, onChange, t }: { value: string; onChange: (v: string) => void; t: (k: string) => string }) {
  const options = [
    { value: "calendar", label: t("quickCreate.termCalendar") },
    { value: "moment", label: t("quickCreate.termMoment") },
    { value: "relation", label: t("quickCreate.termRelation") },
    { value: "gap", label: t("quickCreate.termGap") },
    { value: "requirement", label: t("quickCreate.termRequirement") },
    { value: "task", label: t("quickCreate.termTask") },
    { value: "fact", label: t("quickCreate.termFact") },
    { value: "metric", label: t("quickCreate.termMetric") },
    { value: "life", label: t("quickCreate.termLife") },
  ];
  return <RowSegmented icon={ListChecks} options={options} value={value} onChange={onChange} compact />;
}

function defaultTerm(kind: string): Term {
  switch (kind) {
    case "calendar":
      return { kind: "calendar", value: { weekdayMask: 0, timeStart: null, timeEnd: null, holidayKind: HolidayKind.ANY, dateRange: null, offsetMin: 0 } };
    case "moment":
      return { kind: "moment", value: { referenceId: null, point: null, offsetMs: 0 } };
    case "relation":
      return { kind: "relation", value: { referenceId: "", relation: 0, windowKind: 0 } };
    case "gap":
      return { kind: "gap", value: { scope: 0, leftAnchor: { referenceId: null, point: null }, rightAnchor: { referenceId: null, point: null }, size: { minMs: null, maxMs: null } } };
    case "requirement":
      return { kind: "requirement", value: { requirementId: "", state: 0 } };
    case "task":
      return { kind: "task", value: { taskId: "", state: 0 } };
    case "fact":
      return { kind: "fact", value: { factId: "", op: 0, value: null } };
    case "metric":
      return { kind: "metric", value: { metricId: "", op: 0, value: null } };
    case "feedback":
      return { kind: "feedback", value: { feedbackTxnId: "", op: 0, value: null } };
    case "life":
      return { kind: "life", value: { target: "", state: 0 } };
    default:
      return { kind: "calendar", value: { weekdayMask: 0, timeStart: null, timeEnd: null, holidayKind: HolidayKind.ANY, dateRange: null, offsetMin: 0 } };
  }
}

function updateCalendar(term: Term, key: keyof import("@/lib/domain/v1/condition").CalendarTerm, value: import("@/lib/domain/v1/condition").CalendarTerm[keyof import("@/lib/domain/v1/condition").CalendarTerm]) {
  if (term.kind !== "calendar") return term;
  return { kind: "calendar", value: { ...term.value, [key]: value } } as Term;
}
function updateMoment(term: Term, key: keyof import("@/lib/domain/v1/condition").MomentTerm, value: import("@/lib/domain/v1/condition").MomentTerm[keyof import("@/lib/domain/v1/condition").MomentTerm]) {
  if (term.kind !== "moment") return term;
  return { kind: "moment", value: { ...term.value, [key]: value } } as Term;
}
function updateRelation(term: Term, key: keyof import("@/lib/domain/v1/condition").RelationTerm, value: import("@/lib/domain/v1/condition").RelationTerm[keyof import("@/lib/domain/v1/condition").RelationTerm]) {
  if (term.kind !== "relation") return term;
  return { kind: "relation", value: { ...term.value, [key]: value } } as Term;
}
function updateTask(term: Term, key: keyof import("@/lib/domain/v1/condition").TaskTerm, value: import("@/lib/domain/v1/condition").TaskTerm[keyof import("@/lib/domain/v1/condition").TaskTerm]) {
  if (term.kind !== "task") return term;
  return { kind: "task", value: { ...term.value, [key]: value } } as Term;
}
function updateRequirement(term: Term, key: keyof import("@/lib/domain/v1/condition").RequirementTerm, value: import("@/lib/domain/v1/condition").RequirementTerm[keyof import("@/lib/domain/v1/condition").RequirementTerm]) {
  if (term.kind !== "requirement") return term;
  return { kind: "requirement", value: { ...term.value, [key]: value } } as Term;
}
function updateLife(term: Term, key: keyof import("@/lib/domain/v1/condition").LifeTerm, value: import("@/lib/domain/v1/condition").LifeTerm[keyof import("@/lib/domain/v1/condition").LifeTerm]) {
  if (term.kind !== "life") return term;
  return { kind: "life", value: { ...term.value, [key]: value } } as Term;
}
function updateValue(term: Term, key: string, value: unknown): Term {
  if (term.kind !== "fact" && term.kind !== "metric" && term.kind !== "feedback") return term;
  return { ...term, value: { ...term.value, [key]: value } } as Term;
}

function TermFields({ term, onChange, t }: { term: Term; onChange: (next: Term) => void; t: (k: string) => string }) {
  switch (term.kind) {
    case "calendar":
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.calendarWeekdayMask")}</span>
            <input type="number" value={term.value.weekdayMask} onChange={(e) => onChange(updateCalendar(term, "weekdayMask", Number(e.target.value)))} className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.calendarOffsetMin")}</span>
            <input type="number" value={term.value.offsetMin} onChange={(e) => onChange(updateCalendar(term, "offsetMin", Number(e.target.value)))} className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.calendarTimeStart")}</span>
            <input type="time" value={term.value.timeStart ?? ""} onChange={(e) => onChange(updateCalendar(term, "timeStart", e.target.value === "" ? null : e.target.value))} className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.calendarTimeEnd")}</span>
            <input type="time" value={term.value.timeEnd ?? ""} onChange={(e) => onChange(updateCalendar(term, "timeEnd", e.target.value === "" ? null : e.target.value))} className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
        </div>
      );
    case "moment":
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.momentReferenceId")}</span>
            <input type="text" value={term.value.referenceId ?? ""} onChange={(e) => onChange(updateMoment(term, "referenceId", e.target.value === "" ? null : e.target.value))} className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.momentOffsetMs")}</span>
            <input type="number" value={term.value.offsetMs} onChange={(e) => onChange(updateMoment(term, "offsetMs", Number(e.target.value)))} className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
        </div>
      );
    case "relation":
      return (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <label className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.relationReferenceId")}</span>
            <input type="text" value={term.value.referenceId} onChange={(e) => onChange(updateRelation(term, "referenceId", e.target.value))} className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.relationKind")}</span>
            <input type="number" value={term.value.relation} onChange={(e) => onChange(updateRelation(term, "relation", Number(e.target.value)))} className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.relationWindowKind")}</span>
            <input type="number" value={term.value.windowKind} onChange={(e) => onChange(updateRelation(term, "windowKind", Number(e.target.value)))} className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
        </div>
      );
    case "task":
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.taskId")}</span>
            <input type="text" value={term.value.taskId} onChange={(e) => onChange(updateTask(term, "taskId", e.target.value))} className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.taskState")}</span>
            <input type="number" value={term.value.state} onChange={(e) => onChange(updateTask(term, "state", Number(e.target.value)))} className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
        </div>
      );
    case "requirement":
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.requirementId")}</span>
            <input type="text" value={term.value.requirementId} onChange={(e) => onChange(updateRequirement(term, "requirementId", e.target.value))} className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">{t("quickCreate.requirementState")}</span>
            <input type="number" value={term.value.state} onChange={(e) => onChange(updateRequirement(term, "state", Number(e.target.value)))} className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
        </div>
      );
    case "metric":
    case "fact":
    case "feedback": {
      const v = term.value as unknown as { op: number; value: unknown; [k: string]: unknown };
      const idKey = term.kind === "fact" ? "factId" : term.kind === "metric" ? "metricId" : "feedbackTxnId";
      return (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <label className="space-y-1">
            <span className="block text-foreground-muted">ID</span>
            <input type="text" value={String(v[idKey] ?? "")} onChange={(e) => onChange(updateValue(term, idKey, e.target.value))} className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">op</span>
            <input type="number" value={v.op} onChange={(e) => onChange(updateValue(term, "op", Number(e.target.value)))} className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">value</span>
            <input type="text" value={v.value === null || v.value === undefined ? "" : String(v.value)} onChange={(e) => {
              const raw = e.target.value;
              if (raw === "") { onChange(updateValue(term, "value", null)); return; }
              const num = Number(raw);
              onChange(updateValue(term, "value", Number.isFinite(num) && raw.trim() !== "" ? num : raw));
            }} className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
        </div>
      );
    }
    case "life":
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-1">
            <span className="block text-foreground-muted">target</span>
            <input type="text" value={term.value.target} onChange={(e) => onChange(updateLife(term, "target", e.target.value))} className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">state</span>
            <input type="number" value={term.value.state} onChange={(e) => onChange(updateLife(term, "state", Number(e.target.value)))} className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40" />
          </label>
        </div>
      );
    case "gap":
      return <p className="text-xs text-foreground-muted">{t("quickCreate.gapPlaceholder")}</p>;
    default:
      return null;
  }
}

function ConditionEditor({ node, onChange, t }: { node: ConditionNode; onChange: (next: ConditionNode) => void; t: (k: string) => string }) {
  const isTerm = node.kind === ConditionKind.TERM;
  return (
    <div className="flex flex-col gap-1">
      <ConditionKindSegmented
        value={node.kind as number}
        onChange={(kind) => {
          if (kind === ConditionKind.TERM) {
            const currentTerm = node.term ?? defaultTerm("calendar");
            onChange({ kind: kind as import("@/lib/domain/v1/constants").ConditionKindValue, children: [], term: currentTerm });
          } else {
            onChange({ kind: kind as import("@/lib/domain/v1/constants").ConditionKindValue, children: node.children, term: null });
          }
        }}
        t={t}
      />
      {isTerm ? (
        <>
          <TermKindSegmented value={node.term?.kind ?? "calendar"} onChange={(k) => onChange({ kind: ConditionKind.TERM, children: [], term: defaultTerm(k) })} t={t} />
          {node.term ? <TermFields term={node.term} onChange={(next) => onChange({ kind: ConditionKind.TERM, children: [], term: next })} t={t} /> : null}
        </>
      ) : (
        <>
          {node.children.map((child, i) => (
            <div key={i} className="flex flex-col gap-1">
              <ConditionEditor node={child} onChange={(next) => { const children = node.children.slice(); children[i] = next; onChange({ ...node, children }); }} t={t} />
              <Button type="button" size="icon-xs" variant="ghost" icon={<Trash2 size={14} aria-hidden="true" />} onClick={() => { const children = node.children.slice(); children.splice(i, 1); onChange({ ...node, children }); }} aria-label={t("quickCreate.conditionRemoveChild")} className="self-start text-foreground-muted hover:text-danger" />
            </div>
          ))}
          <Button type="button" size="small" variant="default" rounded iconLeft={<Plus size={12} aria-hidden="true" />} onClick={() => onChange({ ...node, children: [...node.children, { kind: ConditionKind.TERM, children: [], term: defaultTerm("calendar") }] })}>
            {t("quickCreate.conditionAddChild")}
          </Button>
        </>
      )}
    </div>
  );
}
