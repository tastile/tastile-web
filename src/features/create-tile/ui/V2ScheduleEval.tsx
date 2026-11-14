"use client";

/**
 * V2ScheduleEval — opt-in v2 scheduler evaluation inside the QuickCreate
 * recurring form (web#215 / G4). Mounted once in QuickCreateRecurring;
 * self-hides for non-recurring repeat modes.
 *
 * v1 stays the default path: nothing calls `/api/v2/*` unless the user
 * explicitly enables opt-in and presses evaluate. The v2 result is an
 * advisory preview — Core has no contract for writing arbitrary
 * occurrence times, so "adopt" only mirrors the first candidate's
 * time-of-day (and, when unset, the start date) into the existing v1
 * schedule fields. Submit still flows through the normal v1 command
 * path; the v2 engine never writes placements itself.
 */

import { Button, Switch } from "@mantine/core";
import { Sparkles } from "lucide-react";
import { useState } from "react";

import { deriveV2SchedulerInput } from "@/lib/v2-adapter/schedule-eval-input";
import type { V2SchedulerResult } from "@/lib/v2-adapter/scheduler-eval";
import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { FormDivider, SectionHeader } from "@/shared/ui/form";

const PREVIEW_LIMIT = 8;

type EvalState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; result: V2SchedulerResult }
  | { phase: "request-error"; message: string };

function isV2Result(value: unknown): value is V2SchedulerResult {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return v.engine === "v2" || v.engine === "fallback" || v.engine === "disabled";
}

function localTimeOfDay(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

function localDate(ms: number): string {
  const d = new Date(ms);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatOccurrence(row: number[]): string {
  const [startMs, endMs] = row;
  const start = new Date(startMs);
  const end = new Date(endMs);
  const date = `${start.getMonth() + 1}/${start.getDate()}`;
  return `${date} ${localTimeOfDay(startMs)} → ${localTimeOfDay(endMs)}`;
}

interface V2EvalResultViewProps {
  result: V2SchedulerResult;
  onAdopt: () => void;
  onDiscard: () => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

function V2EvalResultView({
  result,
  onAdopt,
  onDiscard,
  t,
}: V2EvalResultViewProps) {
  return (
    <div
      className="space-y-2 rounded-lg border border-border bg-surface-0 p-3"
      data-testid="v2-eval-result"
    >
      {result.engine === "disabled" ? (
        <p className="text-xs text-foreground-muted">
          {t("quickCreate.v2EvalDisabled")}
        </p>
      ) : null}
      {result.engine === "fallback" ? (
        <p className="text-xs text-foreground-muted">
          {t("quickCreate.v2EvalFallback", {
            reason: result.fallback_reason,
          })}
        </p>
      ) : null}
      {result.engine === "v2" && !result.ok ? (
        <p className="text-xs text-danger">
          {t("quickCreate.v2EvalError", {
            message: `${result.error.code}: ${result.error.message}`,
          })}
        </p>
      ) : null}
      {result.engine === "v2" && result.ok ? (
        <>
          <p className="text-xs text-foreground-muted">
            {t("quickCreate.v2EvalCount", { count: result.count })}
          </p>
          <ul className="space-y-1">
            {result.occurrences.slice(0, PREVIEW_LIMIT).map((row, i) => (
              <li key={i} className="font-mono text-xs text-foreground">
                {formatOccurrence(row)}
              </li>
            ))}
          </ul>
          {result.count > PREVIEW_LIMIT ? (
            <p className="text-caption text-foreground-muted">
              {t("quickCreate.v2EvalMore", {
                count: result.count - PREVIEW_LIMIT,
              })}
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button
              type="button"
              size="xs"
              variant="default"
              onClick={onAdopt}
              data-testid="v2-eval-adopt"
            >
              {t("quickCreate.v2EvalAdopt")}
            </Button>
            <Button
              type="button"
              size="xs"
              variant="subtle"
              onClick={onDiscard}
              data-testid="v2-eval-discard"
            >
              {t("quickCreate.v2EvalDiscard")}
            </Button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function V2ScheduleEval() {
  const { t } = useTranslation();
  const [optIn, setOptIn] = useState(false);
  const [state, setState] = useState<EvalState>({ phase: "idle" });
  const [adopted, setAdopted] = useState(false);

  const repeatMode = useQuickCreateStore((s) => s.recurring.repeatMode);
  const intervalValue = useQuickCreateStore((s) => s.recurring.intervalValue);
  const intervalUnit = useQuickCreateStore((s) => s.recurring.intervalUnit);
  const recurringStart = useQuickCreateStore(
    (s) => s.recurring.life.active.startDate,
  );
  const recurringEndRaw = useQuickCreateStore((s) => s.recurring.endDate);
  const recurringEndActive = useQuickCreateStore(
    (s) => s.recurring.life.active.endDate,
  );
  const spanStart = useQuickCreateStore((s) => s.time.span.start);
  const spanEnd = useQuickCreateStore((s) => s.time.span.end);
  const durationMinMs = useQuickCreateStore(
    (s) => s.time.durationMinMax.minMs,
  );
  const durationMaxMs = useQuickCreateStore(
    (s) => s.time.durationMinMax.maxMs,
  );
  const requirement = useQuickCreateStore(
    (s) => s.plan.completion.timeRequirements[0]?.required ?? null,
  );
  const windows = useQuickCreateStore((s) => s.windows);
  const whenMode = useQuickCreateStore((s) => s.time.whenMode);
  const timeModel = useQuickCreateStore((s) => s.time.timeModel);
  const setField = useQuickCreateStore((s) => s.setField);

  const evalState = {
    repeatMode,
    intervalValue,
    intervalUnit,
    // The recurring form authors its start date on time.span.start; the
    // legacy recurring.life.active.startDate is the fallback anchor,
    // mirroring the wire's starts_at precedence.
    recurringStart: spanStart || recurringStart,
    recurringEnd: recurringEndRaw || recurringEndActive || null,
    spanStart: spanStart || null,
    spanEnd: spanEnd || null,
    durationMinMs,
    durationMaxMs,
    requirementMinMs: requirement?.minMs ?? null,
    requirementMaxMs: requirement?.maxMs ?? null,
    windowBounds: windows.map((w) => ({
      start: w.bounds.start,
      end: w.bounds.end,
    })),
  };

  // Support gating only depends on step/span derivation, never on the
  // evaluation horizon, so a fixed epoch keeps render pure (react-doctor
  // purity rule). The real timestamp is sampled inside runEvaluation.
  const supportCheck = deriveV2SchedulerInput({ ...evalState, nowMs: 0 });

  const recurringCapable =
    repeatMode === "daily" ||
    repeatMode === "weekly" ||
    repeatMode === "monthly" ||
    repeatMode === "interval";

  if (!recurringCapable) return null;

  async function runEvaluation() {
    const derivation = deriveV2SchedulerInput({
      ...evalState,
      nowMs: Date.now(),
    });
    if (!derivation.ok) return;
    setAdopted(false);
    setState({ phase: "running" });
    try {
      const res = await fetch("/api/v2/scheduler/evaluate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ opt_in: true, input: derivation.input }),
      });
      if (!res.ok) {
        setState({
          phase: "request-error",
          message: `HTTP ${res.status}`,
        });
        return;
      }
      const body: unknown = await res.json();
      if (!isV2Result(body)) {
        setState({ phase: "request-error", message: "invalid_result" });
        return;
      }
      setState({ phase: "done", result: body });
    } catch {
      setState({ phase: "request-error", message: "network" });
    }
  }

  function adoptFirstOccurrence() {
    if (state.phase !== "done" || state.result.engine !== "v2") return;
    if (!state.result.ok) return;
    const first = state.result.occurrences[0];
    if (!first || first.length < 2) return;
    const [startMs, endMs] = first;
    const startTod = localTimeOfDay(startMs);
    const endTod = localTimeOfDay(endMs);
    // Mirror the candidate window into every v1 field that can express a
    // time-of-day constraint: the schedulable window (window_with_duration,
    // the recurring default), the legacy time-of-day range (fixed_window /
    // daily pickers), and — when the user authored "duration only" — flip
    // the time model so the adopted window is actually honored by the wire.
    setField("time.schedulableWindow.start", startTod);
    setField("time.schedulableWindow.end", endTod);
    setField("time.timeOfDayMode", "range");
    setField("time.timeOfDayStart", startTod);
    setField("time.timeOfDayEnd", endTod);
    if (timeModel === "duration_only") {
      setField("time.timeModel", "window_with_duration");
    }
    if (whenMode === "none") {
      setField("time.whenMode", "day");
      setField("time.span.end", "");
    }
    if (!spanStart) {
      setField("time.span.start", localDate(startMs));
      setField("time.span.end", "");
    }
    setAdopted(true);
    setState({ phase: "idle" });
  }

  function discardResult() {
    setAdopted(false);
    setState({ phase: "idle" });
  }

  const result = state.phase === "done" ? state.result : null;

  return (
    <>
      <FormDivider />
      <SectionHeader icon={Sparkles} title={t("quickCreate.v2EvalTitle")} />
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="text-xs font-medium text-foreground">
            {t("quickCreate.v2EvalOptIn")}
          </div>
          <p className="text-caption text-foreground-muted">
            {t("quickCreate.v2EvalHint")}
          </p>
        </div>
        <Switch
          checked={optIn}
          onChange={(e) => {
            setOptIn(e.currentTarget.checked);
            setAdopted(false);
            setState({ phase: "idle" });
          }}
          size="md"
          data-testid="v2-eval-optin"
        />
      </div>

      {optIn ? (
        <div className="space-y-2" data-testid="v2-eval-panel">
          {!supportCheck.ok ? (
            <p className="text-xs text-foreground-muted">
              {supportCheck.reason === "missing_duration"
                ? t("quickCreate.v2EvalMissingDuration")
                : t("quickCreate.v2EvalUnsupportedRepeat")}
            </p>
          ) : (
            <Button
              type="button"
              size="xs"
              variant="light"
              onClick={runEvaluation}
              disabled={state.phase === "running"}
              data-testid="v2-eval-run"
            >
              {state.phase === "running"
                ? t("quickCreate.v2EvalRunning")
                : t("quickCreate.v2EvalRun")}
            </Button>
          )}

          {state.phase === "request-error" ? (
            <p className="text-xs text-danger" data-testid="v2-eval-error">
              {t("quickCreate.v2EvalRequestFailed", {
                message: state.message,
              })}
            </p>
          ) : null}

          {result ? (
            <V2EvalResultView
              result={result}
              onAdopt={adoptFirstOccurrence}
              onDiscard={discardResult}
              t={t}
            />
          ) : null}

          {adopted ? (
            <p className="text-xs text-foreground-muted" data-testid="v2-eval-adopted">
              {t("quickCreate.v2EvalAdopted")}
            </p>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
