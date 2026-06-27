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
  Clock,
  FileText,
  FolderOpen,
  ListChecks,
  MessageSquare,
  Palette,
  Plus,
  RefreshCw,
  Repeat,
  Settings2,
  Tag,
  Type,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Input";
import {
  FormDivider,
  FormPanel,
  FormRow,
  RowInput,
  RowSegmented,
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
import type {
  FrameRule,
  FrameGenerator,
  CalendarGenerator,
  ReferenceGenerator,
  StepGenerator,
  TransformGenerator,
} from "@/lib/domain/v1/tile";
import { uuidv7 } from "@/lib/domain/v1/envelope";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { useIsDesktop } from "@/lib/hooks/use-media-query";
import { useTranslation } from "@/lib/i18n/use-translation";
import { cn } from "@/lib/utils/cn";

// ---------- kind / role / state option sets ----------

const TILE_KIND_OPTIONS: ReadonlyArray<{ value: TileKindValue; label: string }> = [
  { value: TileKind.RECURRING, label: "quickCreate.kindRecurring" },
  { value: TileKind.PLACEMENT, label: "quickCreate.kindPlacement" },
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

  const identity = useQuickCreateStore((s) => s.identity);
  const plan = useQuickCreateStore((s) => s.plan);
  const time = useQuickCreateStore((s) => s.time);
  const windows = useQuickCreateStore((s) => s.windows);
  const recurring = useQuickCreateStore((s) => s.recurring);
  const advanced = useQuickCreateStore((s) => s.advanced);
  const meta = useQuickCreateStore((s) => s.meta);

  const isDesktop = useIsDesktop();
  const { t, locale } = useTranslation();

  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [memoExpanded, setMemoExpanded] = useState(meta.memo.trim().length > 0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invalidField, setInvalidField] = useState<"title" | null>(null);

  // externalId is null on SSR/first render to keep hydration stable.
  // uuidv7() uses Date.now() which differs between server and client.
  // Mint a fresh one after mount.
  useEffect(() => {
    if (identity.externalId === null) {
      setField("identity.externalId", uuidv7());
    }
  }, [identity.externalId, setField]);

  if (!isOpen) return null;

  // --- validity -------------------------------------------------------------

  const titleOk = identity.title.trim().length > 0;
  const kindIsRecurring = identity.kind === TileKind.RECURRING;
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

  async function handleCreate() {
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
      setScheduleOpen(false);
      setMemoExpanded(false);
      close();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("quickCreate.createError"));
    } finally {
      setSubmitting(false);
    }
  }

  // --- panel container ------------------------------------------------------

  const panelClass = isDesktop
    ? cn(
        "fixed inset-y-0 right-0 z-[56]",
        "w-[32rem] flex flex-col bg-surface-0 shadow-lg border-l border-border",
        "[animation:slideInFromRight_0.22s_ease-out]",
      )
    : cn(
        "fixed inset-x-0 bottom-0 z-[56]",
        "h-[85vh] flex flex-col rounded-t-2xl bg-surface-0 shadow-lg",
        "[animation:slideInFromBottom_0.22s_ease-out]",
      );

  return (
    <>
      <div
        className="fixed inset-0 z-[55] bg-foreground/10 backdrop-blur-[1px]"
        onClick={close}
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
            <SectionHeader icon={Type} title="§1 Identity (Tile.Base)" />
            <RowInput
              icon={FileText}
              placeholder={t("quickCreate.titlePlaceholder")}
              value={identity.title}
              onChange={(value) => {
                setField("identity.title", value);
                if (invalidField === "title") setInvalidField(null);
              }}
              ariaLabel={t("quickCreate.titlePlaceholder")}
              ariaDescribedBy={invalidField === "title" ? "quick-create-error" : undefined}
              required
              invalid={invalidField === "title"}
            />
            <FormRow icon={<FileText size={20} />}>
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
            <FormRow icon={<Palette size={20} />}>
              <div className="flex w-full items-center gap-3 text-sm">
                <label className="flex items-center gap-1.5">
                  <span className="text-foreground-muted">
                    {t("quickCreate.visualColorLabel")}
                  </span>
                  <input
                    type="color"
                    aria-label={t("quickCreate.visualColorLabel")}
                    value={normalizeHexColor(identity.visual.color)}
                    onChange={(e) =>
                      setField("identity.visual.color", e.target.value)
                    }
                    className="h-8 w-12 cursor-pointer rounded border-0 bg-transparent"
                  />
                </label>
                <label className="flex flex-1 items-center gap-1.5">
                  <span className="text-foreground-muted">
                    {t("quickCreate.visualIconLabel")}
                  </span>
                  <input
                    type="text"
                    aria-label={t("quickCreate.visualIconLabel")}
                    placeholder={t("quickCreate.visualIconPlaceholder")}
                    value={identity.visual.icon}
                    onChange={(e) =>
                      setField("identity.visual.icon", e.target.value)
                    }
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-muted focus:outline-hidden"
                  />
                </label>
              </div>
            </FormRow>
            <FormRow icon={<Type size={20} />}>
              <div className="flex w-full items-center gap-2">
                <span
                  className="flex-1 truncate font-mono text-xs text-foreground-muted"
                  aria-label={t("quickCreate.externalIdLabel")}
                  title={identity.externalId ?? ""}
                >
                  {identity.externalId ?? ""}
                </span>
                <button
                  type="button"
                  onClick={() => setField("identity.externalId", uuidv7())}
                  aria-label={t("quickCreate.externalIdRegenerate")}
                  className="flex items-center gap-1 text-xs text-foreground-muted hover:text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <RefreshCw size={12} aria-hidden="true" />
                  <span>{t("quickCreate.externalIdRegenerate")}</span>
                </button>
              </div>
            </FormRow>

            <FormDivider />

            {/* §2 Plan */}
            <SectionHeader icon={ListChecks} title="§2 Plan" />
            <StubRow
              icon={ListChecks}
              title={t("quickCreate.completionTitle")}
              count={plan.completion.root.children.length}
              badge="Phase B"
            />
            <StubRow
              icon={ListChecks}
              title={t("quickCreate.referencesTitle")}
              count={plan.references.length}
              badge="Phase B"
            />
            <StubRow
              icon={ListChecks}
              title={t("quickCreate.planningTitle")}
              count={
                plan.planning.placementRules.length +
                plan.planning.nestingRules.length +
                plan.planning.flows.length
              }
              badge="Phase C"
            />
            <StubRow
              icon={ListChecks}
              title={t("quickCreate.metricsTitle")}
              count={plan.metrics.length}
              badge="Phase C"
            />
            <StubRow
              icon={ListChecks}
              title={t("quickCreate.decisionsTitle")}
              count={plan.decisions.length}
              badge="Phase D"
            />

            <FormDivider />

            {/* §3 Time */}
            <SectionHeader icon={Clock} title="§3 Time (Span + Range)" />
            <ScheduleRow
              scheduleOpen={scheduleOpen}
              onToggleSchedule={() => setScheduleOpen((prev) => !prev)}
              spanStart={time.span.start}
              spanEnd={time.span.end}
              onStartChange={(value) => {
                const iso = localDateTimeToIso(value);
                setField("time.span.start", iso ?? "");
              }}
              onEndChange={(value) => {
                const iso = localDateTimeToIso(value);
                setField("time.span.end", iso ?? "");
              }}
              locale={locale}
              t={t}
            />
            <DurationRangeRow
              minMs={time.durationMinMax.minMs}
              maxMs={time.durationMinMax.maxMs}
              onMinChange={(value) => {
                setField("time.durationMinMax.minMs", value);
              }}
              onMaxChange={(value) => {
                setField("time.durationMinMax.maxMs", value);
              }}
              t={t}
            />

            <FormDivider />

            {/* §4 Windows */}
            <SectionHeader icon={Calendar} title="§4 Windows" />
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
            <button
              type="button"
              onClick={addWindow}
              aria-label={t("quickCreate.windowsAdd")}
              className="ml-[32px] flex items-center gap-1.5 text-sm text-primary hover:underline focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
            >
              <Plus size={14} aria-hidden="true" />
              <span>{t("quickCreate.windowsAdd")}</span>
            </button>

            {/* §5 Recurring — only when kind=RECURRING */}
            {kindIsRecurring ? (
              <>
                <FormDivider />
                <SectionHeader icon={Repeat} title="§5 Recurring" />
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
                <StubRow
                  icon={Repeat}
                  title={t("quickCreate.recurringRulesTitle")}
                  count={recurring.rules.length}
                  badge="Phase D"
                />
              </>
            ) : null}

            <FormDivider />

            {/* §6 Advanced */}
            <SectionHeader icon={Settings2} title="§6 Advanced (ChangeSet)" />
            <StubRow
              icon={Settings2}
              title={t("quickCreate.changeSetsTitle")}
              count={advanced.changeSets.length}
              badge="Phase D"
            />
            <StubRow
              icon={Settings2}
              title={t("quickCreate.changeRulesTitle")}
              count={advanced.rules.length}
              badge="Phase D"
            />

            <FormDivider />

            {/* §7 Meta */}
            <SectionHeader icon={FolderOpen} title="§7 Meta" />
            <RowInput
              icon={FolderOpen}
              placeholder={t("quickCreate.projectPlaceholder")}
              value={meta.project ?? ""}
              onChange={(value) =>
                setField("meta.project", value.trim() ? value : null)
              }
              ariaLabel={t("quickCreate.projectPlaceholder")}
            />
            <TagRowEditor
              tags={meta.tags}
              onAdd={(tag) => {
                const next = meta.tags.includes(tag)
                  ? meta.tags
                  : [...meta.tags, tag];
                setField("meta.tags", next);
              }}
              onRemove={(tag) =>
                setField(
                  "meta.tags",
                  meta.tags.filter((t) => t !== tag),
                )
              }
              t={t}
            />
            <MemoRowEditor
              expanded={memoExpanded || meta.memo.trim().length > 0}
              value={meta.memo}
              onChange={(value) => {
                setField("meta.memo", value);
                if (value.trim().length === 0) setMemoExpanded(false);
              }}
              onExpand={() => setMemoExpanded(true)}
              t={t}
            />
          </FormPanel>
        </div>

        <div className="border-t border-border bg-surface-0 p-section shrink-0 space-y-3">
          <fieldset>
            <legend className="mb-1.5 text-xs font-medium text-foreground-muted">
              {t("quickCreate.roleLegend")}
            </legend>
            <RowSegmented
              icon={Tag}
              options={PLAN_ROLE_OPTIONS.map((opt) => ({
                value: String(opt.value),
                label: t(opt.label),
              }))}
              value={String(plan.role)}
              onChange={(value) => {
                const next = Number(value) as PlanRoleValue;
                setField("plan.role", next);
              }}
            />
          </fieldset>
          <Button
            type="button"
            variant="primary"
            size="large"
            block
            onClick={handleCreate}
            loading={submitting}
            disabled={submitting}
            className="h-10"
          >
            {submitting ? t("quickCreate.saving") : t("quickCreate.commit")}
          </Button>
          {error ? (
            <p
              id="quick-create-error"
              role="alert"
              className="mt-2 text-center text-xs text-danger"
            >
              {error}
            </p>
          ) : null}
        </div>
      </section>
    </>
  );
}

// ---------- section / row primitives ----------

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
  scheduleOpen,
  onToggleSchedule,
  spanStart,
  spanEnd,
  onStartChange,
  onEndChange,
  locale,
  t,
}: {
  scheduleOpen: boolean;
  onToggleSchedule: () => void;
  spanStart: string;
  spanEnd: string;
  onStartChange: (value: string) => void;
  onEndChange: (value: string) => void;
  locale: "ja" | "en";
  t: (key: string) => string;
}) {
  const summary = (() => {
    if (spanStart && spanEnd) return `${spanStart} → ${spanEnd}`;
    if (spanStart) return `${t("quickCreate.startAt")} ${spanStart}`;
    if (spanEnd) return `${t("quickCreate.endAt")} ${spanEnd}`;
    return t("quickCreate.scheduleSummaryAnytime");
  })();
  return (
    <>
      <FormRow
        icon={<Calendar size={20} />}
        trailing={
          <ChevronDown
            size={16}
            className={cn(
              "text-foreground-muted transition-transform",
              scheduleOpen ? "rotate-180" : "",
            )}
            aria-hidden="true"
          />
        }
      >
        <button
          type="button"
          onClick={onToggleSchedule}
          aria-expanded={scheduleOpen}
          aria-label={t("quickCreate.scheduleTitle")}
          className="flex w-full items-center text-left text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
        >
          {summary}
        </button>
      </FormRow>
      {scheduleOpen ? (
        <div className="ml-[32px] grid grid-cols-2 gap-2">
          <input
            type="datetime-local"
            aria-label={`${t("quickCreate.startAt")} (${locale === "ja" ? "日時" : "datetime"})`}
            value={isoToLocalDateTime(spanStart)}
            onChange={(e) => onStartChange(e.target.value)}
            className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
          <input
            type="datetime-local"
            aria-label={`${t("quickCreate.endAt")} (${locale === "ja" ? "日時" : "datetime"})`}
            value={isoToLocalDateTime(spanEnd)}
            onChange={(e) => onEndChange(e.target.value)}
            className="themed-datetime-input w-full rounded-md bg-surface-2 px-control py-control text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>
      ) : null}
    </>
  );
}

function DurationRangeRow({
  minMs,
  maxMs,
  onMinChange,
  onMaxChange,
  t,
}: {
  minMs: number | null;
  maxMs: number | null;
  onMinChange: (value: number | null) => void;
  onMaxChange: (value: number | null) => void;
  t: (key: string) => string;
}) {
  return (
    <FormRow icon={<Clock size={20} />}>
      <div className="flex w-full items-center gap-3 text-sm">
        <label className="flex items-center gap-1.5">
          <span className="text-foreground-muted">{t("quickCreate.minMsLabel")}</span>
          <input
            type="number"
            min={0}
            step={60000}
            aria-label={t("quickCreate.minMsLabel")}
            value={minMs ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onMinChange(v === "" ? null : Number(v));
            }}
            className="w-24 rounded-md bg-surface-2 px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
        <span className="text-foreground-muted">–</span>
        <label className="flex items-center gap-1.5">
          <span className="text-foreground-muted">{t("quickCreate.maxMsLabel")}</span>
          <input
            type="number"
            min={0}
            step={60000}
            aria-label={t("quickCreate.maxMsLabel")}
            value={maxMs ?? ""}
            onChange={(e) => {
              const v = e.target.value;
              onMaxChange(v === "" ? null : Number(v));
            }}
            className="w-24 rounded-md bg-surface-2 px-2 py-1 text-right text-sm outline-none focus:ring-2 focus:ring-primary/40"
          />
        </label>
      </div>
    </FormRow>
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
        <div className="ml-[32px] flex flex-wrap gap-1">
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
                className="leading-none"
              >
                &times;
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
      <button
        type="button"
        onClick={onExpand}
        aria-label={t("quickCreate.memoPlaceholder")}
        className="flex w-full items-center text-left text-sm text-foreground focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
      >
        {t("quickCreate.memoAdd")}
      </button>
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
      className="ml-[32px] space-y-2 border-l-2 border-surface-2 pl-3"
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
      <div className="ml-[32px] text-xs text-foreground-muted">
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
      <button
        type="button"
        onClick={onAdd}
        aria-label={t("quickCreate.frameRulesAdd")}
        className="ml-[32px] flex items-center gap-1.5 text-sm text-primary hover:underline focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary"
      >
        <Plus size={14} aria-hidden="true" />
        <span>{t("quickCreate.frameRulesAdd")}</span>
      </button>
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
      className="ml-[32px] space-y-2 border-l-2 border-surface-2 pl-3"
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
export { ConditionKind };
