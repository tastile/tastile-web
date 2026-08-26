/**
 * QuickCreate — v1 structure editor.
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
 * (`@/shared/api/v1/submit`) reads the store directly and posts the v1
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

import { FlowSequencePanel } from "@/features/create-tile/ui/FlowSequencePanel";
import { PlacementRulesPanel } from "@/features/create-tile/ui/PlacementRulesPanel";
import { RelationPanel } from "@/features/create-tile/ui/RelationPanel";
import { SchedulePanel } from "@/features/create-tile/ui/SchedulePanel";
import { SourceGenerationPanel } from "@/features/create-tile/ui/SourceGenerationPanel";
import { SourceWindowPanel } from "@/features/create-tile/ui/SourceWindowPanel";
import { type SubPanelKey, SubPanelShell } from "@/features/create-tile/ui/SubPanelShell";
import { SubmitError, SubmitValidationError, makeClient, submitCreateTile, submitTile, submitUpdateTile } from "@/shared/api/v1/submit";
import { notifyEventsChanged } from "@/shared/hooks/calendar/use-events";
import { useIsDesktop } from "@/shared/hooks/use-media-query";
import { useTileList } from "@/shared/hooks/use-tile-list";
import { createWorkspace, useWorkspaces } from "@/shared/hooks/use-workspaces";
import { useTranslation } from "@/shared/i18n/use-translation";
import type { ConditionNode } from "@/shared/model/v1/condition";
import { PlanRole, type PlanRoleValue } from "@/shared/model/v1/constants";
import { uuidv7 } from "@/shared/model/v1/envelope";
import type { Window } from "@/shared/model/v1/window";
import { hasTaskOrderCycle, useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { FormRow } from "@/shared/ui/form";
import {
  ActionIcon,
  CloseButton,
  NumberInput,
  Pill,
  SegmentedControl,
  Stack,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  Calendar,
  ChevronRight,
  Clock,
  Eye,
  Layers,
  Link2,
  ListChecks,
  Repeat,
  SlidersHorizontal,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { BehaviorPreview } from "./BehaviorPreview";
import { CompletionSubPanel } from "./CompletionSubPanel";
import { CreateProjectModal } from "./CreateProjectModal";
import { DurationSubPanel } from "./DurationSubPanel";
import { IntentSubPanel } from "./IntentSubPanel";
import { MetaSubPanel } from "./MetaSubPanel";
import { QuickCreateHeader } from "./QuickCreateHeader";
import { ReferencesSubPanel } from "./ReferencesSubPanel";
import { TaskDetailSubPanel } from "./TaskDetailSubPanel";
import { WorkflowBatch } from "./WorkflowBatch";
import { REPEAT_MODE_LABEL_KEY, formatDisplayDate, weekdayLabelsFor } from "./quick-create-utils";
import { MemoSection } from "./sections/MemoSection";
import { ProjectColorRow } from "./sections/ProjectColorRow";

// ============================================================
// Main component
// ============================================================

/**
 * Color palette for the detailed workflow's `ProjectColorRow`. Matches the
 * brand-purple-led swatch set used by the Recurring form so the legacy
 * editor doesn't visually drift from the specialized workflows.
 */
const DETAILED_COLOR_SWATCHES = [
  "#5e6ad2",
  "#10b981",
  "#a855f7",
  "#f59e0b",
  "#ef4444",
  "#6b7280",
];

// ============================================================
// Main component
// ============================================================

// react-doctor-disable-next-line react-doctor/no-giant-component
export function QuickCreate() {
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
  const activePanel = useQuickCreateStore((s) => s.activePanel);
  const setActivePanel = useQuickCreateStore((s) => s.setActivePanel);
  // Rules of Hooks: `workflowKind` must be subscribed here alongside the other
  // store selectors so its call order stays stable across renders. The early
  // return on `if (workflowKind !== "detailed")` below cannot follow a hook
  // call without violating the rule (previously hit "Rendered more hooks than
  // during the previous render" when the panel flipped between workflows).
  const workflowKind = useQuickCreateStore((s) => s.workflowKind);

  const isDesktop = useIsDesktop();
  const { t, locale } = useTranslation();

  const [visualOpen, setVisualOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const projects = useWorkspaces();
  const refreshProjects = projects.refresh;
  const tiles = useTileList({ limit: 200 });
  const tilePickerData = useMemo(
    () =>
      tiles.tiles.reduce<{ value: string; label: string }[]>((acc, tile) => {
        if (tile.plan_id) acc.push({ value: tile.plan_id as string, label: tile.title || tile.id });
        return acc;
      }, []),
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
          : t("quickCreate.timeRequirementDefault", { index: i + 1 });
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
      ? {
          title: t(mode === "edit" ? "quickCreate.updateError" : "quickCreate.createError"),
          body: submitState.message,
        }
      : null;
  // A5b — submit handler augmentation (issue #24):
  //   - retry toast: carries the Idempotency-Key so the user can retry
  //   - slow notice: surfaced after 5s of in-flight POST
  const [retryToast, setRetryToast] = useState<{ message: string; idempotencyKey: string } | null>(
    null,
  );
  const [slowNotice, setSlowNotice] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const router = useRouter();
  useEffect(() => {
    return () => {
      if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    };
  }, []);
  // react-doctor-disable-next-line react-doctor/rerender-state-only-in-handlers
  const [invalidField, setInvalidField] = useState<"title" | null>(null);
  const titleOk = identity.title.trim().length > 0;
  const [projectModalOpen, { open: openProjectModal, close: closeProjectModal }] =
    useDisclosure(false);

  const [mounted, setMounted] = useState(isOpen);
  useEffect(() => {
    if (isOpen) {
      const reset = () => setMounted(true);
      if (typeof queueMicrotask === "function") queueMicrotask(reset);
      else Promise.resolve().then(reset);
    } else if (mounted) {
      setMounted(false);
    }
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

  // --- draft autosave to localStorage (issue #23 A5a) ---
  // Snapshot the form-bearing slices on a 500ms debounce. Transient UI
  // (submitState / fieldErrors / isOpen) is intentionally excluded.
  const DRAFT_STORAGE_KEY = "tastile.draft.create-tile";
  const draftSignatureRef = useRef<string>("");
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isOpen) return;
    const snapshot = {
      identity,
      plan,
      time,
      windows,
      source,
      recurring,
      meta,
      mode,
    };
    const serialized = JSON.stringify(snapshot);
    if (serialized === draftSignatureRef.current) return;
    draftSignatureRef.current = serialized;
    const handle = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_STORAGE_KEY, serialized);
      } catch {
        // localStorage may be unavailable (private mode, quota exceeded);
        // draft autosave is best-effort — never block the user.
      }
    }, 500);
    return () => window.clearTimeout(handle);
  }, [
    DRAFT_STORAGE_KEY,
    isOpen,
    identity,
    plan,
    time,
    windows,
    source,
    recurring,
    meta,
    mode,
  ]);

  // Hydrate draft on first mount when the panel opens in "create" mode.
  // SSR-safe: only runs client-side via the `mounted` gate above.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isOpen) return;
    if (mode !== "create") return; // never overwrite an in-progress edit
    if (identity.title.trim().length > 0) return; // user already typed → don't clobber
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as {
        identity?: unknown;
        plan?: unknown;
        time?: unknown;
        windows?: unknown;
        source?: unknown;
        recurring?: unknown;
        meta?: unknown;
      };
      // Defensive: only re-hydrate the form-bearing slices.
      if (parsed.identity && typeof parsed.identity === "object") {
        setField("identity", parsed.identity);
      }
      if (parsed.plan && typeof parsed.plan === "object") {
        setField("plan", parsed.plan);
      }
      if (parsed.time && typeof parsed.time === "object") {
        setField("time", parsed.time);
      }
      if (Array.isArray(parsed.windows)) {
        setField("windows", parsed.windows);
      }
      if (parsed.source && typeof parsed.source === "object") {
        setField("source", parsed.source);
      }
      if (parsed.recurring && typeof parsed.recurring === "object") {
        setField("recurring", parsed.recurring);
      }
      if (parsed.meta && typeof parsed.meta === "object") {
        setField("meta", parsed.meta);
      }
    } catch {
      // Corrupt draft — discard silently rather than block the user.
      try {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      } catch {
        // ignore
      }
    }
    // Run only on mount-open transition. Listing isOpen / mode is enough.
  }, [isOpen]);

  const discardDraft = useCallback(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
    } catch {
      // ignore
    }
    draftSignatureRef.current = "";
    reset();
  }, [DRAFT_STORAGE_KEY, reset]);

  // retrySubmit MUST be declared above the `if (!mounted) return null` early
  // return so hook order stays stable when `mounted` flips (issue: hooks-order
  // violation previously hit "Rendered more hooks than during the previous
  // render" at QuickCreate.tsx:536 the first time the panel opened).
  const retrySubmit = useCallback(() => {
    if (retryToast?.idempotencyKey) {
      void handleSubmitForce(retryToast.idempotencyKey);
    }
  }, [retryToast]);

  // --- validity (must be before early return — refer to these below) ---
  const spanHasStart = !!time.span.start;
  const spanHasEnd = !!time.span.end;
  const spanOrderValid = !spanHasStart || !spanHasEnd || time.span.end > time.span.start;
  const durationValid =
    plan.role === PlanRole.LABEL ||
    time.durationMinMax.minMs === null ||
    time.durationMinMax.maxMs === null ||
    time.durationMinMax.minMs <= time.durationMinMax.maxMs;
  const taskOrderValid = !hasTaskOrderCycle(plan.completion.tasks);
  const canSubmit = spanOrderValid && durationValid && taskOrderValid && !submitBlocked;

  // --- field-level error sync ---
  useEffect(() => {
    const errors = new Map<string, string>();
    if (!spanOrderValid) errors.set("time.span", t("quickCreate.invalidTemporalOrder"));
    if (!durationValid) errors.set("time.durationMinMax", t("quickCreate.invalidDurationRange"));
    setFieldErrors(errors);
    setCanSubmitFromStore(errors.size === 0 && !submitBlocked);
    // Load-blocked wins over field-level errors: if the loader could not
    // confirm the tile state, the user must reload/close regardless of
    // which validation strings we surface — so show that reason first.
    setSubmitBlockedReasonFromStore(
      submitBlocked
        ? t("quickCreate.submitBlockedHint")
        : errors.size > 0
          ? (errors.values().next().value ?? null)
          : null,
    );
  }, [
    spanOrderValid,
    durationValid,
    submitBlocked,
    t,
    setFieldErrors,
    setCanSubmitFromStore,
    setSubmitBlockedReasonFromStore,
  ]);

  if (!mounted) return null;

  // Detailed editor renders its body content inside QuickCreatePanel's
  // body slot. Only active when workflowKind is "detailed".
  if (workflowKind !== "detailed") return null;

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

  // --- submit (A5b: idempotency + retry + analytics) ---
  async function handleSubmitForce(retryKey?: string) {
    setRetryToast(null);
    setSubmitState({ kind: "idle" });
    setInvalidField(null);
    if (!titleOk) {
      setSubmitState({
        kind: "error",
        reason: "validation",
        message: t("quickCreate.titleRequired"),
      });
      setInvalidField("title");
      return;
    }
    if (!spanOrderValid) {
      setSubmitState({
        kind: "error",
        reason: "validation",
        message: t("quickCreate.invalidTemporalOrder"),
      });
      return;
    }
    if (!canSubmit) return;

    const client = makeClient();
    setSubmitState({ kind: "submitting" });
    setSlowNotice(false);
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    slowTimerRef.current = setTimeout(() => {
      setSlowNotice(true);
    }, 5000);

    const submitFn = mode === "edit" ? submitUpdateTile : submitTile;
    try {
      const result =
        mode === "edit"
          ? await submitFn({ client })
          : await submitTile({ client, idempotencyKey: retryKey });
      if (!result.ok) {
        throw new Error(
          `${t(mode === "edit" ? "quickCreate.updateError" : "quickCreate.createError")} (api:${result.error.kind}) ${result.error.message}`,
        );
      }
      if (result.ok && result.idempotencyKey) {
        idempotencyKeyRef.current = result.idempotencyKey;
      }
      setSubmitState({ kind: "success" });
      // Issue #23 A5a — clear the localStorage draft on successful submit.
      try {
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(DRAFT_STORAGE_KEY);
          draftSignatureRef.current = "";
        }
      } catch {
        // ignore — best-effort
      }
      reset();
      setActivePanel("base");
      setMemoExpanded(false);
      notifyEventsChanged();
      const tileId = result.tileId;
      // A5b: navigate to timeline with focus ring (issue #24 acceptance).
      try {
        router.push(`/dashboard/timeline?focus=${tileId}`);
      } catch {
        // ignore — older Next.js may not have router.push
      }
      close();
    } catch (err) {
      if (err instanceof SubmitValidationError) {
        // 4xx — inline banner (no navigation).
        setSubmitState({
          kind: "error",
          reason: "api",
          message: err.message,
        });
        return;
      }
      if (err instanceof SubmitError) {
        // 5xx / network / abort — surface retry toast with the same Idempotency-Key.
        const key = idempotencyKeyRef.current ?? crypto.randomUUID();
        idempotencyKeyRef.current = key;
        setRetryToast({
          message: err.message || t("quickCreate.submitFailedRetry"),
          idempotencyKey: key,
        });
        setSubmitState({ kind: "idle" });
        return;
      }
      setSubmitState({
        kind: "error",
        reason: "api",
        message:
          err instanceof Error
            ? err.message
            : t(mode === "edit" ? "quickCreate.updateError" : "quickCreate.createError"),
      });
    } finally {
      if (slowTimerRef.current) {
        clearTimeout(slowTimerRef.current);
        slowTimerRef.current = null;
      }
      setSlowNotice(false);
    }
  }

  // Backwards-compatible name used by the SubmitBar prop.
  async function handleSubmit() {
    return handleSubmitForce();
  }

  const ownerId = meta.ownerSubjectId;

  return (
    <>
      <Stack gap={0} className="h-full">
      <Stack gap={0} className="flex-1 overflow-y-auto">
        <QuickCreateHeader
          value={identity.title}
          onChange={(next) => {
            setField("identity.title", next);
            if (invalidField === "title") setInvalidField(null);
          }}
          onClose={close}
          placeholder={t("quickCreate.titlePlaceholder")}
          closeTestId="quick-create-detailed-close"
          closeAriaLabel={t("quickCreate.cancel")}
          titleTestId="quick-create-input-title"
          required
        />
        <WorkflowBatch />

        {/* ─── body ─── */}
        {/* Time */}
        <div className="px-4 py-3">
          <FormRow
            icon={<Calendar className="h-4 w-4" aria-hidden />}
            trailing={
              time.whenMode !== "none" && (time.span.start || time.span.end || time.referenceId) ? (
                <CloseButton
                  size="xs"
                  onClick={() => {
                    if (time.whenMode === "reference") {
                      setField("time.referenceId", null);
                      setField("time.referenceLabel", "");
                    } else {
                      setField("time.span.start", "");
                      setField("time.span.end", "");
                    }
                  }}
                  aria-label={t("quickCreate.essentialRowClearAria")}
                />
              ) : undefined
            }
          >
            <button
              type="button"
              onClick={() => setActivePanel("time")}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
              data-testid="quick-create-tab-plan"
            >
              <span className="truncate text-foreground">
                {time.whenMode === "none"
                  ? t("quickCreate.timeNavTitle")
                  : time.whenMode === "reference"
                    ? t("quickCreate.referenceRangeTitle")
                    : time.span.start || time.span.end
                      ? time.whenMode === "day"
                        ? formatDisplayDate(time.span.start, true, locale, t)
                        : `${time.span.start ? formatDisplayDate(time.span.start, false, locale, t) : "—"} → ${time.span.end ? formatDisplayDate(time.span.end, false, locale, t) : "—"}`
                      : t("quickCreate.timeNavTitle")}
              </span>
              <ChevronRight size={14} className="shrink-0 text-foreground-muted" />
            </button>
          </FormRow>
        </div>

        {/* Duration */}
        <div className="px-4 py-3">
          <FormRow
            icon={<Clock className="h-4 w-4" aria-hidden />}
            trailing={
              (time.durationMinMax.minMs !== null || time.durationMinMax.maxMs !== null) ? (
                <CloseButton
                  size="xs"
                  onClick={() => {
                    setField("time.durationMinMax.minMs", null);
                    setField("time.durationMinMax.maxMs", null);
                  }}
                  aria-label={t("quickCreate.essentialRowClearAria")}
                />
              ) : undefined
            }
          >
            <button
              type="button"
              onClick={() => setActivePanel("duration")}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
              data-testid="quick-create-duration"
            >
              <span className="truncate text-foreground">
                {time.durationMinMax.minMs !== null || time.durationMinMax.maxMs !== null
                  ? <>
                      {time.durationMinMax.minMs !== null
                        ? `${Math.round(time.durationMinMax.minMs / 60000)} min`
                        : "—"}
                      {time.durationMinMax.maxMs !== null
                        ? ` – ${Math.round(time.durationMinMax.maxMs / 60000)} min`
                        : ""}
                    </>
                  : t("quickCreate.duration")}
              </span>
              <ChevronRight size={14} className="shrink-0 text-foreground-muted" />
            </button>
          </FormRow>
        </div>

        {/* Repeat */}
        <div className="px-4 py-3">
          <FormRow
            icon={<Repeat className="h-4 w-4" aria-hidden />}
            trailing={
              (recurring.repeatMode !== "once" || recurring.endDate) ? (
                <CloseButton
                  size="xs"
                  onClick={() => {
                    setField("recurring.repeatMode", "once");
                    setField("recurring.weekdayMask", 0);
                    setField("recurring.endDate", "");
                  }}
                  aria-label={t("quickCreate.essentialRowClearAria")}
                />
              ) : undefined
            }
          >
            <button
              type="button"
              onClick={() => setActivePanel("recurring")}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
              data-testid="quick-create-tab-recurring"
            >
              <span className="truncate text-foreground">
                {recurring.repeatMode === "once"
                  ? t("quickCreate.repeatChip")
                  : <>
                      {t(REPEAT_MODE_LABEL_KEY[recurring.repeatMode])}
                      {recurring.repeatMode === "weekly" && recurring.weekdayMask > 0 && (
                        <span className="ml-1 text-foreground-muted">
                          {weekdayLabelsFor(locale).reduce<string>((acc, label, i) => {
                            if ((recurring.weekdayMask & (1 << i)) !== 0) {
                              return acc ? `${acc}, ${label}` : label;
                            }
                            return acc;
                          }, "")}
                        </span>
                      )}
                      {recurring.repeatMode === "interval" && (
                        <span className="ml-1 text-foreground-muted">
                          {recurring.intervalValue}
                          {recurring.intervalUnit === "min" ? "min" : recurring.intervalUnit === "hour" ? "h" : "d"}
                        </span>
                      )}
                      {recurring.repeatMode !== "condition" && recurring.endDate && (
                        <span className="ml-1 text-foreground-muted">
                          ~ {recurring.endDate.slice(0, 10)}
                        </span>
                      )}
                    </>}
              </span>
              <ChevronRight size={14} className="shrink-0 text-foreground-muted" />
            </button>
          </FormRow>
        </div>

        {/* Source config */}
        <div className="px-4 py-3">
          <FormRow icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}>
            <button
              type="button"
              onClick={() => setActivePanel("source-rules")}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
            >
              <span className="truncate text-foreground">
                {t("quickCreate.tab.sourceRules")}
                <span className="ml-1 text-foreground-muted">
                  priority {source.priority}
                  {source.splitPolicy.kind === 1 ? " · split" : ""}
                </span>
              </span>
              <ChevronRight size={14} className="shrink-0 text-foreground-muted" />
            </button>
          </FormRow>
        </div>

        {/* Relations */}
        <div className="px-4 py-3">
          <FormRow icon={<Link2 className="h-4 w-4" aria-hidden />}>
            <button
              type="button"
              onClick={() => setActivePanel("relations")}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
            >
              <span className="truncate text-foreground">
                {t("quickCreate.tab.relations")}
                {source.relations.length > 0 && (
                  <span className="ml-1 text-foreground-muted">
                    {source.relations.slice(0, 2).map((r) => r.referencedTitle || "—").join(", ")}
                    {source.relations.length > 2 ? ` +${source.relations.length - 2}` : ""}
                  </span>
                )}
              </span>
              <ChevronRight size={14} className="shrink-0 text-foreground-muted" />
            </button>
          </FormRow>
        </div>

        {/* Flow sequences */}
        <div className="px-4 py-3">
          <FormRow icon={<Layers className="h-4 w-4" aria-hidden />}>
            <button
              type="button"
              onClick={() => setActivePanel("flows")}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
            >
              <span className="truncate text-foreground">
                {t("quickCreate.tab.flows")}
                {source.flowSequences.length > 0 && (
                  <span className="ml-1 text-foreground-muted">
                    {source.flowSequences.length}{t("quickCreate.essentialsItemsUnit")}
                    {source.flowSequences[0]?.minimumGapMs
                      ? ` · ${Math.round(source.flowSequences[0].minimumGapMs / 60000)}m`
                      : ""}
                  </span>
                )}
              </span>
              <ChevronRight size={14} className="shrink-0 text-foreground-muted" />
            </button>
          </FormRow>
        </div>

        {/* Placement rules */}
        <div className="px-4 py-3">
          <FormRow icon={<SlidersHorizontal className="h-4 w-4" aria-hidden />}>
            <button
              type="button"
              onClick={() => setActivePanel("placement-rules")}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
            >
              <span className="truncate text-foreground">
                {t("quickCreate.tab.placementRules")}
                {plan.planning.placementRules.length > 0 && (
                  <span className="ml-1 text-foreground-muted">
                    {plan.planning.placementRules.length}{t("quickCreate.essentialsItemsUnit")}
                    {plan.planning.placementRules[0]?.effect
                      ? ` · rank ${plan.planning.placementRules[0].rank}`
                      : ""}
                  </span>
                )}
              </span>
              <ChevronRight size={14} className="shrink-0 text-foreground-muted" />
            </button>
          </FormRow>
        </div>

        {/* Tasks block */}
        <div className="px-4 py-3">
          <FormRow icon={<ListChecks className="h-4 w-4" aria-hidden />}>
            <button
              type="button"
              onClick={() => setActivePanel("completion")}
              className="flex min-w-0 flex-1 items-center gap-2 text-left text-sm"
              data-testid="quick-create-completion-row"
            >
              <span className="truncate text-foreground">
                {t("quickCreate.completionRequires")}
                {plan.completion.tasks.length > 0 && (
                  <span className="ml-1 text-foreground-muted">
                    {plan.completion.tasks.length}{t("quickCreate.essentialsItemsUnit")}
                  </span>
                )}
              </span>
              <ChevronRight size={14} className="shrink-0 text-foreground-muted" />
            </button>
          </FormRow>
        </div>

        {/* Behavior preview */}
        <div className="px-4 py-3">
          <FormRow icon={<Eye className="h-4 w-4" aria-hidden />}>
            <div className="min-w-0 flex-1">
              <BehaviorPreview
                plan={plan}
                time={time}
                windows={windows}
                recurring={recurring}
                source={source}
                locale={locale}
                t={t}
              />
            </div>
          </FormRow>
        </div>

        {/* Bottom set: Project + Color + Memo — same shared sections as
            Event/Task/Recurring. Spacing-only separation above keeps the
            "set" visually grouped at the bottom of the form. The legacy
            MetaSubPanel / "Refine" pill button above stay untouched. */}
        <div className="pt-2">
          <ProjectColorRow
            pickerTestId="detailed-project-picker"
            colorTestId="detailed-color"
            swatches={DETAILED_COLOR_SWATCHES}
          />
          <MemoSection testId="detailed-memo" />
        </div>
      </Stack>
      </Stack>

      {/* The `mounted` state at the top of the component and the
          `if (!mounted) return null;` early return at line ~401 guarantee
          that this createPortal never executes during server render. The
          linter cannot see across the early return, so we silence it
          inline rather than introduce a redundant guard. */}
      {createPortal(
        <>
          <IntentSubPanel
            activePanel={activePanel}
            setActivePanel={setActivePanel}
            isDesktop={isDesktop}
            t={t}
          />

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
          </SubPanelShell>

          <DurationSubPanel
            activePanel={activePanel}
            setActivePanel={setActivePanel}
            isDesktop={isDesktop}
            t={t}
            time={time}
            setField={setField}
            getFieldError={getFieldError}
          />

          {/* ─── recurring sub-panel ─── */}
          <SubPanelShell
            panelKey="recurring"
            activeKey={activePanel}
            onClose={() => setActivePanel("base")}
            headingId="recurring-heading"
            title={t("quickCreate.repeatChip")}
            layout={isDesktop ? "drawer" : "sheet"}
          >
            <SourceGenerationPanel
              recurring={recurring}
              setField={setField}
              locale={locale}
              t={t}
              timeOfDayStart={time.timeOfDayStart || undefined}
              timeOfDayEnd={time.timeOfDayEnd || undefined}
            />
          </SubPanelShell>

          <SubPanelShell
            panelKey="source-rules"
            activeKey={activePanel}
            onClose={() => setActivePanel("base")}
            headingId="source-rules-heading"
            title={t("quickCreate.subpanel.sourceRules")}
            layout={isDesktop ? "drawer" : "sheet"}
          >
            <SourceWindowPanel source={source} time={time} setField={setField} />
          </SubPanelShell>

          <SubPanelShell
            panelKey="relations"
            activeKey={activePanel}
            onClose={() => setActivePanel("base")}
            headingId="relations-heading"
            title={t("quickCreate.subpanel.relations")}
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
            title={t("quickCreate.subpanel.flows")}
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
            title={t("quickCreate.subpanel.placementRules")}
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

          <ReferencesSubPanel
            activePanel={activePanel}
            setActivePanel={setActivePanel}
            isDesktop={isDesktop}
            t={t}
            plan={plan}
            setField={setField}
          />

          <CompletionSubPanel
            activePanel={activePanel}
            setActivePanel={setActivePanel}
            isDesktop={isDesktop}
            t={t}
            plan={plan}
            setField={setField}
            tilePickerData={tilePickerData}
            taskPickerData={taskPickerData}
            requirementPickerData={requirementPickerData}
            time={time}
          />

          <TaskDetailSubPanel
            activePanel={activePanel}
            setActivePanel={setActivePanel}
            isDesktop={isDesktop}
            t={t}
            editingTaskId={editingTaskId}
            setEditingTaskId={setEditingTaskId}
            plan={plan}
            setTaskField={setTaskField}
            removeTask={removeTask}
          />

          <CreateProjectModal
            opened={projectModalOpen}
            onClose={closeProjectModal}
            t={t}
            setField={setField}
            refreshProjects={refreshProjects}
          />
        </>,
        // react-doctor-disable-next-line react-doctor/no-unguarded-browser-global-in-render-or-hook-init
        document.body,
      )}
    </>
  );
}
