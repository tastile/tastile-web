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
import { SubmitBar } from "@/features/create-tile/ui/SubmitBar";
import { SubmitError, SubmitValidationError, makeClient, submitCreateTile, submitTile, submitUpdateTile } from "@/shared/api/v1/submit";
import { notifyEventsChanged } from "@/shared/hooks/calendar/use-events";
import { useIsDesktop } from "@/shared/hooks/use-media-query";
import { useTileList } from "@/shared/hooks/use-tile-list";
import { createWorkspace, useWorkspaces } from "@/shared/hooks/use-workspaces";
import { useTranslation } from "@/shared/i18n/use-translation";
import { cn } from "@/shared/lib/cn";
import type { ConditionNode } from "@/shared/model/v1/condition";
import { PlanRole, type PlanRoleValue, TileKind } from "@/shared/model/v1/constants";
import { uuidv7 } from "@/shared/model/v1/envelope";
import type { Window } from "@/shared/model/v1/window";
import { hasTaskOrderCycle, useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { SEGMENT_STYLES } from "@/shared/ui/panel-styles";
import {
  ActionIcon,
  Button,
  CloseButton,
  NumberInput,
  Pill,
  SegmentedControl,
  TextInput,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  Calendar,
  ChevronRight,
  Clock,
  Layers,
  Link2,
  ListChecks,
  MessageSquare,
  Plus,
  Repeat,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BehaviorPreview } from "./BehaviorPreview";
import { CompletionSubPanel } from "./CompletionSubPanel";
import { CreateProjectModal } from "./CreateProjectModal";
import { DurationSubPanel } from "./DurationSubPanel";
import { EssentialRow } from "./EssentialRow";
import { IntentSubPanel } from "./IntentSubPanel";
import { MetaSubPanel } from "./MetaSubPanel";
import { ReferencesSubPanel } from "./ReferencesSubPanel";
import { TaskDetailSubPanel } from "./TaskDetailSubPanel";
import { REPEAT_MODE_LABEL_KEY, formatDisplayDate, weekdayLabelsFor } from "./quick-create-utils";

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

  const isDesktop = useIsDesktop();
  const { t, locale } = useTranslation();

  const [visualOpen, setVisualOpen] = useState(false);
  const [activePanel, setActivePanel] = useState<SubPanelKey>("base");
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
      const reset = () => {
        setMounted(true);
        setIsClosing(false);
      };
      if (typeof queueMicrotask === "function") queueMicrotask(reset);
      else Promise.resolve().then(reset);
    } else if (mounted) {
      // react-doctor-disable-next-line react-hooks-js/set-state-in-effect
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
    setSubmitBlockedReasonFromStore(
      errors.size > 0
        ? (errors.values().next().value ?? null)
        : submitBlocked
          ? t("quickCreate.submitBlockedHint")
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

  // --- layout classes ---
  // Desktop is a single fixed-right panel that slides left by 24px when a
  // sub-panel opens, exposing the dashboard underneath. The sub-panel
  // (z-[58], positioned fixed right) covers the panel, while the parent
  // div's `-translate-x-6` keeps the sub-panel "expansion" effect intact.
  // Mobile keeps the custom bottom-sheet styling.
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

  const ownerId = meta.ownerSubjectId;

  return (
    <>
      {/* backdrop */}
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop overlay — Escape handled by SubPanelShell */}
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
      <div className={panelClass} data-testid="quick-create-panel">
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
          <SegmentedControl
            size="xs"
            radius="md"
            value={String(plan.role)}
            onChange={(value) => setField("plan.role", Number(value) as PlanRoleValue)}
            data-testid="quick-create-tile-kind"
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
            className="shrink-0"
          />
          <div className="flex shrink-0 items-center gap-2">
            <CloseButton onClick={close} aria-label={t("tiles.closePanel")} />
          </div>
        </div>

        {/* ─── composer body ─── */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="mx-auto max-w-[640px]">
            {/* ── main card ── */}
            <section className="py-2" data-testid="quick-create-tab-identity">
              {/* title input */}
              <TextInput
                id="tile-title-input"
                value={identity.title}
                onChange={(e) => {
                  setField("identity.title", e.target.value);
                  if (invalidField === "title") setInvalidField(null);
                }}
                placeholder={t("quickCreate.titlePlaceholder")}
                variant="unstyled"
                size="xl"
                fw={700}
                data-testid="quick-create-input-title"
                aria-required="true"
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

              {/* organize row */}
              <div
                className="flex flex-wrap items-center gap-1.5 pb-3"
                data-testid="quick-create-organize-row"
              >
                <Button
                  type="button"
                  onClick={() => setActivePanel("meta")}
                  leftSection={<Plus size={12} />}
                  variant="outline"
                  size="xs"
                  radius="xl"
                  data-testid="quick-create-tab-meta"
                >
                  {t("quickCreate.metaExpandLabel") || "Refine"}
                </Button>
              </div>

              {/* ─── essentials ─── */}
              <div className="pt-2" data-testid="quick-create-essentials">
                <hr className="border-border mb-2" />
                <EssentialRow
                  icon={Calendar}
                  testId="quick-create-tab-plan"
                  label={t("quickCreate.timeNavTitle")}
                  chip={
                    time.whenMode === "none" ? (
                      <Pill size="sm" variant="default" className="pointer-events-none">
                        {t("quickCreate.whenNoneTitle")}
                      </Pill>
                    ) : time.whenMode === "reference" ? (
                      <Pill size="sm" variant="default" className="pointer-events-none">
                        {t("quickCreate.referenceRangeTitle")}
                      </Pill>
                    ) : time.span.start || time.span.end ? (
                      <Pill size="sm" variant="default" className="pointer-events-none">
                        {time.whenMode === "day"
                          ? formatDisplayDate(time.span.start, true, locale, t)
                          : `${time.span.start ? formatDisplayDate(time.span.start, false, locale, t) : "—"} → ${time.span.end ? formatDisplayDate(time.span.end, false, locale, t) : "—"}`}
                      </Pill>
                    ) : null
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
                <EssentialRow
                  icon={Clock}
                  testId="quick-create-duration"
                  label={t("quickCreate.duration")}
                  chip={
                    time.durationMinMax.minMs !== null || time.durationMinMax.maxMs !== null ? (
                      <Pill size="sm" variant="default" className="pointer-events-none">
                        {time.durationMinMax.minMs !== null
                          ? `${Math.round(time.durationMinMax.minMs / 60000)} min`
                          : "—"}
                        {time.durationMinMax.maxMs !== null
                          ? ` – ${Math.round(time.durationMinMax.maxMs / 60000)} min`
                          : ""}
                        <span className="ml-1 text-foreground-muted">
                          <Link2 size={10} className="inline" aria-hidden="true" />{" "}
                          {t("quickCreate.durationLinkedNote")}
                        </span>
                      </Pill>
                    ) : null
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
                <div data-testid="quick-create-recurring-toggle">
                <EssentialRow
                  icon={Repeat}
                  testId="quick-create-tab-recurring"
                  label={t("quickCreate.repeatChip")}
                  chip={
                    recurring.repeatMode === "once" ? null : (
                      <Pill size="sm" variant="default" className="pointer-events-none">
                        {t(REPEAT_MODE_LABEL_KEY[recurring.repeatMode])}
                        {recurring.repeatMode === "weekly" && recurring.weekdayMask > 0 ? (
                          <span className="ml-1 text-foreground-muted">
                            {weekdayLabelsFor(locale).reduce<string>((acc, label, i) => {
                              if ((recurring.weekdayMask & (1 << i)) !== 0) {
                                return acc ? `${acc}, ${label}` : label;
                              }
                              return acc;
                            }, "")}
                          </span>
                        ) : null}
                        {recurring.repeatMode === "interval" ? (
                          <span className="ml-1 text-foreground-muted">
                            {recurring.intervalValue}
                            {recurring.intervalUnit === "min"
                              ? "min"
                              : recurring.intervalUnit === "hour"
                                ? "h"
                                : "d"}
                          </span>
                        ) : null}
                        {recurring.repeatMode !== "condition" && recurring.endDate ? (
                          <span className="ml-1 text-foreground-muted">
                            ~ {recurring.endDate.slice(0, 10)}
                          </span>
                        ) : null}
                      </Pill>
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
                <EssentialRow
                  icon={SlidersHorizontal}
                  label="配置・分割"
                  chip={
                    <Pill size="sm" variant="default" className="pointer-events-none">
                      priority {source.priority}
                      {source.splitPolicy.kind === 1 ? " · split" : ""}
                    </Pill>
                  }
                  clearable={false}
                  onClick={() => setActivePanel("source-rules")}
                  editAria="配置・分割を編集"
                  clearAria=""
                  confirmClearAria=""
                  confirmClearLabel=""
                />
                <EssentialRow
                  icon={Link2}
                  label="Source関係"
                  chip={
                    source.relations.length === 0 ? null : (
                      <Pill size="sm" variant="default" className="pointer-events-none">
                        {source.relations
                          .slice(0, 2)
                          .map((r) => r.referencedTitle || "—")
                          .join(", ")}
                        {source.relations.length > 2 ? ` +${source.relations.length - 2}` : ""}
                      </Pill>
                    )
                  }
                  clearable={false}
                  onClick={() => setActivePanel("relations")}
                  editAria="Source関係を編集"
                  clearAria=""
                  confirmClearAria=""
                  confirmClearLabel=""
                />
                <EssentialRow
                  icon={Layers}
                  label="条件駆動Flow"
                  chip={
                    source.flowSequences.length === 0 ? null : (
                      <Pill size="sm" variant="default" className="pointer-events-none">
                        {source.flowSequences.length}
                        {t("quickCreate.essentialsItemsUnit")}
                        {source.flowSequences[0]?.minimumGapMs
                          ? ` · ${Math.round(source.flowSequences[0].minimumGapMs / 60000)}m`
                          : ""}
                      </Pill>
                    )
                  }
                  clearable={false}
                  onClick={() => setActivePanel("flows")}
                  editAria="Flow sequenceを編集"
                  clearAria=""
                  confirmClearAria=""
                  confirmClearLabel=""
                />
                <EssentialRow
                  icon={SlidersHorizontal}
                  label="配置ルール"
                  chip={
                    plan.planning.placementRules.length === 0 ? null : (
                      <Pill size="sm" variant="default" className="pointer-events-none">
                        {plan.planning.placementRules.length}
                        {t("quickCreate.essentialsItemsUnit")}
                        {plan.planning.placementRules[0]?.effect
                          ? ` · rank ${plan.planning.placementRules[0].rank}`
                          : ""}
                      </Pill>
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
                        const titles: string[] = [];
                        for (const tk of plan.completion.tasks) {
                          const t = (tk.content?.title ?? "").trim();
                          if (t.length > 0) titles.push(t);
                        }
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
                    variant="outline"
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
            </section>

            {/* ── behavior preview ── */}
            <section className="pt-3">
              <hr className="border-border mb-3" />
              <BehaviorPreview
                plan={plan}
                time={time}
                windows={windows}
                recurring={recurring}
                source={source}
                locale={locale}
                t={t}
              />
            </section>
          </div>
        </div>

        {/* ─── composer foot ─── */}
        <SubmitBar
          canSubmit={canSubmit}
          blockedReason={
            submitBlockedReason ?? (submitBlocked ? t("quickCreate.submitBlockedHint") : null)
          }
          isSubmitting={submitting}
          serverError={serverError}
          onClose={close}
          onSubmit={handleSubmit}
          submitLabel={mode === "edit" ? t("quickCreate.update") : t("quickCreate.commit")}
          cancelLabel={t("quickCreate.cancel")}
          onDiscardDraft={mode === "create" ? discardDraft : null}
          discardLabel={t("quickCreate.discardDraft") || "Discard draft"}
        />
        {slowNotice && submitting ? (
          <p
            data-testid="quick-create-slow-notice"
            className="px-4 pb-1 text-center text-xs text-foreground-muted"
            aria-live="polite"
          >
            {t("quickCreate.takingLonger") || "Taking longer than usual..."}
          </p>
        ) : null}
        {retryToast ? (
          <div
            role="alert"
            data-testid="quick-create-retry-toast"
            className="flex items-center justify-between gap-2 border-t border-danger/30 bg-danger/5 px-4 py-2"
          >
            <p className="flex-1 text-xs text-foreground">
              <span className="font-semibold">{t("quickCreate.submitFailed") || "Submit failed"}</span>
              <span className="mx-1">—</span>
              <span>{retryToast.message}</span>
            </p>
            <Button
              type="button"
              size="xs"
              variant="filled"
              color="red"
              onClick={retrySubmit}
              data-testid="quick-create-retry-button"
              disabled={submitting}
            >
              {t("quickCreate.retry") || "Retry"}
            </Button>
            <CloseButton
              size="sm"
              onClick={() => setRetryToast(null)}
              aria-label={t("tiles.closePanel") || "Dismiss"}
            />
          </div>
        ) : null}
        {loadError ? (
          <p
            role="alert"
            data-testid="quick-create-load-error"
            className="px-4 pb-2 text-center text-xs text-warning"
          >
            {loadError}
          </p>
        ) : null}
      </div>

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

      <MetaSubPanel
        activePanel={activePanel}
        setActivePanel={setActivePanel}
        isDesktop={isDesktop}
        t={t}
        meta={meta}
        setField={setField}
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
    </>
  );
}
