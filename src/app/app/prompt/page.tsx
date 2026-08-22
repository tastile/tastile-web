"use client";

/**
 * Decision-prompt surface — backed by `DecisionPromptSheet`, which polls
 * `usePendingSessions` (15s) and renders the open decision list with
 * per-session `InteractionTreeForm` answers.
 *
 * Replaces the v1-retired `useExecutionEngineContext` placeholder that
 * only ever read `state.execution.pendingPrompt`. The actual data source
 * is `lib/api/v1/sessions.ts::listPendingSessions` (Task 6 wire-up).
 *
 * Sheet styling follows the project's existing shell vocabulary
 * (Tailwind containers); the full bottom-sheet rules from
 * `feedback_panel_design.md` (no accent, scrim ~0.28, swipe expansion)
 * are a documented carry-over — wrapping through a shared `BottomSheet`
 * would expand scope beyond this task's wire-up goal.
 *
 * TODO(focus-prop): once DecisionPromptSheet exposes focusSessionId,
 * read `searchParams.focus` here and pass it through so deep-linked
 * users land on the right card. Until then the param is accepted but a
 * no-op.
 */

import { DecisionPromptSheet } from "@/features/execute-tile/ui/DecisionPromptSheet";
import { useTranslation } from "@/shared/i18n/use-translation";

export default function PromptPage() {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-[590] text-foreground">{t("dashboard.legacy.promptTitle")}</h1>
      <div className="rounded-xl bg-surface-elevated p-4">
        <DecisionPromptSheet />
      </div>
    </div>
  );
}