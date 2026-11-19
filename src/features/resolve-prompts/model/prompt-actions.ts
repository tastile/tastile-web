import type { ApiClient } from "@/shared/api/v1/endpoints";
import {
  PromptKind,
  PromptResolution,
  type PromptSubject,
  type PromptView,
  resolvePromptCommand,
} from "@/shared/api/v1/prompts";
import { getSourceTile, reflowSourceTile } from "@/shared/api/v1/source-tiles";
import { finishExecutionCommand, startExecutionCommand } from "@/shared/api/v1/tile-commands";

export type PromptActionId =
  | "startNow"
  | "reschedule"
  | "finish"
  | "keepGoing"
  | "acknowledge"
  | "dismiss";

/** Reflow looks for the next free slot within this window from now. */
const RESCHEDULE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** The actions a prompt offers, given what its subject resolved to. */
export function actionsFor(prompt: PromptView, subject: PromptSubject): PromptActionId[] {
  switch (prompt.kind) {
    case PromptKind.MISSED_START:
      return [
        ...(subject.placementId ? (["startNow"] as const) : []),
        ...(subject.sourceTileId ? (["reschedule"] as const) : []),
        "dismiss",
      ];
    case PromptKind.STALE_ACTIVE_EXECUTION:
      return [...(subject.executionId ? (["finish"] as const) : []), "keepGoing"];
    default:
      return ["acknowledge", "dismiss"];
  }
}

export function kindKey(kind: number): string {
  switch (kind) {
    case PromptKind.MISSED_START:
      return "promptCenter.kind.missedStart";
    case PromptKind.STALE_ACTIVE_EXECUTION:
      return "promptCenter.kind.staleActive";
    case PromptKind.DECISION_REQUIRED:
      return "promptCenter.kind.decisionRequired";
    default:
      return "promptCenter.kind.startupRecovery";
  }
}

type Outcome = { ok: true } | { ok: false; message: string };

async function resolve(client: ApiClient, promptId: string, resolution: number): Promise<Outcome> {
  const result = await resolvePromptCommand({ client, promptId, resolution });
  return result.ok ? { ok: true } : { ok: false, message: result.error.message };
}

/**
 * Carry out the user's choice, then resolve the prompt. The corrective command
 * runs first so a failure leaves the prompt pending for another attempt.
 */
export async function runPromptAction(
  client: ApiClient,
  prompt: PromptView,
  subject: PromptSubject,
  action: PromptActionId,
  now: Date = new Date(),
): Promise<Outcome> {
  switch (action) {
    case "startNow": {
      if (!subject.placementId) return { ok: false, message: "placement unavailable" };
      const started = await startExecutionCommand({ client, placementId: subject.placementId });
      if (!started.ok) return { ok: false, message: started.error.message };
      return resolve(client, prompt.id, PromptResolution.ACTION_TAKEN);
    }
    case "reschedule": {
      if (!subject.sourceTileId) return { ok: false, message: "source unavailable" };
      const source = await getSourceTile(client, subject.sourceTileId);
      if (!source.ok) return { ok: false, message: source.error.message };
      const reflowed = await reflowSourceTile({
        client,
        sourceTileId: subject.sourceTileId,
        expectedRevision: source.data.source.revision,
        range: {
          start: now.toISOString(),
          end: new Date(now.getTime() + RESCHEDULE_WINDOW_MS).toISOString(),
        },
      });
      if (!reflowed.ok) return { ok: false, message: reflowed.error.message };
      return resolve(client, prompt.id, PromptResolution.ACTION_TAKEN);
    }
    case "finish": {
      if (!subject.executionId) return { ok: false, message: "execution unavailable" };
      const finished = await finishExecutionCommand({ client, executionId: subject.executionId });
      if (!finished.ok) return { ok: false, message: finished.error.message };
      return resolve(client, prompt.id, PromptResolution.ACTION_TAKEN);
    }
    case "keepGoing":
    case "acknowledge":
      return resolve(client, prompt.id, PromptResolution.ACKNOWLEDGED);
    case "dismiss":
      return resolve(client, prompt.id, PromptResolution.DISMISSED);
  }
}
