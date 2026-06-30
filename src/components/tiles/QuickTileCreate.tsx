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
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  FolderOpen,
  ListChecks,
  MessageSquare,
  Palette,
  Plus,
  RefreshCw,
  Repeat,
  Tag,
  Type,
  X,
  Flame,
  Inbox,
  Bell,
  Coffee,
  Heart,
  Star,
  Activity,
  BookOpen,
  Link2,
  Target,
  Layers,
  BarChart3,
  GitBranch,
  Settings2,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import {
  FormDivider,
  FormPanel,
  FormRow,
  RowInput,
  RowSegmented,
  RowSubPanel,
  RowToggle,
} from "@/components/ui/form";
import { makeClient, submitCreateTile } from "@/lib/api/v1/submit";
import {
  ConditionKind,
  HolidayKind,
  PlanRole,
  RecurringState,
  TileKind,
  type PlanRoleValue,
  type RecurringStateValue,
  type TileKindValue,
} from "@/lib/domain/v1/constants";
import type { Window } from "@/lib/domain/v1/window";
import type { ConditionNode, Term } from "@/lib/domain/v1/condition";
import type {
  FrameRule,
  FrameGenerator,
  CalendarGenerator,
  ReferenceGenerator,
  StepGenerator,
  TransformGenerator,
} from "@/lib/domain/v1/tile";
import { uuidv7 } from "@/lib/domain/v1/envelope";
import type { RecurrenceModel } from "@/lib/domain/tile";
import {
  defaultRecurrenceModel,
  useQuickCreateStore,
} from "@/lib/stores/quick-create-store";
import { useProjectsStore } from "@/lib/stores/projects-store";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";

const PRESET_COLORS = [
  "#5e6ad2", // Tastile 藍
  "#0d8a72", // 実行中 (青緑)
  "#c08a2b", // 待機中 (琥珀)
  "#c34141", // 割り込み (深紅)
  "#3b82f6", // 青
  "#10b981", // 緑
  "#f59e0b", // 黄
  "#ef4444", // 赤
  "#8b5cf6", // 紫
  "#6b7280", // グレー
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

// ---------- kind / role / state option sets ----------

const TILE_KIND_OPTIONS: ReadonlyArray<{ value: TileKindValue; label: string }> = [
  { value: TileKind.PLACEMENT, label: "quickCreate.kindPlacement" },
  { value: TileKind.RECURRING, label: "quickCreate.kindRecurring" },
];

const PLAN_ROLE_OPTIONS: ReadonlyArray<{ value: PlanRoleValue; label: string }> = [
  { value: PlanRole.EXECUTABLE, label: "quickCreate.roleExecutable" },
  { value: PlanRole.LABEL, label: "quickCreate.roleLabel" },
];

const RECURRING_STATE_OPTIONS: ReadonlyArray<{
  value: RecurringStateValue;
  label: string;
}> = [
  { value: RecurringState.ACTIVE, label: "quickCreate.recurringStateActive" },
  { value: RecurringState.PAUSED, label: "quickCreate.recurringStatePaused" },
  { value: RecurringState.ENDED, label: "quickCreate.recurringStateEnded" },
  {
    value: RecurringState.CANCELLED,
    label: "quickCreate.recurringStateCancelled",
  },
];

// ---------- helpers ----------

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
  // datetime-local needs "YYYY-MM-DDTHH:MM" with no timezone suffix.
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function localDateToIsoDate(value: string): string {
  // Date inputs give "YYYY-MM-DD"; emit as ISO date (start of day UTC).
  return value ? `${value}T00:00:00.000Z` : "";
}

function isoToLocalDate(iso: string | null | undefined): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function formatDisplayDate(iso: string | null | undefined, allDay: boolean, locale: "ja" | "en"): string {
  if (!iso) return locale === "ja" ? "未設定" : "Not set";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return locale === "ja" ? "未設定" : "Not set";

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
  // <input type="color"> requires a #rrggbb value; empty / partial strings
  // fall back to black so the picker always has a usable state.
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#000000";
}

const FRAME_GENERATOR_KIND_OPTIONS = [
  { value: "step", label: "quickCreate.frameRuleKindStep" },
  { value: "reference", label: "quickCreate.frameRuleKindReference" },
  { value: "calendar", label: "quickCreate.frameRuleKindCalendar" },
  { value: "transform", label: "quickCreate.frameRuleKindTransform" },
] as const;

const CALENDAR_UNIT_OPTIONS = [
  { value: "0", label: "quickCreate.frameRuleUnitDay" },
  { value: "1", label: "quickCreate.frameRuleUnitWeek" },
  { value: "2", label: "quickCreate.frameRuleUnitMonth" },
] as const;

const REFERENCE_ALIGN_OPTIONS = [
  { value: "0", label: "quickCreate.frameRuleAlignStart" },
  { value: "1", label: "quickCreate.frameRuleAlignEnd" },
  { value: "2", label: "quickCreate.frameRuleAlignCenter" },
] as const;

const HOLIDAY_KIND_OPTIONS = [
  { value: String(HolidayKind.NOT_HOLIDAY), label: "quickCreate.frameRuleHolidayNotHoliday" },
  { value: String(HolidayKind.HOLIDAY), label: "quickCreate.frameRuleHolidayHoliday" },
  { value: String(HolidayKind.ANY), label: "quickCreate.frameRuleHolidayAny" },
] as const;

const WINDOW_KIND_OPTIONS = [
  { value: "0", label: "quickCreate.windowKindCalendar" },
  { value: "1", label: "quickCreate.windowKindLabelSpan" },
  { value: "2", label: "quickCreate.windowKindParentSpan" },
  { value: "3", label: "quickCreate.windowKindGap" },
] as const;

type FrameGeneratorKind = FrameGenerator["kind"];

function defaultFrameGenerator(kind: FrameGeneratorKind): FrameGenerator {
  switch (kind) {
    case "step":
      return { kind: "step", value: { step: 0, origin: null, bounds: null } };
    case "reference":
      return { kind: "reference", value: { referenceId: "", align: 0 } };
    case "calendar":
      return {
        kind: "calendar",
        value: { unit: 0, weekdayMask: null, holidayKind: HolidayKind.ANY },
      };
    case "transform":
      return {
        kind: "transform",
        value: { sourceFrameId: "", shift: null, scale: null },
      };
  }
}

// ---------- main component ----------

export function QuickTileCreate() {
  const isOpen = useQuickCreateStore((s) => s.isOpen);
  const close = useQuickCreateStore((s) => s.close);
  const reset = useQuickCreateStore((s) => s.reset);
  const setField = useQuickCreateStore((s) => s.setField);
  const mode = useQuickCreateStore((s) => s.mode);
  const editingId = useQuickCreateStore((s) => s.editingId);

  const identity = useQuickCreateStore((s) => s.identity);
  const plan = useQuickCreateStore((s) => s.plan);
  const time = useQuickCreateStore((s) => s.time);
  const windows = useQuickCreateStore((s) => s.windows);
  const recurring = useQuickCreateStore((s) => s.recurring);
  const recurrence = useQuickCreateStore((s) => s.recurrence);
  const advanced = useQuickCreateStore((s) => s.advanced);
  const meta = useQuickCreateStore((s) => s.meta);

  const isDesktop = useIsDesktop();
  const { t, locale } = useTranslation();

  const [allDay, setAllDay] = useState(true);
  const [visualOpen, setVisualOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<"base" | "time" | "recurring" | "references" | "completion" | "planning" | "metrics" | "decisions" | "recurringRules" | "meta">("base");
  const [recurringTab, setRecurringTab] = useState<"lifecycle" | "generator" | "window">("lifecycle");
  const [projectSuggest, setProjectSuggest] = useState(false);
  const [tagSuggest, setTagSuggest] = useState(false);
  const projects = useProjectsStore((s) => s.projects);
  const tagInputRef = useRef<HTMLInputElement | null>(null);
  const [tagInputDraft, setTagInputDraft] = useState("");
  const [memoExpanded, setMemoExpanded] = useState(meta.memo.trim().length > 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<"title" | null>(null);
  // Drive the open/close animation independently of the store so the panel
  // can slide out before it is unmounted.
  const [mounted, setMounted] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (isOpen) {
      // Opening: keep the panel mounted, cancel any pending close timer,
      // and clear the closing flag so the slide-in animation can run.
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      setMounted(true);
      setIsClosing(false);
    } else if (mounted) {
      // Closing: trigger the slide-out, then unmount after the animation.
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

  // externalId is null on SSR/first render to keep hydration stable.
  // uuidv7() uses Date.now() which differs between server and client.
  // Mint a fresh one after mount.
  useEffect(() => {
    if (identity.externalId === null) {
      setField("identity.externalId", uuidv7());
    }
  }, [identity.externalId, setField]);

  if (!mounted) return null;

  // --- validity -------------------------------------------------------------

  const titleOk = identity.title.trim().length > 0;
  const kindIsRecurring = identity.kind === TileKind.RECURRING;
  const timeSummary = (() => {
    const fmt = (iso: string) => {
      if (!iso) return null;
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return null;
      return d.toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };
    const start = fmt(time.span.start);
    const end = fmt(time.span.end);
    const dur =
      time.durationMinMax.minMs !== null
        ? Math.round(time.durationMinMax.minMs / 60000) + t('quickCreate.minutesUnit')
        : null;
    if (allDay) return t('quickCreate.allDay') + (dur ? ' ' + dur : '');
    if (start && end) return start + ' → ' + end;
    if (start) return start;
    if (dur) return dur;
    return '';
  })();
  const spanHasStart = !!time.span.start;
  const spanHasEnd = !!time.span.end;
  const spanOrderValid =
    !spanHasStart || !spanHasEnd || time.span.end > time.span.start;
  const durationValid =
    plan.role === PlanRole.LABEL ||
    time.durationMinMax.minMs === null ||
    time.durationMinMax.maxMs === null ||
    time.durationMinMax.minMs <= time.durationMinMax.maxMs;
  const canSubmit = titleOk && spanOrderValid && durationValid;

  // --- completion root summary ----------------------------------------------
  // Recursively count child nodes so the main panel can show a compact
  // summary of the completion condition without opening the subpanel.
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
  const completionRootCount = countConditionChildren(completionRootNode);
  const completionTermSummary = (() => {
    if (!completionRootNode) return "";
    const labels: string[] = [];
    const visit = (n: ConditionNode) => {
      if (n.kind === ConditionKind.TERM && n.term) {
        const k = n.term.kind;
        const kindLabel = t("quickCreate.term" + k.charAt(0).toUpperCase() + k.slice(1));
        let stateLabel = "";
        switch (k) {
          case "task": {
            const v = n.term.value as { taskId: string; state: number };
            const stateKey = ["taskStateVisible", "taskStateMarked", "taskStateCompleted", "taskStateNotCompleted"][v.state] ?? "";
            const base = stateKey ? t("quickCreate." + stateKey) : "";
            stateLabel = v.taskId ? base + (base ? " " : "") + v.taskId.slice(0, 6) : base;
            break;
          }
          case "life": {
            const v = n.term.value as { state: number };
            const stateKey = ["lifeStateReady", "lifeStateStarted", "lifeStateDone"][v.state] ?? "";
            stateLabel = stateKey ? t("quickCreate." + stateKey) : "";
            break;
          }
          case "requirement": {
            const v = n.term.value as { state: number };
            stateLabel = v.state === 0 ? t("quickCreate.reqMet") : t("quickCreate.reqNotMet");
            break;
          }
          case "metric":
            stateLabel = t("quickCreate.metricAnyValue");
            break;
          case "fact":
            stateLabel = t("quickCreate.factAnyValue");
            break;
          case "calendar": {
            const v = n.term.value as { timeStart?: string; timeEnd?: string };
            stateLabel = v.timeStart ? v.timeStart.slice(0, 5) + "~" + (v.timeEnd ? v.timeEnd.slice(0, 5) : "") : t("quickCreate.calendarAnyTime");
            break;
          }
          case "gap":
            stateLabel = t("quickCreate.gapAnySize");
            break;
          case "moment": {
            const v = n.term.value as { target?: { kind?: string; id?: string } };
            if (v.target?.kind) {
              const kindLabel = t("quickCreate.referenceKind" + v.target.kind.charAt(0).toUpperCase() + v.target.kind.slice(1));
              stateLabel = kindLabel + (v.target.id ? " " + v.target.id.slice(0, 6) : "");
            } else {
              stateLabel = t("quickCreate.momentAnyPoint");
            }
            break;
          }
          case "relation":
            stateLabel = t("quickCreate.relationAnyLink");
            break;
          default:
            stateLabel = "";
        }
        labels.push(stateLabel ? kindLabel + stateLabel : kindLabel);
      } else {
        for (const c of n.children) visit(c);
      }
    };
    visit(completionRootNode);
    if (labels.length === 0) return "";
    return labels.slice(0, 3).join(" / ");
  })();

  // --- windows array helpers ------------------------------------------------
  // setField doesn't traverse arrays, so each array mutation rewrites the
  // whole array. Frames / FrameRules share the same shape; see FrameRule
  // helpers below for the discriminated-union twist.

  function addWindow() {
    const newWindow: Window = {
      id: uuidv7(),
      owner: "self",
      kind: 0, // CALENDAR
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

  function updateWindow(
    index: number,
    updater: (current: Window) => Window,
  ) {
    setField(
      "windows",
      windows.map((w, i) => (i === index ? updater(w) : w)),
    );
  }

  function addFrameRule() {
    const newRule: FrameRule = {
      id: uuidv7(),
      generator: {
        kind: "step",
        value: { step: 0, origin: null, bounds: null },
      },
      active: null,
    };
    setField("recurring.frameRules", [...recurring.frameRules, newRule]);
  }

  function removeFrameRule(index: number) {
    setField(
      "recurring.frameRules",
      recurring.frameRules.filter((_, i) => i !== index),
    );
  }

  function updateFrameRule(
    index: number,
    updater: (current: FrameRule) => FrameRule,
  ) {
    setField(
      "recurring.frameRules",
      recurring.frameRules.map((r, i) => (i === index ? updater(r) : r)),
    );
  }

  // --- submit ---------------------------------------------------------------

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
      if (mode === "edit" && editingId) {
        const patchRes = await fetch(`/api/events/${editingId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            title: identity.title,
            description: identity.description,
            start: time.span.start,
            end: time.span.end,
            allDay,
            color: identity.visual.color,
            project: meta.project,
            tags: meta.tags,
            memo: meta.memo,
          }),
        });
        if (!patchRes.ok) {
          const body = await patchRes.text();
          throw new Error(`${t("quickCreate.updateError")} (status:${patchRes.status}) ${body}`);
        }
      } else {
        const result = await submitCreateTile({ client });
        if (!result.ok) {
          throw new Error(
            `${t("quickCreate.createError")} (api:${result.error.kind}) ${result.error.message}`,
          );
        }
      }
      reset();
      setAllDay(true);
      setActivePanel("base");
      setMemoExpanded(false);
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
      const res = await fetch(`/api/events/${editingId}`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) {
        const body = await res.text();
        throw new Error(`${t("quickCreate.deleteError")} (status:${res.status}) ${body}`);
      }
      reset();
      setAllDay(true);
      setActivePanel("base");
      setMemoExpanded(false);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("quickCreate.deleteError"));
    } finally {
      setSubmitting(false);
    }
  }

  const panelClass = isDesktop
    ? cn(
        "fixed inset-y-0 right-0 z-[56]",
        "w-[32rem] flex flex-col bg-surface-0 shadow-lg border-l border-border transition-all duration-300 ease-out",
        isClosing
          ? "translate-x-full opacity-0"
          : activePanel !== "base"
            ? "-translate-x-6 brightness-[0.7]"
            : "translate-x-0",
        "[animation:slideInFromRight_0.22s_ease-out]",
      )
    : cn(
        "fixed inset-x-0 bottom-0 z-[56]",
        "h-[85vh] flex flex-col rounded-t-2xl bg-surface-0 shadow-lg transition-all duration-300 ease-out",
        isClosing
          ? "translate-y-full opacity-0"
          : activePanel !== "base"
            ? "translate-y-6 brightness-[0.7]"
            : "translate-y-0",
        "[animation:slideInFromBottom_0.22s_ease-out]",
      );

  const subPanelClass = (panel: "time" | "recurring" | "references" | "completion" | "planning" | "metrics" | "decisions" | "recurringRules" | "meta") =>
    isDesktop
      ? cn(
          "fixed inset-y-0 right-0 z-[57]",
          "w-[28rem] flex flex-col bg-surface-0 shadow-2xl border-l border-border transition-transform duration-300 ease-out",
          activePanel === panel ? "translate-x-0" : "translate-x-full pointer-events-none",
        )
      : cn(
          "fixed inset-x-0 bottom-0 z-[57]",
          "h-[85vh] flex flex-col rounded-t-2xl bg-surface-0 shadow-2xl transition-transform duration-300 ease-out",
          activePanel === panel ? "translate-y-0" : "translate-y-full pointer-events-none",
        );

  return (
    <>
      <div
        data-testid="quick-create-backdrop"
        className={cn(
          "fixed inset-0 z-[55] bg-foreground/10 backdrop-blur-[1px] transition-opacity duration-300 ease-out",
          isClosing ? "opacity-0 pointer-events-none" : "opacity-100",
        )}
        onClick={() => {
          if (activePanel !== "base") {
            setActivePanel("base");
          } else {
            close();
          }
        }}
        aria-hidden
      />
      <section className={panelClass} aria-label={t("quickCreate.title")}>
        <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-section">
          <h2 className="text-base font-semibold text-foreground">
            {t("quickCreate.title")}
          </h2>
          <button
            type="button"
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-2 transition-colors"
            aria-label={locale === "ja" ? "パネルを閉じる" : "Close panel"}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <FormPanel>
            {/* §1 Identity */}
            <FormRow
              icon={
                <div className="relative" ref={popoverRef}>
                  {/* テーマカラーで塗りつぶされた丸バッジと白抜きアイコンのボタン */}
                  <button
                    type="button"
                    onClick={() => setVisualOpen(!visualOpen)}
                    aria-expanded={visualOpen}
                    aria-label={t("quickCreate.visualTitle")}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-white transition-all hover:scale-105 active:scale-95"
                    style={{
                      backgroundColor: identity.visual.color || "#94a3b8",
                    }}
                  >
                    {(() => {
                      const found = AVAILABLE_ICONS.find((i) => i.name === identity.visual.icon);
                      if (found) {
                        const IconComp = found.icon;
                        return <IconComp size={14} />;
                      }
                      return <FileText size={14} />;
                    })()}
                  </button>

                  {visualOpen && (
                    <div className="absolute top-full left-0 z-50 mt-2 w-64 rounded-lg border border-border bg-surface-0 p-3 shadow-xl [animation:slideInFromTop_0.15s_ease-out] space-y-4">
                      {/* Color Picker Section */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted block">
                          {t("quickCreate.visualColorLabel")}
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {PRESET_COLORS.map((c) => {
                            const isSelected = identity.visual.color === c;
                            return (
                              <button
                                key={c}
                                type="button"
                                onClick={() => setField("identity.visual.color", c)}
                                className={cn(
                                  "h-5 w-5 rounded-full border transition-transform hover:scale-110 focus:outline-hidden",
                                  isSelected ? "border-foreground scale-110 ring-2 ring-primary/20" : "border-black/10"
                                )}
                                style={{ backgroundColor: c }}
                                aria-label={c}
                              />
                            );
                          })}
                          {/* Custom Color Input */}
                          <label className="relative h-5 w-5 rounded-full border border-black/10 flex items-center justify-center cursor-pointer hover:bg-surface-2 transition-colors">
                            <Palette size={10} className="text-foreground-muted" />
                            <input
                              type="color"
                              aria-label={t("quickCreate.visualColorLabel")}
                              value={normalizeHexColor(identity.visual.color)}
                              onChange={(e) => setField("identity.visual.color", e.target.value)}
                              className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                            />
                          </label>
                        </div>
                      </div>

                      {/* Icon Selector Section */}
                      <div className="space-y-1.5">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted block">
                          {t("quickCreate.visualIconLabel")}
                        </span>
                        <div className="grid grid-cols-4 gap-1.5">
                          {AVAILABLE_ICONS.map(({ name, icon: IconComp }) => {
                            const isSelected = identity.visual.icon === name;
                            return (
                              <button
                                key={name}
                                type="button"
                                onClick={() => setField("identity.visual.icon", name)}
                                className={cn(
                                  "flex h-8 w-8 items-center justify-center rounded-md border transition-all hover:bg-surface-2",
                                  isSelected
                                    ? "border-primary bg-primary/10 text-primary"
                                    : "border-border/40 text-foreground-muted"
                                )}
                                title={name}
                                aria-label={name}
                              >
                                <IconComp size={16} />
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              }
            >
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
                className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground-muted focus:outline-hidden"
              />
            </FormRow>

            <FormRow icon={null}>
              <Textarea
                value={identity.description ?? ""}
                onChange={(e) =>
                  setField(
                    "identity.description",
                    e.target.value.trim() ? e.target.value : null,
                  )
                }
                placeholder={t("quickCreate.descriptionPlaceholder")}
                aria-label={t("quickCreate.descriptionPlaceholder")}
                rows={2}
                className="w-full resize-none border-0 bg-transparent p-0 text-sm focus:ring-0"
              />
            </FormRow>

            <FormDivider />

            <RowSegmented
              icon={CheckCircle2}
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

            <button
              type="button"
              onClick={() => setActivePanel("time")}
              aria-label={t("quickCreate.timeNavTitle")}
              data-testid="quick-create-time-open"
              className="flex w-full items-center gap-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Clock size={14} aria-hidden="true" />
              <span className="flex-1 text-left">{t("quickCreate.timeNavTitle")}</span>
              <ChevronRight size={14} aria-hidden="true" />
            </button>
            <RowToggle
              icon={Calendar}
              placeholder={t("quickCreate.allDay")}
              checked={allDay}
              onChange={setAllDay}
            />
            <ScheduleRow
              allDay={allDay}
              spanStart={time.span.start}
              spanEnd={time.span.end}
              onStartChange={(value) => setField("time.span.start", value)}
              onEndChange={(value) => setField("time.span.end", value)}
              locale={locale}
              t={t}
            />
            <DurationRow
              minMs={time.durationMinMax.minMs}
              maxMs={time.durationMinMax.maxMs}
              onChange={(value) => setField("time.durationMinMax.minMs", value)}
              t={t}
            />

            {kindIsRecurring ? (
              <>
                <FormDivider />
                <RowSubPanel
                  icon={Repeat}
                  name={t("quickCreate.recurrenceNavTitle")}
                  value={
                    recurring.frameRules.length > 0
                      ? String(recurring.frameRules.length)
                      : ""
                  }
                  onClick={() => setActivePanel("recurring")}
                />
              </>
            ) : null}

            <FormDivider />

            <RowSubPanel
              icon={Link2}
              name={t("quickCreate.referencesNavTitle")}
              value={plan.references.length > 0 ? String(plan.references.length) : ""}
              onClick={() => setActivePanel("references")}
            />
            <div className="mt-1 mb-2 text-[10px] text-foreground-muted">
              {plan.references[0] ? (t("quickCreate.referenceKindLabel") + ": " + t("quickCreate.referenceKind" + (["moment", "calendar", "frame", "tag", "project", "fact"][plan.references[0].target.kind] ?? "moment"))) : t("quickCreate.referenceEmptyHint")}
            </div>

            <div
              className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted pt-2"
            >
              <ListChecks size={14} aria-hidden="true" />
              <span>{t("quickCreate.completionNavTitle")}</span>
              <button
                type="button"
                onClick={() => setActivePanel("completion")}
                aria-label={t("quickCreate.completionNavTitle")}
                className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-1 hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-1 mb-2 text-[10px] text-foreground-muted">
              {t("quickCreate.completionRootKindLabel") + ": " + completionRootLabel + " " + t("quickCreate.rootWithChildrenHint")}
            </div>
            <div className="space-y-2">
              {plan.completion.timeRequirements.length === 0 && plan.completion.tasks.length === 0 ? (
                <p className="text-xs text-foreground-muted">{t("quickCreate.empty")}</p>
              ) : null}
              {plan.completion.timeRequirements.map((tr, i) => (
                <div key={tr.id} className="rounded-md border border-border bg-surface-0 p-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-foreground-muted">timeRequirement</span>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      icon={<Trash2 size={12} aria-hidden="true" />}
                      onClick={() => {
                        const next = plan.completion.timeRequirements.slice();
                        next.splice(i, 1);
                        setField("plan.completion.timeRequirements", next);
                      }}
                      aria-label={t("quickCreate.removeItem")}
                      className="text-foreground-muted hover:text-danger"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="block text-foreground-muted">scope</span>
                      <input
                        type="number"
                        value={tr.observation.scope}
                        onChange={(e) => {
                          const next = plan.completion.timeRequirements.slice();
                          next[i] = { ...tr, observation: { ...tr.observation, scope: Number(e.target.value) as never } };
                          setField("plan.completion.timeRequirements", next);
                        }}
                        className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-foreground-muted">min</span>
                      <input
                        type="number"
                        value={tr.required.minMs === null ? "" : Math.round((tr.required.minMs ?? 0) / 60000)}
                        onChange={(e) => {
                          const next = plan.completion.timeRequirements.slice();
                          const v = e.target.value;
                          next[i] = { ...tr, required: { ...tr.required, minMs: v === "" ? null : Number(v) * 60000 } };
                          setField("plan.completion.timeRequirements", next);
                        }}
                        className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </label>
                  </div>
                </div>
              ))}
              {plan.completion.tasks.map((tk, i) => (
                <div key={tk.id} className="rounded-md border border-border bg-surface-0 p-2 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] text-foreground-muted">task</span>
                    <Button
                      type="button"
                      size="icon-xs"
                      variant="ghost"
                      icon={<Trash2 size={12} aria-hidden="true" />}
                      onClick={() => {
                        const next = plan.completion.tasks.slice();
                        next.splice(i, 1);
                        setField("plan.completion.tasks", next);
                      }}
                      aria-label={t("quickCreate.removeItem")}
                      className="text-foreground-muted hover:text-danger"
                    />
                  </div>
                  <label className="block space-y-1">
                    <span className="block text-foreground-muted">title</span>
                    <input
                      type="text"
                      value={tk.content?.title ?? ""}
                      onChange={(e) => {
                        const next = plan.completion.tasks.slice();
                        next[i] = { ...tk, content: { title: e.target.value, note: tk.content?.note ?? null } };
                        setField("plan.completion.tasks", next);
                      }}
                      className="w-full rounded-md bg-surface-2 px-2 py-1 text-left outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                </div>
              ))}
              <div className="flex flex-wrap gap-1.5">
                <Button
                  type="button"
                  size="small"
                  variant="default"
                  rounded
                  iconLeft={<Plus size={12} aria-hidden="true" />}
                  onClick={() => {
                    setField("plan.completion.timeRequirements", [
                      ...plan.completion.timeRequirements,
                      { id: "tr_" + Math.random().toString(36).slice(2, 9), observation: { scope: 0 as never }, required: { minMs: 60 * 60000 } },
                    ]);
                  }}
                >
                  {t("quickCreate.timeRequirement")}
                </Button>
                <Button
                  type="button"
                  size="small"
                  variant="default"
                  rounded
                  iconLeft={<Plus size={12} aria-hidden="true" />}
                  onClick={() => {
                    setField("plan.completion.tasks", [
                      ...plan.completion.tasks,
                      { id: "tk_" + Math.random().toString(36).slice(2, 9), content: { title: "", note: null }, show: null, complete: { id: "c_" + Math.random().toString(36).slice(2, 9), kind: 0, children: [], term: null }, order: [] },
                    ]);
                  }}
                >
                  {t("quickCreate.task")}
                </Button>
              </div>
            </div>

            <RowSubPanel
              icon={Layers}
              name={t("quickCreate.planningNavTitle")}
              value=""
              emptyLabel={t("quickCreate.phaseNotReady")}
              disabled
            />

            <RowSubPanel
              icon={BarChart3}
              name={t("quickCreate.metricsNavTitle")}
              value=""
              emptyLabel={t("quickCreate.phaseNotReady")}
              disabled
            />

            <RowSubPanel
              icon={GitBranch}
              name={t("quickCreate.decisionsNavTitle")}
              value=""
              emptyLabel={t("quickCreate.phaseNotReady")}
              disabled
            />

            {kindIsRecurring ? (
              <RowSubPanel
                icon={Settings2}
                name={t("quickCreate.recurringRulesNavTitle")}
                value=""
                emptyLabel={t("quickCreate.phaseNotReady")}
                disabled
              />
            ) : null}

            <FormDivider />

            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
              <FolderOpen size={14} aria-hidden="true" />
              <span>{t("quickCreate.metaNavTitle")}</span>
              <button
                type="button"
                onClick={() => setActivePanel("meta")}
                aria-label={t("quickCreate.metaExpandAria")}
                className="ml-auto flex h-6 w-6 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-1 hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
              >
                <ChevronRight size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="relative" data-testid="project-suggest-row" data-open={String(projectSuggest)}>
            <FormRow icon={null}>
              <input
                type="text"
                value={meta.project ?? ""}
                onChange={(e) => {
                  setField("meta.project", e.target.value.trim() ? e.target.value : null);
                  setProjectSuggest(true);
                }}
                onFocus={() => setProjectSuggest(true)}
                onBlur={() => setTimeout(() => setProjectSuggest(false), 150)}
                placeholder={t("quickCreate.projectPlaceholder")}
                aria-label={t("quickCreate.projectPlaceholder")}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground-muted focus:outline-hidden"
              />
            </FormRow>
            {projectSuggest ? (
              <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-surface-1 py-1 shadow-lg">
                {Object.values(projects)
                  .filter((p) => !meta.project || p.name.toLowerCase().includes(meta.project.toLowerCase()))
                  .slice(0, 8)
                  .map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setField("meta.project", p.name);
                          setProjectSuggest(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-2 focus:outline-hidden"
                      >
                        <FolderOpen size={12} aria-hidden="true" />
                        <span className="truncate">{p.name}</span>
                      </button>
                    </li>
                  ))}
                <li>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      const v = (meta.project ?? "").trim();
                      if (v) setField("meta.project", v);
                      setProjectSuggest(false);
                    }}
                    className="flex w-full items-center gap-2 border-t border-border px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface-2 focus:outline-hidden"
                  >
                    <Plus size={12} aria-hidden="true" />
                    <span className="truncate">{((meta.project ?? "").trim() || t("quickCreate.projectCreateNew"))}</span>
                  </button>
                </li>
              </ul>
            ) : null}
          </div>
            <div className="relative" data-testid="tag-suggest-row" data-open={String(tagSuggest)}>
            <FormRow icon={null}>
              <div className="flex w-full flex-wrap items-center gap-1.5">
                {meta.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setField(
                          "meta.tags",
                          meta.tags.filter((x) => x !== tag),
                        )
                      }
                      aria-label={t("quickCreate.removeItem")}
                      className="text-foreground-muted hover:text-danger focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <X size={10} aria-hidden="true" />
                    </button>
                  </span>
                ))}
                <input
                  ref={tagInputRef}
                  type="text"
                  placeholder={t("quickCreate.tagsPlaceholder")}
                  aria-label={t("quickCreate.tagsPlaceholder")}
                  className="min-w-[8ch] flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-muted focus:outline-hidden"
                  onFocus={(e) => { setTagInputDraft(e.currentTarget.value); setTagSuggest(true); }}
                  onBlur={() => setTimeout(() => setTagSuggest(false), 150)}
                  onChange={(e) => {
                    setTagInputDraft(e.target.value);
                    setTagSuggest(true);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === ",") {
                      e.preventDefault();
                      const v = (e.currentTarget.value || "").trim();
                      if (!v) return;
                      if (meta.tags.includes(v)) return;
                      setField("meta.tags", [...meta.tags, v]);
                      e.currentTarget.value = "";
                      setTagInputDraft("");
                    }
                  }}
                />
              </div>
            </FormRow>
            {tagSuggest ? (() => {
              const draft = tagInputDraft.trim();
              const known = Array.from(new Set(Object.values(projects).flatMap((p) => p.labelFilter))).filter((t) => !meta.tags.includes(t) && (!draft || t.toLowerCase().includes(draft.toLowerCase())));
              if (known.length === 0 && !draft) {
                return (
                  <ul className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border border-border bg-surface-1 py-1 shadow-lg">
                    <li>
                      <button
                        type="button"
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          if (tagInputRef.current) { tagInputRef.current.value = ""; }
                          setTagInputDraft("");
                          setTagSuggest(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface-2 focus:outline-hidden"
                      >
                        <Plus size={12} aria-hidden="true" />
                        <span className="truncate">{t("quickCreate.tagCreateHint") ?? "タグ名を入力して Enter"}</span>
                      </button>
                    </li>
                  </ul>
                );
              }
              return (
                <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-40 overflow-y-auto rounded-md border border-border bg-surface-1 py-1 shadow-lg">
                  {known.slice(0, 8).map((tag) => (
                    <li key={tag}>
                      <button
                        type="button"
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          setField("meta.tags", [...meta.tags, tag]);
                          if (tagInputRef.current) { tagInputRef.current.value = ""; }
                          setTagInputDraft("");
                          setTagSuggest(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface-2 focus:outline-hidden"
                      >
                        <Tag size={12} aria-hidden="true" />
                        <span className="truncate">#{tag}</span>
                      </button>
                    </li>
                  ))}
                  {draft ? (
                    <li>
                      <button
                        type="button"
                        onMouseDown={(ev) => {
                          ev.preventDefault();
                          setField("meta.tags", [...meta.tags, draft]);
                          if (tagInputRef.current) { tagInputRef.current.value = ""; }
                          setTagInputDraft("");
                          setTagSuggest(false);
                        }}
                        className="flex w-full items-center gap-2 border-t border-border px-3 py-1.5 text-sm text-foreground-muted hover:bg-surface-2 focus:outline-hidden"
                      >
                        <Plus size={12} aria-hidden="true" />
                        <span className="truncate">#{draft}</span>
                      </button>
                    </li>
                  ) : null}
                </ul>
              );
            })() : null}
          </div>
          </FormPanel>
        </div>

        <div className="border-t border-border bg-surface-0 p-section shrink-0 space-y-3">
<RowToggle
            icon={Tag}
            placeholder={t("quickCreate.labelOnly")}
            checked={plan.role === PlanRole.LABEL}
            onChange={(checked) =>
              setField(
                "plan.role",
                checked ? PlanRole.LABEL : PlanRole.EXECUTABLE,
              )
            }
          />
          {mode === "edit" ? (
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="danger"
                size="large"
                data-testid="quick-create-delete"
                onClick={handleDelete}
                disabled={submitting}
                className="h-10"
                iconLeft={<Trash2 size={14} aria-hidden="true" />}
              >
                {t("quickCreate.delete")}
              </Button>
              <Button
                type="button"
                variant="primary"
                size="large"
                block
                data-testid="quick-create-submit"
                onClick={handleSubmit}
                loading={submitting}
                disabled={submitting || !canSubmit || !titleOk || !spanOrderValid}
                className="h-10"
              >
                {submitting ? t("quickCreate.saving") : t("quickCreate.save")}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="large"
              block
              data-testid="quick-create-submit"
              onClick={handleSubmit}
              loading={submitting}
              disabled={submitting || !canSubmit || !titleOk || !spanOrderValid}
              className="h-10"
            >
              {submitting ? t("quickCreate.saving") : t("quickCreate.commit")}
            </Button>
          )}
          {error ? (
            <p
              className="mt-2 text-center text-xs text-danger"
            >
              {error}
            </p>
          ) : null}
        </div>
      </section>

        <section className={subPanelClass("time")} aria-hidden={activePanel !== "time"}>
          <div className="flex items-center gap-2 border-b border-border px-section py-3 shrink-0">
            <button
              type="button"
              onClick={() => setActivePanel("base")}
              aria-label={t("quickCreate.back")}
              className="flex items-center gap-1 rounded-md px-1 py-1 text-sm text-foreground hover:bg-surface-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              <span>{t("quickCreate.back")}</span>
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setActivePanel("base")}
              aria-label={t("quickCreate.cancel")}
              className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-1 hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <FormPanel>
            <SectionHeader icon={Clock} title={t("quickCreate.timeNavTitle")} />
            <RowToggle
              icon={Calendar}
              placeholder={t("quickCreate.allDay")}
              checked={allDay}
              onChange={setAllDay}
            />
            <ScheduleRow
              allDay={allDay}
              spanStart={time.span.start}
              spanEnd={time.span.end}
              onStartChange={(value) => setField("time.span.start", value)}
              onEndChange={(value) => setField("time.span.end", value)}
              locale={locale}
              t={t}
            />
            <FormDivider />
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted block">
                  {t("quickCreate.minMsLabel")}
                </span>
                <input
                  type="number"
                  min={0}
                  step={5}
                  aria-label={t("quickCreate.minMsLabel")}
                  value={time.durationMinMax.minMs !== null ? Math.round(time.durationMinMax.minMs / 60000) : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setField(
                      "time.durationMinMax.minMs",
                      v === "" ? null : Number(v) * 60000,
                    );
                  }}
                  className="w-full rounded-md bg-surface-2 px-3 py-2 text-right text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
              <div className="space-y-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted block">
                  {t("quickCreate.maxMsLabel")}
                </span>
                <input
                  type="number"
                  min={0}
                  step={5}
                  aria-label={t("quickCreate.maxMsLabel")}
                  value={time.durationMinMax.maxMs !== null ? Math.round(time.durationMinMax.maxMs / 60000) : ""}
                  onChange={(e) => {
                    const v = e.target.value;
                    setField(
                      "time.durationMinMax.maxMs",
                      v === "" ? null : Number(v) * 60000,
                    );
                  }}
                  className="w-full rounded-md bg-surface-2 px-3 py-2 text-right text-sm text-foreground outline-none focus:ring-2 focus:ring-primary/40"
                />
              </div>
            </div>
            <p className="mt-1 text-[10px] text-foreground-muted">
              {t("quickCreate.minutesUnit")}
            </p>
            <FormDivider />
            <SectionHeader icon={Calendar} title={t("quickCreate.windowsNavTitle")} />
            {windows.map((w, i) => (
              <WindowRow
                key={w.id}
                window={w}
                index={i}
                onUpdate={updateWindow}
                onRemove={removeWindow}
                t={t}
                locale={locale}
              />
            ))}
            <Button
              type="button"
              size="small"
              variant="default"
              rounded
              iconLeft={<Plus size={12} aria-hidden="true" />}
              onClick={addWindow}
            >
              {t("quickCreate.windowsAdd")}
            </Button>
          </FormPanel>
        </section>

        <section className={subPanelClass("recurring")} aria-hidden={activePanel !== "recurring"}>
          <div className="flex items-center gap-2 border-b border-border px-section py-3 shrink-0">
            <button
              type="button"
              onClick={() => setActivePanel("base")}
              aria-label={t("quickCreate.back")}
              className="flex items-center gap-1 rounded-md px-1 py-1 text-sm text-foreground hover:bg-surface-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              <span>{t("quickCreate.back")}</span>
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setActivePanel("base")}
              aria-label={t("quickCreate.cancel")}
              className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-1 hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <FormPanel>
            <SectionHeader icon={Repeat} title={t("quickCreate.recurrenceNavTitle")} />
            <div
              role="tablist"
              aria-label={t("quickCreate.recurrenceNavTitle")}
              className="flex border-b border-border"
            >
              {(
                [
                  { id: "lifecycle", labelKey: "recurringTabLifecycle" },
                  { id: "generator", labelKey: "recurringTabGenerator" },
                  { id: "window", labelKey: "recurringTabWindow" },
                ] as const
              ).map((tab) => {
                const active = recurringTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setRecurringTab(tab.id)}
                    className={cn(
                      "flex-1 px-2 py-1.5 text-xs font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                      active
                        ? "bg-primary text-primary-fg"
                        : "text-foreground-muted hover:bg-surface-2",
                    )}
                  >
                    {t(`quickCreate.${tab.labelKey}`)}
                  </button>
                );
              })}
            </div>
            {recurringTab === "lifecycle" ? (
              <>
                <RecurringLifeEditor
                  activeStart={recurring.life.active.startDate}
                  activeEnd={recurring.life.active.endDate}
                  state={recurring.life.state}
                  onActiveStartChange={(value) =>
                    setField("recurring.life.active.startDate", value)
                  }
                  onActiveEndChange={(value) =>
                    setField("recurring.life.active.endDate", value)
                  }
                  onStateChange={(value) =>
                    setField("recurring.life.state", value)
                  }
                  t={t}
                />
                <FrameRulesList
                  rules={recurring.frameRules}
                  onAdd={addFrameRule}
                  onRemove={removeFrameRule}
                  onUpdate={updateFrameRule}
                  t={t}
                />
              </>
            ) : null}
            {recurringTab === "generator" ? (
              <GeneratorEditor
                recurrence={recurrence}
                onChange={(next) => setField("recurrence", next)}
                t={t}
              />
            ) : null}
            {recurringTab === "window" ? (
              <WindowEditor
                recurrence={recurrence}
                onChange={(next) => setField("recurrence", next)}
                t={t}
                locale={locale}
              />
            ) : null}
          </FormPanel>
        </section>

        <section className={subPanelClass("references")} aria-hidden={activePanel !== "references"}>
          <div className="flex items-center gap-2 border-b border-border px-section py-3 shrink-0">
            <button
              type="button"
              onClick={() => setActivePanel("base")}
              aria-label={t("quickCreate.back")}
              className="flex items-center gap-1 rounded-md px-1 py-1 text-sm text-foreground hover:bg-surface-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              <span>{t("quickCreate.back")}</span>
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setActivePanel("base")}
              aria-label={t("quickCreate.cancel")}
              className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-1 hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <FormPanel>
            <SectionHeader icon={Link2} title={t("quickCreate.referencesNavTitle")} />
            <div className="space-y-2">
              {plan.references.length === 0 ? (
                <p className="text-xs text-foreground-muted">{t("quickCreate.empty")}</p>
              ) : null}
              {plan.references.map((ref, i) => (
                <div key={i} className="space-y-1 rounded-md border border-border bg-surface-0 p-2">
                  <label className="block space-y-1 text-xs">
                    <span className="block text-foreground-muted">id</span>
                    <input
                      type="text"
                      value={ref.id}
                      onChange={(e) => {
                        const next = plan.references.slice();
                        next[i] = { ...ref, id: e.target.value };
                        setField("plan.references", next);
                      }}
                      className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  <label className="block space-y-1 text-xs">
                    <span className="block text-foreground-muted">target.kind</span>
                    <input
                      type="number"
                      value={ref.target.kind}
                      onChange={(e) => {
                        const next = plan.references.slice();
                        next[i] = { ...ref, target: { ...ref.target, kind: Number(e.target.value) } };
                        setField("plan.references", next);
                      }}
                      className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    icon={<Trash2 size={14} aria-hidden="true" />}
                    onClick={() => {
                      const next = plan.references.slice();
                      next.splice(i, 1);
                      setField("plan.references", next);
                    }}
                    aria-label={t("quickCreate.removeItem")}
                    className="text-foreground-muted hover:text-danger"
                  />
                </div>
              ))}
              <Button
                type="button"
                size="small"
                variant="default"
                rounded
                iconLeft={<Plus size={12} aria-hidden="true" />}
                onClick={() => {
                  setField("plan.references", [
                    ...plan.references,
                    { id: "", target: { kind: 0, contextKind: null, referenceId: null, conditionId: null }, pick: { kind: 0, momentId: null } },
                  ]);
                }}
              >
                {t("quickCreate.addReference")}
              </Button>
            </div>
          </FormPanel>
        </section>

        <section className={subPanelClass("completion")} aria-hidden={activePanel !== "completion"}>
          <div className="flex items-center gap-2 border-b border-border px-section py-3 shrink-0">
            <button
              type="button"
              onClick={() => setActivePanel("base")}
              aria-label={t("quickCreate.back")}
              className="flex items-center gap-1 rounded-md px-1 py-1 text-sm text-foreground hover:bg-surface-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              <span>{t("quickCreate.back")}</span>
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setActivePanel("base")}
              aria-label={t("quickCreate.cancel")}
              className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-1 hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <FormPanel>
            <SectionHeader icon={ListChecks} title={t("quickCreate.completionNavTitle")} />
            <div className="flex flex-col gap-1">
              <ConditionEditor
                node={plan.completion.root}
                onChange={(next) => setField("plan.completion.root", next)}
                t={t}
              />
            </div>
            <FormDivider />
            <SectionHeader icon={ListChecks} title={t("quickCreate.timeRequirements")} />
            <div className="space-y-2">
              {plan.completion.timeRequirements.length === 0 ? (
                <p className="text-xs text-foreground-muted">{t("quickCreate.empty")}</p>
              ) : null}
              {plan.completion.timeRequirements.map((tr, i) => (
                <div key={tr.id} className="rounded-md border border-border bg-surface-0 p-2 text-xs space-y-1">
                  <p className="font-mono text-[10px] text-foreground-muted">{tr.id}</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="space-y-1">
                      <span className="block text-foreground-muted">scope</span>
                      <input
                        type="number"
                        value={tr.observation.scope}
                        onChange={(e) => {
                          const next = plan.completion.timeRequirements.slice();
                          next[i] = {
                            ...tr,
                            observation: { ...tr.observation, scope: Number(e.target.value) as never },
                          };
                          setField("plan.completion.timeRequirements", next);
                        }}
                        className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </label>
                    <label className="space-y-1">
                      <span className="block text-foreground-muted">min</span>
                      <input
                        type="number"
                        value={tr.required.minMs === null ? "" : Math.round((tr.required.minMs ?? 0) / 60000)}
                        onChange={(e) => {
                          const next = plan.completion.timeRequirements.slice();
                          const v = e.target.value;
                          next[i] = {
                            ...tr,
                            required: {
                              ...tr.required,
                              minMs: v === "" ? null : Number(v) * 60000,
                            },
                          };
                          setField("plan.completion.timeRequirements", next);
                        }}
                        className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40"
                      />
                    </label>
                  </div>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    icon={<Trash2 size={14} aria-hidden="true" />}
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
              <Button
                type="button"
                size="small"
                variant="default"
                rounded
                iconLeft={<Plus size={12} aria-hidden="true" />}
                onClick={() => {
                  setField("plan.metrics", [
                    ...plan.metrics,
                    { id: "m_" + Math.random().toString(36).slice(2, 9), output: 0, expression: { kind: "literal", value: 0 }, limit: null },
                  ]);
                }}
              >
                {t("quickCreate.addMetric")}
              </Button>
            </div>
          </FormPanel>
        </section>

        <section className={subPanelClass("decisions")} aria-hidden={activePanel !== "decisions"}>
          <div className="flex items-center gap-2 border-b border-border px-section py-3 shrink-0">
            <button
              type="button"
              onClick={() => setActivePanel("base")}
              aria-label={t("quickCreate.back")}
              className="flex items-center gap-1 rounded-md px-1 py-1 text-sm text-foreground hover:bg-surface-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              <span>{t("quickCreate.back")}</span>
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setActivePanel("base")}
              aria-label={t("quickCreate.cancel")}
              className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-1 hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <FormPanel>
            <SectionHeader icon={GitBranch} title={t("quickCreate.decisionsNavTitle")} />
            <div className="space-y-2">
              {plan.decisions.length === 0 ? (
                <p className="text-xs text-foreground-muted">{t("quickCreate.empty")}</p>
              ) : null}
              {plan.decisions.map((d, i) => (
                <div key={d.id} className="rounded-md border border-border bg-surface-0 p-2 text-xs space-y-1">
                  <p className="font-mono text-[10px] text-foreground-muted">{d.id}</p>
                  <label className="block space-y-1">
                    <span className="block text-foreground-muted">prompt</span>
                    <input
                      type="text"
                      value={d.prompt}
                      onChange={(e) => {
                        const next = plan.decisions.slice();
                        next[i] = { ...d, prompt: e.target.value };
                        setField("plan.decisions", next);
                      }}
                      className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    icon={<Trash2 size={14} aria-hidden="true" />}
                    onClick={() => {
                      const next = plan.decisions.slice();
                      next.splice(i, 1);
                      setField("plan.decisions", next);
                    }}
                    aria-label={t("quickCreate.removeItem")}
                    className="text-foreground-muted hover:text-danger"
                  />
                </div>
              ))}
              <Button
                type="button"
                size="small"
                variant="default"
                rounded
                iconLeft={<Plus size={12} aria-hidden="true" />}
                onClick={() => {
                  setField("plan.decisions", [
                    ...plan.decisions,
                    { id: "d_" + Math.random().toString(36).slice(2, 9), kind: 0, when: null, prompt: "", options: [] },
                  ]);
                }}
              >
                {t("quickCreate.addDecision")}
              </Button>
            </div>
          </FormPanel>
        </section>

        <section className={subPanelClass("recurringRules")} aria-hidden={activePanel !== "recurringRules"}>
          <div className="flex items-center gap-2 border-b border-border px-section py-3 shrink-0">
            <button
              type="button"
              onClick={() => setActivePanel("base")}
              aria-label={t("quickCreate.back")}
              className="flex items-center gap-1 rounded-md px-1 py-1 text-sm text-foreground hover:bg-surface-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              <span>{t("quickCreate.back")}</span>
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setActivePanel("base")}
              aria-label={t("quickCreate.cancel")}
              className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-1 hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <FormPanel>
            <SectionHeader icon={Settings2} title={t("quickCreate.recurringRulesNavTitle")} />
            <div className="space-y-2">
              {recurring.rules.length === 0 ? (
                <p className="text-xs text-foreground-muted">{t("quickCreate.empty")}</p>
              ) : null}
              {recurring.rules.map((rule, i) => (
                <div key={rule.id} className="rounded-md border border-border bg-surface-0 p-2 text-xs space-y-2">
                  <p className="font-mono text-[10px] text-foreground-muted">{rule.id}</p>
                  <label className="block space-y-1">
                    <span className="block text-foreground-muted">when (rank)</span>
                    <input
                      type="number"
                      value={rule.rank}
                      onChange={(e) => {
                        const next = recurring.rules.slice();
                        next[i] = { ...rule, rank: Number(e.target.value) };
                        setField("recurring.rules", next);
                      }}
                      className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40"
                    />
                  </label>
                  {rule.when ? (
                    <ConditionEditor
                      node={rule.when}
                      onChange={(next) => {
                        const rulesNext = recurring.rules.slice();
                        rulesNext[i] = { ...rule, when: next };
                        setField("recurring.rules", rulesNext);
                      }}
                      t={t}
                    />
                  ) : null}
                  <Button
                    type="button"
                    size="icon-xs"
                    variant="ghost"
                    icon={<Trash2 size={14} aria-hidden="true" />}
                    onClick={() => {
                      const next = recurring.rules.slice();
                      next.splice(i, 1);
                      setField("recurring.rules", next);
                    }}
                    aria-label={t("quickCreate.removeItem")}
                    className="text-foreground-muted hover:text-danger"
                  />
                </div>
              ))}
              <Button
                type="button"
                size="small"
                variant="default"
                rounded
                iconLeft={<Plus size={12} aria-hidden="true" />}
                onClick={() => {
                  setField("recurring.rules", [
                    ...recurring.rules,
                    {
                      id: "rr_" + Math.random().toString(36).slice(2, 9),
                      when: null,
                      rank: 0,
                      outputs: [],
                    },
                  ]);
                }}
              >
                {t("quickCreate.addRecurringRule")}
              </Button>
            </div>
          </FormPanel>
        </section>

        <section className={subPanelClass("meta")} aria-hidden={activePanel !== "meta"}>
          <div className="flex items-center gap-2 border-b border-border px-section py-3 shrink-0">
            <button
              type="button"
              onClick={() => setActivePanel("base")}
              aria-label={t("quickCreate.back")}
              className="flex items-center gap-1 rounded-md px-1 py-1 text-sm text-foreground hover:bg-surface-1 focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <ChevronLeft size={16} aria-hidden="true" />
              <span>{t("quickCreate.back")}</span>
            </button>
            <div className="flex-1" />
            <button
              type="button"
              onClick={() => setActivePanel("base")}
              aria-label={t("quickCreate.cancel")}
              className="flex h-7 w-7 items-center justify-center rounded-md text-foreground-muted hover:bg-surface-1 hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
          <FormPanel>
            <SectionHeader icon={FolderOpen} title={t("quickCreate.metaNavTitle")} />
            <FormRow icon={null}>
              <input
                type="text"
                value={meta.project ?? ""}
                onChange={(e) =>
                  setField(
                    "meta.project",
                    e.target.value.trim() ? e.target.value : null,
                  )
                }
                placeholder={t("quickCreate.projectPlaceholder")}
                aria-label={t("quickCreate.projectPlaceholder")}
                className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground-muted focus:outline-hidden"
              />
            </FormRow>
            <FormRow icon={null}>
              <div className="flex w-full flex-wrap items-center gap-1.5">
                {meta.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-xs"
                  >
                    <span>#{tag}</span>
                    <button
                      type="button"
                      onClick={() =>
                        setField(
                          "meta.tags",
                          meta.tags.filter((x) => x !== tag),
                        )
                      }
                      aria-label={t("quickCreate.removeItem")}
                      className="text-foreground-muted hover:text-danger focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      <X size={10} aria-hidden="true" />
                    </button>
                  </span>
                ))}
                <input
                  type="text"
                  placeholder={t("quickCreate.tagsPlaceholder")}
                  aria-label={t("quickCreate.tagsPlaceholder")}
                  className="min-w-[8ch] flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-muted focus:outline-hidden"
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
            </FormRow>
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
          </FormPanel>
        </section>
    </>
  );
}

// ---------- section / row primitives ----------

function ConditionKindSegmented({
  value,
  onChange,
  t,
}: {
  value: number | import("@/lib/domain/v1/constants").ConditionKindValue;
  onChange: (v: number) => void;
  t: (k: string) => string;
}) {
  const options = [
    { value: String(ConditionKind.ALL), label: t("quickCreate.conditionAll") },
    { value: String(ConditionKind.ANY), label: t("quickCreate.conditionAny") },
    { value: String(ConditionKind.NOT), label: t("quickCreate.conditionNot") },
    { value: String(ConditionKind.TERM), label: t("quickCreate.conditionTerm") },
  ];
  return (
    <RowSegmented
      icon={GitBranch}
      options={options}
      value={String(value)}
      onChange={(v) => onChange(Number(v))}
    />
  );
}

function TermKindSegmented({
  value,
  onChange,
  t,
}: {
  value: string;
  onChange: (v: string) => void;
  t: (k: string) => string;
}) {
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
  return (
    <RowSegmented
      icon={ListChecks}
      options={options}
      value={value}
      onChange={onChange}
      compact
    />
  );
}

function defaultTerm(kind: string): Term {
  switch (kind) {
    case "calendar":
      return {
        kind: "calendar",
        value: {
          weekdayMask: 0,
          timeStart: null,
          timeEnd: null,
          holidayKind: HolidayKind.ANY,
          dateRange: null,
          offsetMin: 0,
        },
      };
    case "moment":
      return {
        kind: "moment",
        value: { referenceId: null, point: null, offsetMs: 0 },
      };
    case "relation":
      return {
        kind: "relation",
        value: { referenceId: "", relation: 0, windowKind: 0 },
      };
    case "gap":
      return {
        kind: "gap",
        value: {
          scope: 0,
          leftAnchor: { referenceId: null, point: null },
          rightAnchor: { referenceId: null, point: null },
          size: { minMs: null, maxMs: null },
        },
      };
    case "requirement":
      return {
        kind: "requirement",
        value: { requirementId: "", state: 0 },
      };
    case "task":
      return { kind: "task", value: { taskId: "", state: 0 } };
    case "fact":
      return { kind: "fact", value: { factId: "", op: 0, value: null } };
    case "metric":
      return { kind: "metric", value: { metricId: "", op: 0, value: null } };
    case "feedback":
      return {
        kind: "feedback",
        value: { feedbackTxnId: "", op: 0, value: null },
      };
    case "life":
      return { kind: "life", value: { target: "", state: 0 } };
    default:
      return {
        kind: "calendar",
        value: {
          weekdayMask: 0,
          timeStart: null,
          timeEnd: null,
          holidayKind: HolidayKind.ANY,
          dateRange: null,
          offsetMin: 0,
        },
      };
  }
}

function updateCalendar(
  term: Term,
  key: keyof import("@/lib/domain/v1/condition").CalendarTerm,
  value: import("@/lib/domain/v1/condition").CalendarTerm[keyof import("@/lib/domain/v1/condition").CalendarTerm],
) {
  if (term.kind !== "calendar") return term;
  return { kind: "calendar", value: { ...term.value, [key]: value } } as Term;
}
function updateMoment(
  term: Term,
  key: keyof import("@/lib/domain/v1/condition").MomentTerm,
  value: import("@/lib/domain/v1/condition").MomentTerm[keyof import("@/lib/domain/v1/condition").MomentTerm],
) {
  if (term.kind !== "moment") return term;
  return { kind: "moment", value: { ...term.value, [key]: value } } as Term;
}
function updateRelation(
  term: Term,
  key: keyof import("@/lib/domain/v1/condition").RelationTerm,
  value: import("@/lib/domain/v1/condition").RelationTerm[keyof import("@/lib/domain/v1/condition").RelationTerm],
) {
  if (term.kind !== "relation") return term;
  return { kind: "relation", value: { ...term.value, [key]: value } } as Term;
}
function updateTask(
  term: Term,
  key: keyof import("@/lib/domain/v1/condition").TaskTerm,
  value: import("@/lib/domain/v1/condition").TaskTerm[keyof import("@/lib/domain/v1/condition").TaskTerm],
) {
  if (term.kind !== "task") return term;
  return { kind: "task", value: { ...term.value, [key]: value } } as Term;
}
function updateRequirement(
  term: Term,
  key: keyof import("@/lib/domain/v1/condition").RequirementTerm,
  value: import("@/lib/domain/v1/condition").RequirementTerm[keyof import("@/lib/domain/v1/condition").RequirementTerm],
) {
  if (term.kind !== "requirement") return term;
  return {
    kind: "requirement",
    value: { ...term.value, [key]: value },
  } as Term;
}
function updateLife(
  term: Term,
  key: keyof import("@/lib/domain/v1/condition").LifeTerm,
  value: import("@/lib/domain/v1/condition").LifeTerm[keyof import("@/lib/domain/v1/condition").LifeTerm],
) {
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
            <span className="block text-foreground-muted">
              {t("quickCreate.calendarWeekdayMask")}
            </span>
            <input
              type="number"
              value={term.value.weekdayMask}
              onChange={(e) =>
                onChange(
                  updateCalendar(term, "weekdayMask", Number(e.target.value)),
                )
              }
              className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">
              {t("quickCreate.calendarOffsetMin")}
            </span>
            <input
              type="number"
              value={term.value.offsetMin}
              onChange={(e) =>
                onChange(
                  updateCalendar(term, "offsetMin", Number(e.target.value)),
                )
              }
              className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">
              {t("quickCreate.calendarTimeStart")}
            </span>
            <input
              type="time"
              value={term.value.timeStart ?? ""}
              onChange={(e) =>
                onChange(
                  updateCalendar(
                    term,
                    "timeStart",
                    e.target.value === "" ? null : e.target.value,
                  ),
                )
              }
              className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">
              {t("quickCreate.calendarTimeEnd")}
            </span>
            <input
              type="time"
              value={term.value.timeEnd ?? ""}
              onChange={(e) =>
                onChange(
                  updateCalendar(
                    term,
                    "timeEnd",
                    e.target.value === "" ? null : e.target.value,
                  ),
                )
              }
              className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        </div>
      );
    case "moment":
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-1">
            <span className="block text-foreground-muted">
              {t("quickCreate.momentReferenceId")}
            </span>
            <input
              type="text"
              value={term.value.referenceId ?? ""}
              onChange={(e) =>
                onChange(
                  updateMoment(
                    term,
                    "referenceId",
                    e.target.value === "" ? null : e.target.value,
                  ),
                )
              }
              className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">
              {t("quickCreate.momentOffsetMs")}
            </span>
            <input
              type="number"
              value={term.value.offsetMs}
              onChange={(e) =>
                onChange(updateMoment(term, "offsetMs", Number(e.target.value)))
              }
              className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        </div>
      );
    case "relation":
      return (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <label className="space-y-1">
            <span className="block text-foreground-muted">
              {t("quickCreate.relationReferenceId")}
            </span>
            <input
              type="text"
              value={term.value.referenceId}
              onChange={(e) =>
                onChange(updateRelation(term, "referenceId", e.target.value))
              }
              className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">
              {t("quickCreate.relationKind")}
            </span>
            <input
              type="number"
              value={term.value.relation}
              onChange={(e) =>
                onChange(
                  updateRelation(term, "relation", Number(e.target.value)),
                )
              }
              className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">
              {t("quickCreate.relationWindowKind")}
            </span>
            <input
              type="number"
              value={term.value.windowKind}
              onChange={(e) =>
                onChange(
                  updateRelation(term, "windowKind", Number(e.target.value)),
                )
              }
              className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        </div>
      );
    case "task":
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-1">
            <span className="block text-foreground-muted">
              {t("quickCreate.taskId")}
            </span>
            <input
              type="text"
              value={term.value.taskId}
              onChange={(e) => onChange(updateTask(term, "taskId", e.target.value))}
              className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">
              {t("quickCreate.taskState")}
            </span>
            <input
              type="number"
              value={term.value.state}
              onChange={(e) =>
                onChange(updateTask(term, "state", Number(e.target.value)))
              }
              className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        </div>
      );
    case "requirement":
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-1">
            <span className="block text-foreground-muted">
              {t("quickCreate.requirementId")}
            </span>
            <input
              type="text"
              value={term.value.requirementId}
              onChange={(e) =>
                onChange(
                  updateRequirement(term, "requirementId", e.target.value),
                )
              }
              className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">
              {t("quickCreate.requirementState")}
            </span>
            <input
              type="number"
              value={term.value.state}
              onChange={(e) =>
                onChange(
                  updateRequirement(term, "state", Number(e.target.value)),
                )
              }
              className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        </div>
      );
    case "metric":
    case "fact":
    case "feedback": {
      const v = term.value as unknown as { op: number; value: unknown; [k: string]: unknown };
      const idKey =
        term.kind === "fact"
          ? "factId"
          : term.kind === "metric"
            ? "metricId"
            : "feedbackTxnId";
      return (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <label className="space-y-1">
            <span className="block text-foreground-muted">ID</span>
            <input
              type="text"
              value={String(v[idKey] ?? "")}
              onChange={(e) =>
                onChange(updateValue(term, idKey, e.target.value))
              }
              className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">op</span>
            <input
              type="number"
              value={v.op}
              onChange={(e) =>
                onChange(updateValue(term, "op", Number(e.target.value)))
              }
              className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">value</span>
            <input
              type="text"
              value={v.value === null || v.value === undefined ? "" : String(v.value)}
              onChange={(e) => {
                const raw = e.target.value;
                if (raw === "") {
                  onChange(updateValue(term, "value", null));
                  return;
                }
                const num = Number(raw);
                onChange(
                  updateValue(
                    term,
                    "value",
                    Number.isFinite(num) && raw.trim() !== "" ? num : raw,
                  ),
                );
              }}
              className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        </div>
      );
    }
    case "life":
      return (
        <div className="grid grid-cols-2 gap-2 text-xs">
          <label className="space-y-1">
            <span className="block text-foreground-muted">target</span>
            <input
              type="text"
              value={term.value.target}
              onChange={(e) =>
                onChange(updateLife(term, "target", e.target.value))
              }
              className="w-full rounded-md bg-surface-2 px-2 py-1 outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
          <label className="space-y-1">
            <span className="block text-foreground-muted">state</span>
            <input
              type="number"
              value={term.value.state}
              onChange={(e) =>
                onChange(updateLife(term, "state", Number(e.target.value)))
              }
              className="w-full rounded-md bg-surface-2 px-2 py-1 text-right outline-none focus:ring-2 focus:ring-primary/40"
            />
          </label>
        </div>
      );
    case "gap":
      return (
        <p className="text-xs text-foreground-muted">
          {t("quickCreate.gapPlaceholder")}
        </p>
      );
    default:
      return null;
  }
}

function ConditionEditor({
  node,
  onChange,
  t,
}: {
  node: ConditionNode;
  onChange: (next: ConditionNode) => void;
  t: (k: string) => string;
}) {
  const isTerm = node.kind === ConditionKind.TERM;
  // Flat stack: no card border, no marginLeft indent, no inner pl-2.
  // The depth parameter is kept (and passed) for API stability but is
  // intentionally unused for layout so the whole condition tree reads
  // as a single vertical list, matching the rest of the side panel.
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
          <TermKindSegmented
            value={node.term?.kind ?? "calendar"}
            onChange={(k) =>
              onChange({
                kind: ConditionKind.TERM,
                children: [],
                term: defaultTerm(k),
              })
            }
            t={t}
          />
          {node.term ? (
            <TermFields
              term={node.term}
              onChange={(next) =>
                onChange({
                  kind: ConditionKind.TERM,
                  children: [],
                  term: next,
                })
              }
              t={t}
            />
          ) : null}
        </>
      ) : (
        <>
          {node.children.map((child, i) => (
            <div key={i} className="flex flex-col gap-1">
              <ConditionEditor
                node={child}
                onChange={(next) => {
                  const children = node.children.slice();
                  children[i] = next;
                  onChange({ ...node, children });
                }}
                t={t}
              />
              <Button
                type="button"
                size="icon-xs"
                variant="ghost"
                icon={<Trash2 size={14} aria-hidden="true" />}
                onClick={() => {
                  const children = node.children.slice();
                  children.splice(i, 1);
                  onChange({ ...node, children });
                }}
                aria-label={t("quickCreate.conditionRemoveChild")}
                className="self-start text-foreground-muted hover:text-danger"
              />
            </div>
          ))}
          <Button
            type="button"
            size="small"
            variant="default"
            rounded
            iconLeft={<Plus size={12} aria-hidden="true" />}
            onClick={() =>
              onChange({
                ...node,
                children: [
                  ...node.children,
                  {
                    kind: ConditionKind.TERM,
                    children: [],
                    term: defaultTerm("calendar"),
                  },
                ],
              })
            }
          >
            {t("quickCreate.conditionAddChild")}
          </Button>
        </>
      )}
    </div>
  );
}



function FullFieldList({
  data,
  emptyLabel,
}: {
  data: unknown;
  emptyLabel: string;
}) {
  // v1 full-parameter dump. The structured editors will replace this
  // incrementally, but every sub-panel must show the underlying data
  // so no v1 field is hidden.
  const serialized = (() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  })();
  const isEmpty =
    data === null ||
    data === undefined ||
    (Array.isArray(data) && data.length === 0) ||
    (typeof data === "object" &&
      !Array.isArray(data) &&
      data !== null &&
      Object.keys(data as object).length === 0);
  return (
    <div className="space-y-2">
      {isEmpty ? (
        <p className="text-xs text-foreground-muted">{emptyLabel}</p>
      ) : null}
      <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md bg-surface-2 p-3 text-[11px] leading-snug text-foreground-muted">
        {serialized}
      </pre>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: typeof AlertCircle;
  title: string;
}) {
  return (
    <div
      className="flex items-center gap-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted"
      data-testid="section-header"
    >
      <Icon size={14} aria-hidden="true" />
      <span>{title}</span>
    </div>
  );
}

function StubRow({
  icon: Icon,
  title,
  count,
  badge,
}: {
  icon: typeof AlertCircle;
  title: string;
  count: number;
  badge: string;
}) {
  return (
    <FormRow icon={<Icon size={20} />}>
      <div className="flex w-full items-center justify-between text-sm">
        <span className="text-foreground-muted">{title}</span>
        <span className="flex items-center gap-2 text-xs text-foreground-muted">
          <span>{count}</span>
          <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[10px] uppercase tracking-wide">
            {badge}
          </span>
        </span>
      </div>
    </FormRow>
  );
}

function ScheduleRow({
  allDay,
  spanStart,
  spanEnd,
  onStartChange,
  onEndChange,
  locale,
  t,
}: {
  allDay: boolean;
  spanStart: string;
  spanEnd: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  locale: "ja" | "en";
  t: (key: string) => string;
}) {
  const startInputRef = useRef<HTMLInputElement>(null);
  const endInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {/* 開始日時選択ボタン */}
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted block">
            {t("quickCreate.startAt")}
          </span>
          <button
            type="button"
            onClick={() => startInputRef.current?.showPicker()}
            className="w-full text-left rounded-md bg-surface-2 hover:bg-surface-3 transition-colors px-3 py-2 text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          >
            {formatDisplayDate(spanStart, allDay, locale)}
          </button>
          <input
            ref={startInputRef}
            type={allDay ? "date" : "datetime-local"}
            aria-label={`${t("quickCreate.startAt")} (${locale === "ja" ? (allDay ? "日付" : "日時") : (allDay ? "date" : "datetime")})`}
            value={allDay ? isoToLocalDate(spanStart) : isoToLocalDateTime(spanStart)}
            onChange={(e) => onStartChange(e.target.value)}
            className="sr-only"
          />
        </div>

        {/* 終了日時選択ボタン */}
        <div className="space-y-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-foreground-muted block">
            {t("quickCreate.endAt")}
          </span>
          <button
            type="button"
            onClick={() => endInputRef.current?.showPicker()}
            className="w-full text-left rounded-md bg-surface-2 hover:bg-surface-3 transition-colors px-3 py-2 text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
          >
            {formatDisplayDate(spanEnd, allDay, locale)}
          </button>
          <input
            ref={endInputRef}
            type={allDay ? "date" : "datetime-local"}
            aria-label={`${t("quickCreate.endAt")} (${locale === "ja" ? (allDay ? "日付" : "日時") : (allDay ? "date" : "datetime")})`}
            value={allDay ? isoToLocalDate(spanEnd) : isoToLocalDateTime(spanEnd)}
            onChange={(e) => onEndChange(e.target.value)}
            className="sr-only"
          />
        </div>
      </div>
    </>
  );
}

function DurationRow({
  minMs,
  maxMs,
  onChange,
  t,
}: {
  minMs: number | null;
  maxMs: number | null;
  onChange: (value: number | null) => void;
  t: (key: string) => string;
}) {
  const valueMin = minMs !== null ? Math.round(minMs / 60000) : 60;
  return (
    <FormRow icon={<Clock size={20} />}>
      <div className="grid w-full grid-cols-[1fr_auto_auto] items-center gap-2 text-sm">
        <span className="text-foreground-muted">{t("quickCreate.duration")}</span>
        <input
          type="number"
          min={0}
          step={5}
          aria-label={t("quickCreate.durationAriaLabel")}
          value={valueMin}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === "" ? null : Number(v) * 60000);
          }}
          className="w-20 rounded-md bg-surface-2 px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-primary/40"
        />
        <span className="text-foreground-muted">{t("quickCreate.minutesUnit")}</span>
      </div>
    </FormRow>
  );
}

function GeneratorEditor({
  recurrence,
  onChange,
  t,
}: {
  recurrence: RecurrenceModel | null;
  onChange: (next: RecurrenceModel) => void;
  t: (key: string) => string;
}) {
  if (recurrence === null) {
    return (
      <FormRow icon={<Repeat size={20} />}>
        <Button
          type="button"
          size="small"
          variant="default"
          rounded
          iconLeft={<Plus size={12} aria-hidden="true" />}
          onClick={() => onChange(defaultRecurrenceModel())}
        >
          {t("quickCreate.recurrenceEnable")}
        </Button>
      </FormRow>
    );
  }
  const generator = recurrence.generator;
  const updateGenerator = (
    updater: (current: RecurrenceModel["generator"]) => RecurrenceModel["generator"],
  ) => {
    onChange({ ...recurrence, generator: updater(generator) });
  };
  return (
    <>
      <RowSegmented
        icon={Repeat}
        options={[
          {
            value: "time_based",
            label: t("quickCreate.generatorTimeBased"),
          },
          {
            value: "focus_block_based",
            label: t("quickCreate.generatorFocusBlockBased"),
          },
        ]}
        value={generator.kind}
        onChange={(value) =>
          updateGenerator(() => {
            if (value === "time_based") {
              return {
                kind: "time_based",
                step_min: 1440,
                anchor_epoch_min: null,
              };
            }
            return {
              kind: "focus_block_based",
              phases: [{ focus_min: 25, break_min: 5 }],
            };
          })
        }
      />
      {generator.kind === "time_based" ? (
        <FormRow icon={<Clock size={20} />}>
          <div className="flex w-full items-center gap-2 text-sm">
            <label className="flex flex-1 items-center gap-1.5">
              <span className="text-foreground-muted">
                {t("quickCreate.stepMin")}
              </span>
              <input
                type="number"
                min={1}
                step={1}
                aria-label={t("quickCreate.stepMin")}
                value={generator.step_min}
                onChange={(e) =>
                  updateGenerator((current) => {
                    if (current.kind !== "time_based") return current;
                    return {
                      ...current,
                      step_min: Number(e.target.value) || 1,
                    };
                  })
                }
                className="w-24 rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </label>
          </div>
        </FormRow>
      ) : (
        <div className="space-y-2">
          {generator.phases.map((phase, index) => (
            <div
              key={index}
              data-testid={`generator-phase-${index}`}
              className="space-y-1 border-l-2 border-surface-2 pl-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground-muted">
                  #{index + 1}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    updateGenerator((current) => {
                      if (current.kind !== "focus_block_based") return current;
                      return {
                        ...current,
                        phases: current.phases.filter((_, i) => i !== index),
                      };
                    })
                  }
                  aria-label={t("quickCreate.frameRuleRemove")}
                  className="text-foreground-muted hover:text-danger focus:outline-hidden"
                >
                  <X size={14} />
                </button>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <label className="flex items-center gap-1.5">
                  <span className="text-foreground-muted">
                    {t("quickCreate.focusMin")}
                  </span>
                  <input
                    type="number"
                    min={1}
                    step={1}
                    aria-label={t("quickCreate.focusMin")}
                    value={phase.focus_min}
                    onChange={(e) =>
                      updateGenerator((current) => {
                        if (current.kind !== "focus_block_based") return current;
                        return {
                          ...current,
                          phases: current.phases.map((p, i) =>
                            i === index
                              ? { ...p, focus_min: Number(e.target.value) || 1 }
                              : p,
                          ),
                        };
                      })
                    }
                    className="w-20 rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
                <label className="flex items-center gap-1.5">
                  <span className="text-foreground-muted">
                    {t("quickCreate.breakMin")}
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={1}
                    aria-label={t("quickCreate.breakMin")}
                    value={phase.break_min}
                    onChange={(e) =>
                      updateGenerator((current) => {
                        if (current.kind !== "focus_block_based") return current;
                        return {
                          ...current,
                          phases: current.phases.map((p, i) =>
                            i === index
                              ? { ...p, break_min: Number(e.target.value) || 0 }
                              : p,
                          ),
                        };
                      })
                    }
                    className="w-20 rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </label>
              </div>
            </div>
          ))}
          <Button
            type="button"
            size="small"
            variant="default"
            rounded
            iconLeft={<Plus size={12} aria-hidden="true" />}
            onClick={() =>
              updateGenerator((current) => {
                if (current.kind !== "focus_block_based") return current;
                return {
                  ...current,
                  phases: [
                    ...current.phases,
                    { focus_min: 25, break_min: 5 },
                  ],
                };
              })
            }
          >
            {t("quickCreate.addPhase")}
          </Button>
        </div>
      )}
    </>
  );
}

function WindowEditor({
  recurrence,
  onChange,
  t,
  locale,
}: {
  recurrence: RecurrenceModel | null;
  onChange: (next: RecurrenceModel) => void;
  t: (key: string) => string;
  locale: "ja" | "en";
}) {
  if (recurrence === null) {
    return (
      <FormRow icon={<Calendar size={20} />}>
        <Button
          type="button"
          size="small"
          variant="default"
          rounded
          iconLeft={<Plus size={12} aria-hidden="true" />}
          onClick={() => onChange(defaultRecurrenceModel())}
        >
          {t("quickCreate.recurrenceEnable")}
        </Button>
      </FormRow>
    );
  }
  const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];
  const updateWindow = (
    updater: (current: RecurrenceModel["window"]) => RecurrenceModel["window"],
  ) => {
    onChange({ ...recurrence, window: updater(recurrence.window) });
  };
  const toggleDay = (bit: number) => {
    updateWindow((current) => ({
      ...current,
      weekday_mask: current.weekday_mask ^ (1 << bit),
    }));
  };
  const minutesToHHMM = (totalMinutes: number): string => {
    const clamped = ((totalMinutes % 1440) + 1440) % 1440;
    const h = Math.floor(clamped / 60);
    const m = clamped % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };
  const hhmmToMinutes = (value: string): number => {
    const [hStr = "0", mStr = "0"] = value.split(":");
    const h = Number(hStr);
    const m = Number(mStr);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return 0;
    return h * 60 + m;
  };
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1">
        {weekdayLabels.map((label, bit) => {
          const active = (recurrence.window.weekday_mask & (1 << bit)) !== 0;
          return (
            <button
              key={bit}
              type="button"
              role="switch"
              aria-checked={active}
              aria-label={
                locale === "ja" ? `曜日 ${label}` : `Weekday ${label}`
              }
              onClick={() => toggleDay(bit)}
              className={cn(
                "flex h-8 w-9 items-center justify-center rounded-md border text-xs font-medium transition-colors focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary",
                active
                  ? "border-primary bg-primary text-primary-fg"
                  : "border-border bg-surface-1 text-foreground-muted hover:bg-surface-2",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="block space-y-1 text-xs">
          <span className="block text-foreground-muted">
            {t("quickCreate.windowStartAt")}
          </span>
          <input
            type="time"
            aria-label={t("quickCreate.windowStartAt")}
            value={minutesToHHMM(recurrence.window.start_offset_min)}
            onChange={(e) =>
              updateWindow((current) => ({
                ...current,
                start_offset_min: hhmmToMinutes(e.target.value),
              }))
            }
            className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <label className="block space-y-1 text-xs">
          <span className="block text-foreground-muted">
            {t("quickCreate.windowEndAt")}
          </span>
          <input
            type="time"
            aria-label={t("quickCreate.windowEndAt")}
            value={minutesToHHMM(recurrence.window.end_offset_min)}
            onChange={(e) =>
              updateWindow((current) => ({
                ...current,
                end_offset_min: hhmmToMinutes(e.target.value),
              }))
            }
            className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
      </div>
    </div>
  );
}

function RecurringLifeEditor({
  activeStart,
  activeEnd,
  state,
  onActiveStartChange,
  onActiveEndChange,
  onStateChange,
  t,
}: {
  activeStart: string;
  activeEnd: string;
  state: RecurringStateValue;
  onActiveStartChange: (value: string) => void;
  onActiveEndChange: (value: string) => void;
  onStateChange: (value: RecurringStateValue) => void;
  t: (key: string) => string;
}) {
  return (
    <>
      <FormRow icon={<Calendar size={20} />}>
        <div className="grid w-full grid-cols-2 gap-2">
          <input
            type="date"
            aria-label={t("quickCreate.recurringActiveStart")}
            value={activeStart ? activeStart.slice(0, 10) : ""}
            onChange={(e) => onActiveStartChange(localDateToIsoDate(e.target.value).slice(0, 10))}
            className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <input
            type="date"
            aria-label={t("quickCreate.recurringActiveEnd")}
            value={activeEnd ? activeEnd.slice(0, 10) : ""}
            onChange={(e) => onActiveEndChange(localDateToIsoDate(e.target.value).slice(0, 10))}
            className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </FormRow>
      <RowSegmented
        icon={Repeat}
        options={RECURRING_STATE_OPTIONS.map((opt) => ({
          value: String(opt.value),
          label: t(opt.label),
        }))}
        value={String(state)}
        onChange={(value) => onStateChange(Number(value) as RecurringStateValue)}
      />
    </>
  );
}

function TagRowEditor({
  tags,
  onAdd,
  onRemove,
  t,
}: {
  tags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
  t: (key: string) => string;
}) {
  const [draft, setDraft] = useState("");
  return (
    <>
      <FormRow icon={<Plus size={20} />}>
        <div className="flex w-full items-center gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return;
              e.preventDefault();
              const next = draft.trim().replace(/\s+/g, " ");
              if (next) {
                onAdd(next);
                setDraft("");
              }
            }}
            aria-label={t("quickCreate.tagsPlaceholder")}
            placeholder={t("quickCreate.tagsPlaceholder")}
            className="w-full bg-transparent text-sm text-foreground placeholder:text-foreground-muted focus:outline-hidden"
          />
        </div>
      </FormRow>
      {tags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              <span>#{tag}</span>
              <button
                type="button"
                onClick={() => onRemove(tag)}
                aria-label={`${t("quickCreate.removeTag")} ${tag}`}
                className="flex h-4 w-4 items-center justify-center rounded-full text-primary/70 hover:bg-primary/20 hover:text-primary focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
              >
                <X size={10} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      ) : null}
    </>
  );
}

function MemoRowEditor({
  expanded,
  value,
  onChange,
  onExpand,
  t,
}: {
  expanded: boolean;
  value: string;
  onChange: (value: string) => void;
  onExpand: () => void;
  t: (key: string) => string;
}) {
  if (expanded) {
    return (
      <FormRow icon={<MessageSquare size={20} />}>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("quickCreate.memoPlaceholder")}
          aria-label={t("quickCreate.memoPlaceholder")}
          rows={3}
          className="w-full resize-none border-0 bg-transparent p-0 text-sm focus:ring-0"
        />
      </FormRow>
    );
  }
  return (
    <FormRow icon={<MessageSquare size={20} />}>
      <Button
        type="button"
        size="small"
        variant="default"
        rounded
        iconLeft={<Plus size={12} aria-hidden="true" />}
        onClick={onExpand}
      >
        {t("quickCreate.memoAdd")}
      </Button>
    </FormRow>
  );
}

// ---------- window / frame rule editors ----------

function WindowRow({
  window,
  index,
  onUpdate,
  onRemove,
  t,
  locale,
}: {
  window: Window;
  index: number;
  onUpdate: (index: number, updater: (current: Window) => Window) => void;
  onRemove: (index: number) => void;
  t: (key: string) => string;
  locale: "ja" | "en";
}) {
  const referenceKind = window.kind === 1 || window.kind === 2 || window.kind === 3;
  return (
    <div
      data-testid={`window-row-${index}`}
      className="space-y-2 border-l-2 border-surface-2 pl-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground-muted">
          {t("quickCreate.windowsTitle")} #{index + 1}
        </span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label={t("quickCreate.windowRemove")}
          className="text-foreground-muted hover:text-danger focus:outline-hidden"
        >
          <X size={14} />
        </button>
      </div>
      <RowSegmented
        icon={Calendar}
        options={WINDOW_KIND_OPTIONS.map((opt) => ({
          value: opt.value,
          label: t(opt.label),
        }))}
        value={String(window.kind)}
        onChange={(value) =>
          onUpdate(index, (w) => ({ ...w, kind: Number(value) }))
        }
      />
      <FormRow icon={<Calendar size={20} />}>
        <div className="grid w-full grid-cols-2 gap-2">
          <input
            type="datetime-local"
            aria-label={`${t("quickCreate.startAt")} (${locale === "ja" ? "日時" : "datetime"})`}
            value={isoToLocalDateTime(window.bounds.start)}
            onChange={(e) =>
              onUpdate(index, (w) => ({
                ...w,
                bounds: {
                  ...w.bounds,
                  start: localDateTimeToIso(e.target.value) ?? "",
                },
              }))
            }
            className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <input
            type="datetime-local"
            aria-label={`${t("quickCreate.endAt")} (${locale === "ja" ? "日時" : "datetime"})`}
            value={isoToLocalDateTime(window.bounds.end)}
            onChange={(e) =>
              onUpdate(index, (w) => ({
                ...w,
                bounds: {
                  ...w.bounds,
                  end: localDateTimeToIso(e.target.value) ?? "",
                },
              }))
            }
            className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      </FormRow>
      {referenceKind ? (
        <RowInput
          icon={Type}
          placeholder={t("quickCreate.windowReferenceIdLabel")}
          value={window.referenceId ?? ""}
          onChange={(value) =>
            onUpdate(index, (w) => ({
              ...w,
              referenceId: value.trim() ? value : null,
            }))
          }
          ariaLabel={t("quickCreate.windowReferenceIdLabel")}
        />
      ) : null}
    </div>
  );
}

function FrameRulesList({
  rules,
  onAdd,
  onRemove,
  onUpdate,
  t,
}: {
  rules: FrameRule[];
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (
    index: number,
    updater: (current: FrameRule) => FrameRule,
  ) => void;
  t: (key: string) => string;
}) {
  return (
    <div className="space-y-2">
      <div className="text-xs text-foreground-muted">
        {t("quickCreate.frameRulesTitle")} ({rules.length})
      </div>
      {rules.map((r, i) => (
        <FrameRuleRow
          key={r.id}
          rule={r}
          index={i}
          onUpdate={onUpdate}
          onRemove={onRemove}
          t={t}
        />
      ))}
      <Button
        type="button"
        size="small"
        variant="default"
        rounded
        iconLeft={<Plus size={12} aria-hidden="true" />}
        onClick={onAdd}
      >
        {t("quickCreate.frameRulesAdd")}
      </Button>
    </div>
  );
}

function FrameRuleRow({
  rule,
  index,
  onUpdate,
  onRemove,
  t,
}: {
  rule: FrameRule;
  index: number;
  onUpdate: (
    index: number,
    updater: (current: FrameRule) => FrameRule,
  ) => void;
  onRemove: (index: number) => void;
  t: (key: string) => string;
}) {
  const generatorKind = rule.generator.kind;
  const value = rule.generator.value;
  return (
    <div
      data-testid={`frame-rule-row-${index}`}
      className="space-y-2 border-l-2 border-surface-2 pl-3"
    >
      <div className="flex items-center justify-between">
        <span className="text-xs text-foreground-muted">
          {t("quickCreate.frameRulesTitle")} #{index + 1}
        </span>
        <button
          type="button"
          onClick={() => onRemove(index)}
          aria-label={t("quickCreate.frameRuleRemove")}
          className="text-foreground-muted hover:text-danger focus:outline-hidden"
        >
          <X size={14} />
        </button>
      </div>
      <RowSegmented
        icon={Repeat}
        options={FRAME_GENERATOR_KIND_OPTIONS.map((opt) => ({
          value: opt.value,
          label: t(opt.label),
        }))}
        value={generatorKind}
        onChange={(value) => {
          const next = value as FrameGeneratorKind;
          if (next === generatorKind) return;
          onUpdate(index, (r) => ({
            ...r,
            generator: defaultFrameGenerator(next),
          }));
        }}
      />
      {renderGeneratorFields({
        kind: generatorKind,
        value,
        onChange: (next) =>
          onUpdate(index, (r) => ({ ...r, generator: next })),
        t,
      })}
    </div>
  );
}

function renderGeneratorFields({
  kind,
  value,
  onChange,
  t,
}: {
  kind: FrameGeneratorKind;
  value: FrameGenerator["value"];
  onChange: (next: FrameGenerator) => void;
  t: (key: string) => string;
}) {
  switch (kind) {
    case "step": {
      const stepValue = value as StepGenerator;
      return (
        <>
          <FormRow icon={<Clock size={20} />}>
            <div className="flex w-full items-center gap-2 text-sm">
              <label className="flex items-center gap-1.5">
                <span className="text-foreground-muted">
                  {t("quickCreate.frameRuleStepMsLabel")}
                </span>
                <input
                  type="number"
                  min={0}
                  step={60000}
                  aria-label={t("quickCreate.frameRuleStepMsLabel")}
                  value={stepValue.step}
                  onChange={(e) =>
                    onChange({
                      kind: "step",
                      value: {
                        ...stepValue,
                        step: Number(e.target.value) || 0,
                      },
                    })
                  }
                  className="w-28 rounded-md bg-surface-2 px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
            </div>
          </FormRow>
          <FormRow icon={<Calendar size={20} />}>
            <div className="grid w-full grid-cols-2 gap-2">
              <input
                type="datetime-local"
                aria-label={`${t("quickCreate.frameRuleBoundsLabel")} ${t("quickCreate.startAt")}`}
                value={
                  stepValue.bounds ? isoToLocalDateTime(stepValue.bounds.start) : ""
                }
                onChange={(e) =>
                  onChange({
                    kind: "step",
                    value: {
                      ...stepValue,
                      bounds: stepValue.bounds
                        ? {
                            ...stepValue.bounds,
                            start: localDateTimeToIso(e.target.value) ?? "",
                          }
                        : {
                            start: localDateTimeToIso(e.target.value) ?? "",
                            end: "",
                          },
                    },
                  })
                }
                className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <input
                type="datetime-local"
                aria-label={`${t("quickCreate.frameRuleBoundsLabel")} ${t("quickCreate.endAt")}`}
                value={
                  stepValue.bounds ? isoToLocalDateTime(stepValue.bounds.end) : ""
                }
                onChange={(e) =>
                  onChange({
                    kind: "step",
                    value: {
                      ...stepValue,
                      bounds: stepValue.bounds
                        ? {
                            ...stepValue.bounds,
                            end: localDateTimeToIso(e.target.value) ?? "",
                          }
                        : {
                            start: "",
                            end: localDateTimeToIso(e.target.value) ?? "",
                          },
                    },
                  })
                }
                className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>
          </FormRow>
        </>
      );
    }
    case "reference": {
      const refValue = value as ReferenceGenerator;
      return (
        <>
          <RowInput
            icon={Type}
            placeholder={t("quickCreate.frameRuleReferenceIdLabel")}
            value={refValue.referenceId}
            onChange={(next) =>
              onChange({
                kind: "reference",
                value: { ...refValue, referenceId: next },
              })
            }
            ariaLabel={t("quickCreate.frameRuleReferenceIdLabel")}
          />
          <RowSegmented
            icon={Repeat}
            options={REFERENCE_ALIGN_OPTIONS.map((opt) => ({
              value: opt.value,
              label: t(opt.label),
            }))}
            value={String(refValue.align)}
            onChange={(next) =>
              onChange({
                kind: "reference",
                value: { ...refValue, align: Number(next) },
              })
            }
          />
        </>
      );
    }
    case "calendar": {
      const calValue = value as CalendarGenerator;
      return (
        <>
          <RowSegmented
            icon={Calendar}
            options={CALENDAR_UNIT_OPTIONS.map((opt) => ({
              value: opt.value,
              label: t(opt.label),
            }))}
            value={String(calValue.unit)}
            onChange={(next) =>
              onChange({
                kind: "calendar",
                value: { ...calValue, unit: Number(next) },
              })
            }
          />
          <FormRow icon={<Calendar size={20} />}>
            <div className="flex w-full items-center gap-2 text-sm">
              <label className="flex items-center gap-1.5">
                <span className="text-foreground-muted">
                  {t("quickCreate.frameRuleWeekdayMaskLabel")}
                </span>
                <input
                  type="number"
                  min={0}
                  max={127}
                  step={1}
                  aria-label={t("quickCreate.frameRuleWeekdayMaskLabel")}
                  value={calValue.weekdayMask ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const next = raw === "" ? null : Number(raw);
                    onChange({
                      kind: "calendar",
                      value: { ...calValue, weekdayMask: next },
                    });
                  }}
                  className="w-20 rounded-md bg-surface-2 px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
            </div>
          </FormRow>
          <RowSegmented
            icon={Calendar}
            options={HOLIDAY_KIND_OPTIONS.map((opt) => ({
              value: opt.value,
              label: t(opt.label),
            }))}
            value={String(calValue.holidayKind)}
            onChange={(next) =>
              onChange({
                kind: "calendar",
                value: { ...calValue, holidayKind: Number(next) },
              })
            }
          />
        </>
      );
    }
    case "transform": {
      const trValue = value as TransformGenerator;
      return (
        <>
          <RowInput
            icon={Type}
            placeholder={t("quickCreate.frameRuleSourceFrameIdLabel")}
            value={trValue.sourceFrameId}
            onChange={(next) =>
              onChange({
                kind: "transform",
                value: { ...trValue, sourceFrameId: next },
              })
            }
            ariaLabel={t("quickCreate.frameRuleSourceFrameIdLabel")}
          />
          <FormRow icon={<Clock size={20} />}>
            <div className="flex w-full items-center gap-2 text-sm">
              <label className="flex items-center gap-1.5">
                <span className="text-foreground-muted">
                  {t("quickCreate.frameRuleShiftLabel")}
                </span>
                <input
                  type="number"
                  step={60000}
                  aria-label={t("quickCreate.frameRuleShiftLabel")}
                  value={trValue.shift ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    onChange({
                      kind: "transform",
                      value: {
                        ...trValue,
                        shift: raw === "" ? null : Number(raw),
                      },
                    });
                  }}
                  className="w-28 rounded-md bg-surface-2 px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
              <label className="flex items-center gap-1.5">
                <span className="text-foreground-muted">
                  {t("quickCreate.frameRuleScaleLabel")}
                </span>
                <input
                  type="number"
                  step={0.1}
                  aria-label={t("quickCreate.frameRuleScaleLabel")}
                  value={trValue.scale ?? ""}
                  onChange={(e) => {
                    const raw = e.target.value;
                    onChange({
                      kind: "transform",
                      value: {
                        ...trValue,
                        scale: raw === "" ? null : Number(raw),
                      },
                    });
                  }}
                  className="w-20 rounded-md bg-surface-2 px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-primary/40"
                />
              </label>
            </div>
          </FormRow>
        </>
      );
    }
  }
}

// Re-export ConditionKind so future Condition-tree editor (Phase B) has a
// single import path; tree is currently a placeholder ALL-node, but the
// constant is referenced from `submit.ts` already and tree placeholders
// must import from this module to avoid circular imports.
