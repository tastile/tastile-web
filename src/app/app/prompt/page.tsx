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
 * The page accepts `?focus=<sessionId>` in the URL but does not
 * currently auto-open the matching session — that requires a future
 * `focusSessionId` prop on `DecisionPromptSheet`. Notification
 * deep-links still land here and the user clicks the card to open it.
 */

import { DecisionPromptSheet } from "@/components/execution/DecisionPromptSheet";

export default function PromptPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-[590] text-foreground">Pending decisions</h1>
      <div className="rounded-xl bg-surface-elevated p-4">
        <DecisionPromptSheet />
      </div>
    </div>
  );
}
