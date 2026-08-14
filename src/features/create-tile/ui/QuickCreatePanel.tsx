/**
 * QuickCreatePanel — use-case-specialized shell for the QuickCreate
 * creation flow.
 *
 * Renders one of three form bodies (Event / Task / Recurring) based on
 * `workflowKind` in the QuickCreate store. When `workflowKind` is null,
 * shows a "pick a workflow" placeholder (the ActivityBar + button sets
 * the workflow directly so this is rarely seen in practice).
 *
 * The shell owns the panel chrome (mount/unmount animation, header
 * with WorkflowChip + WorkflowMenu picker, error banner, submit bar).
 * Field state lives in `useQuickCreateStore`; submit logic delegates to
 * the existing `@/shared/api/v1/submit` helpers.
 */

"use client";

import { Button } from "@mantine/core";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  SubmitError,
  SubmitValidationError,
  makeClient,
  submitTile,
  submitUpdateTile,
} from "@/shared/api/v1/submit";
import { notifyEventsChanged } from "@/shared/hooks/calendar/use-events";
import { useIsDesktop } from "@/shared/hooks/use-media-query";
import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { PanelErrorBanner } from "./PanelErrorBanner";
import { QuickCreate } from "./QuickCreate";
import { QuickCreateEvent } from "./QuickCreateEvent";
import { QuickCreateRecurring } from "./QuickCreateRecurring";
import { QuickCreateTask } from "./QuickCreateTask";

// Re-exports from the pre-Phase-4 monolithic QuickCreate. The legacy
// sub-panels (BehaviorPreview, DurationSubPanel, EssentialRow,
// FlowSequencePanel, IntentSubPanel, MetaSubPanel, PlacementRulesPanel,
// ReferencesSubPanel, RelationPanel, SchedulePanel, SourceWindowPanel,
// TaskDetailSubPanel, quick-create-utils) are intentionally preserved
// here so the panel surface area doesn't shrink while the new
// workflow-specialized forms roll out. The Phase 4 plan calls for these
// to be re-introduced incrementally as new sub-panel needs emerge.
export { BehaviorPreview } from "./BehaviorPreview";
export { DurationSubPanel } from "./DurationSubPanel";
export { EssentialRow } from "./EssentialRow";
export { FlowSequencePanel } from "./FlowSequencePanel";
export { IntentSubPanel } from "./IntentSubPanel";
export { MetaSubPanel } from "./MetaSubPanel";
export { PlacementRulesPanel } from "./PlacementRulesPanel";
export { ReferencesSubPanel } from "./ReferencesSubPanel";
export { RelationPanel } from "./RelationPanel";
export { SchedulePanel } from "./SchedulePanel";
export { SourceWindowPanel } from "./SourceWindowPanel";
export { TaskDetailSubPanel } from "./TaskDetailSubPanel";
export {
  formatDisplayDate,
  REPEAT_MODE_LABEL_KEY,
  weekdayLabelsFor,
} from "./quick-create-utils";
export { isoToLocalDate } from "./date-utils";

function pickPanelClass(isClosing: boolean, isDesktop: boolean, hasSubPanel: boolean): string {
  if (isDesktop) {
    return `fixed inset-y-0 right-0 z-[56] w-[36rem] flex flex-col bg-surface-0 shadow-lg border-l border-border transition-all duration-300 ease-out ${
      isClosing ? "translate-x-full opacity-0" : hasSubPanel ? "-translate-x-6" : "translate-x-0"
    } [animation:slideInFromRight_0.22s_ease-out]`;
  }
  return `fixed inset-x-0 bottom-0 z-[56] h-[85vh] flex flex-col rounded-t-2xl bg-surface-0 shadow-lg transition-all duration-300 ease-out ${
    isClosing ? "translate-y-full opacity-0" : "translate-y-0"
  } [animation:slideInFromBottom_0.22s_ease-out]`;
}

export function QuickCreatePanel() {
  const isOpen = useQuickCreateStore((s) => s.isOpen);
  const useLegacyEditor = useQuickCreateStore((s) => s.useLegacyEditor);
  const close = useQuickCreateStore((s) => s.close);
  const reset = useQuickCreateStore((s) => s.reset);
  const setWorkflow = useQuickCreateStore((s) => s.setWorkflow);
  const mode = useQuickCreateStore((s) => s.mode);
  const workflowKind = useQuickCreateStore((s) => s.workflowKind);
  const activePanel = useQuickCreateStore((s) => s.activePanel);
  const setActivePanel = useQuickCreateStore((s) => s.setActivePanel);
  const submitBlocked = useQuickCreateStore((s) => s.submitBlocked);
  const submitState = useQuickCreateStore((s) => s.submitState);
  const setSubmitState = useQuickCreateStore((s) => s.setSubmitState);
  const setCanSubmit = useQuickCreateStore((s) => s.setCanSubmit);
  const setSubmitBlockedReason = useQuickCreateStore(
    (s) => s.setSubmitBlockedReason,
  );

  const title = useQuickCreateStore((s) => s.identity.title);

  const isDesktop = useIsDesktop();
  const { t } = useTranslation();

  // Mount/unmount animation. Keep mounted briefly after `isOpen=false`
  // so the closing transform can play.
  const [mounted, setMounted] = useState(isOpen);
  const [isClosing, setIsClosing] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (closeTimerRef.current) {
        clearTimeout(closeTimerRef.current);
        closeTimerRef.current = null;
      }
      const applyOpen = () => {
        setMounted(true);
        setIsClosing(false);
      };
      if (typeof queueMicrotask === "function") queueMicrotask(applyOpen);
      else Promise.resolve().then(applyOpen);
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

  // Submit handler — title is the only field required by all three workflows.
  const titleOk = title.trim().length > 0;
  const canSubmit = titleOk && !submitBlocked;

  useEffect(() => {
    setCanSubmit(canSubmit);
    if (!titleOk) {
      setSubmitBlockedReason(t("quickCreate.titleRequired"));
    } else if (submitBlocked) {
      setSubmitBlockedReason(t("quickCreate.submitBlockedHint"));
    } else {
      setSubmitBlockedReason(null);
    }
  }, [
    titleOk,
    submitBlocked,
    t,
    setCanSubmit,
    setSubmitBlockedReason,
  ]);

  const handleSubmit = useCallback(async () => {
    if (!titleOk) {
      setSubmitState({
        kind: "error",
        reason: "validation",
        message: t("quickCreate.titleRequired"),
      });
      return;
    }

    const client = makeClient();
    setSubmitState({ kind: "submitting" });

    try {
      const submitFn = mode === "edit" ? submitUpdateTile : submitTile;
      const result =
        mode === "edit"
          ? await submitFn({ client })
          : await submitTile({ client });

      if (!result.ok) {
        throw new Error(
          `${t(mode === "edit" ? "quickCreate.updateError" : "quickCreate.createError")} (api:${result.error.kind}) ${result.error.message}`,
        );
      }

      setSubmitState({ kind: "success" });
      notifyEventsChanged();
      reset();
      close();
    } catch (err) {
      if (err instanceof SubmitValidationError) {
        setSubmitState({
          kind: "error",
          reason: "api",
          message: err.message,
        });
        return;
      }
      if (err instanceof SubmitError) {
        setSubmitState({
          kind: "error",
          reason: "api",
          message: err.message || t("quickCreate.submitFailedRetry"),
        });
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
    }
  }, [titleOk, mode, reset, close, setSubmitState, t]);

  const submitting = submitState.kind === "submitting";
  const serverError =
    submitState.kind === "error"
      ? {
          title: t(mode === "edit" ? "quickCreate.updateError" : "quickCreate.createError"),
          body: submitState.message,
        }
      : null;

  const discardDraft = useCallback(() => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.removeItem("tastile.draft.create-tile");
      } catch {
        // ignore — best-effort
      }
    }
    reset();
  }, [reset]);

  // The detailed legacy editor is now integrated into the new panel shell.
  // It renders its body content inside the same body slot as the
  // specialized forms, with the shared header (CloseButton + title +
  // WorkflowBatch) and footer. The `useLegacyEditor` guard is removed.

  if (!mounted) return null;

  const panelClass = pickPanelClass(isClosing, isDesktop, activePanel !== "base");

  return (
    <>
      {/* biome-ignore lint/a11y/useKeyWithClickEvents: backdrop overlay — Escape handled internally */}
      <div
        data-testid="quick-create-backdrop"
        className={`fixed inset-0 z-[55] bg-foreground/10 backdrop-blur-[1px] transition-opacity duration-300 ease-out ${
          isClosing ? "opacity-0 pointer-events-none" : "opacity-100"
        }`}
        onClick={() => {
          // Close sub-panel first if open, then close the main panel
          if (activePanel !== "base") {
            setActivePanel("base");
          } else {
            close();
          }
        }}
        aria-hidden
      />

      <div className={`quick-create-panel ${panelClass}`} data-testid="quick-create-panel">
        {/* Body: dispatch by workflowKind. Per design intent, the panel always
            renders one of the three specialized forms — the user switches
            workflows via the WorkflowChip dropdown in each form's own
            header, not from a picker page inside the panel. When
            `workflowKind` is null (no entry point has chosen one), fall
            through to the Task form since Task is the most common default
            for the ActivityBar + entry. Each form body owns its own
            header (chip + title + close button) — the chrome here only
            supplies the backdrop, body slot, and footer so we don't
            double up. */}
        {workflowKind === "event" ? (
          <QuickCreateEvent />
        ) : workflowKind === "recurring" ? (
          <QuickCreateRecurring />
        ) : workflowKind === "detailed" ? (
          <QuickCreate />
        ) : (
          <QuickCreateTask />
        )}

        {/* Footer: error banner + submit/cancel/discard */}
        <div className="flex flex-col gap-2 border-t border-[var(--border-subtle)] bg-[var(--surface-1)] p-4">
          {serverError ? (
            <PanelErrorBanner title={serverError.title} body={serverError.body} />
          ) : null}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={() => close()}
                disabled={submitting}
              >
                {t("quickCreate.cancel")}
              </Button>
              <Button
                variant="subtle"
                color="red"
                onClick={discardDraft}
                disabled={submitting}
                data-testid="quick-create-discard-draft"
              >
                {t("quickCreate.discardDraft") || "Discard draft"}
              </Button>
            </div>
            <Button
              onClick={handleSubmit}
              loading={submitting}
              disabled={!canSubmit}
              data-testid="quick-create-submit"
            >
              {t(mode === "edit" ? "quickCreate.update" : "quickCreate.create")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
