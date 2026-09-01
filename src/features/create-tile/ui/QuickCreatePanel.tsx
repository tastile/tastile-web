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

function pickPanelClass(
	isClosing: boolean,
	isDesktop: boolean,
	hasSubPanel: boolean,
): string {
	if (isDesktop) {
		return `fixed inset-y-0 right-0 z-[56] w-[36rem] flex flex-col bg-surface-0 transition-[transform,opacity] duration-300 ease-out ${
			isClosing
				? "translate-x-full opacity-0"
				: hasSubPanel
					? "-translate-x-6"
					: "translate-x-0"
		} [animation:slideInFromRight_0.22s_ease-out]`;
	}
	return `fixed inset-x-0 bottom-0 z-[56] h-[85vh] flex flex-col rounded-t-2xl bg-surface-0 transition-[transform,opacity] duration-300 ease-out ${
		isClosing ? "translate-y-full opacity-0" : "translate-y-0"
	} [animation:slideInFromBottom_0.22s_ease-out]`;
}

export function QuickCreatePanel() {
	const isOpen = useQuickCreateStore((s) => s.isOpen);
	const close = useQuickCreateStore((s) => s.close);
	const workflowKind = useQuickCreateStore((s) => s.workflowKind);
	const activePanel = useQuickCreateStore((s) => s.activePanel);
	const setActivePanel = useQuickCreateStore((s) => s.setActivePanel);
	const submitBlocked = useQuickCreateStore((s) => s.submitBlocked);
	const setCanSubmit = useQuickCreateStore((s) => s.setCanSubmit);
	const setSubmitBlockedReason = useQuickCreateStore(
		(s) => s.setSubmitBlockedReason,
	);
	const mode = useQuickCreateStore((s) => s.mode);
	const reset = useQuickCreateStore((s) => s.reset);
	const submitState = useQuickCreateStore((s) => s.submitState);
	const canSubmit = useQuickCreateStore((s) => s.canSubmit);
	const setSubmitState = useQuickCreateStore((s) => s.setSubmitState);

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

	// The submit button lives in the title row (right of the title input)
	// via the per-workflow QuickCreateSubmitButton component. Each workflow
	// reads `identity.title` and `submitBlocked` from the same store slice
	// to drive `canSubmit` — we just keep those signals warm here so the
	// submit button reflects state changes that originate elsewhere (e.g.
	// a sub-panel validation failure that flips `submitBlocked`).
	//
	// Reason-text priority: title-required beats submit-blocked, because
	// the title is the user's first actionable error — they can fix it
	// while the panel is open even if the loader is still blocked. This
	// mirrors the legacy QuickCreate.tsx flip (load-blocked > first
	// validation error) but keeps the title as the primary signal since
	// it is the one input the user has direct control over. The
	// `QuickCreateSubmitButton` adds the `isDirty` check independently so
	// the button stays disabled in edit mode until something actually
	// diverges from the loaded baseline.
	const title = useQuickCreateStore((s) => s.identity.title);
	const titleOk = title.trim().length > 0;
	useEffect(() => {
		setCanSubmit(titleOk && !submitBlocked);
		if (!titleOk) {
			setSubmitBlockedReason(t("quickCreate.titleRequired"));
		} else if (submitBlocked) {
			setSubmitBlockedReason(t("quickCreate.submitBlockedHint"));
		} else {
			setSubmitBlockedReason(null);
		}
	}, [titleOk, submitBlocked, t, setCanSubmit, setSubmitBlockedReason]);

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
						: t(
								mode === "edit"
									? "quickCreate.updateError"
									: "quickCreate.createError",
							),
			});
		}
	}, [titleOk, mode, reset, close, setSubmitState, t]);

	const submitting = submitState.kind === "submitting";
	const serverError =
		submitState.kind === "error"
			? {
					title: t(
						mode === "edit"
							? "quickCreate.updateError"
							: "quickCreate.createError",
					),
					body: submitState.message,
				}
			: null;

	// Bridge from the title-row QuickCreateSubmitButton to handleSubmit.
	// The button dispatches `quick-create:submit` on click; this effect
	// invokes the real submit handler when the store says we are ready.
	useEffect(() => {
		const handler = () => {
			if (canSubmit && !submitting) {
				void handleSubmit();
			}
		};
		window.addEventListener("quick-create:submit", handler);
		return () => window.removeEventListener("quick-create:submit", handler);
	}, [canSubmit, submitting, handleSubmit]);

	// The detailed legacy editor is now integrated into the new panel shell.
	// It renders its body content inside the same body slot as the
	// specialized forms, with the shared header (CloseButton + title +
	// WorkflowBatch) and footer. The `useLegacyEditor` guard is removed.

	if (!mounted) return null;

	const panelClass = pickPanelClass(
		isClosing,
		isDesktop,
		activePanel !== "base",
	);

	return (
		<>
			<button
				type="button"
				data-testid="quick-create-backdrop"
				aria-label={t("quickCreate.closePanel")}
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
			/>

			<div
				className={`quick-create-panel ${panelClass}`}
				data-testid="quick-create-panel"
			>
				{/* Body: dispatch by workflowKind. Each workflow body owns its own
            header (close button + title input + submit button) and body
            — the chrome here only supplies the backdrop, the workflow
            dispatch, and the entry animation. The submit button moved
            from the bottom footer into the title row's trailing slot
            (QuickCreateSubmitButton) so the user can submit without
            leaving the row they're typing on. */}
				{workflowKind === "event" ? (
					<QuickCreateEvent />
				) : workflowKind === "recurring" ? (
					<QuickCreateRecurring />
				) : workflowKind === "detailed" ? (
					<QuickCreate />
				) : (
					<QuickCreateTask />
				)}

				{/* Footer: error banner only. Cancel/Discard buttons abolished
            per user request — close via the title-row CloseButton (X),
            submit via the title-row QuickCreateSubmitButton. Drafts
            auto-save to localStorage and clear on successful submit. */}
				{serverError ? (
					<div className="bg-[var(--surface-1)] p-4">
						<PanelErrorBanner
							title={serverError.title}
							body={serverError.body}
						/>
					</div>
				) : null}
			</div>
		</>
	);
}
