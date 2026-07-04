"use client";

import { useCallback, useState } from "react";
import type { Command } from "../core/command";
import { AppState } from "../core/state";
import type { Actor } from "../domain/actor";

/**
 * Throws because the local browser-side execution engine is retired.
 *
 * Legacy behaviour: this hook constructed a {@link DaemonClient} that hit
 * `/execution/snapshot`, `/read/tiles`, `/read/execution-view`,
 * `/views/pending-prompt`, `/views/timeline/today`, `/sync/status`, and
 * `/commands/*`. None of those v0 paths exist in the v1 product truth.
 *
 * The v1 dashboard reads happen server-side at
 * `app/api/proxy/[...path]/route.ts` (with the web-bridge or Tastile API
 * token attached from httpOnly cookies), and v1 commands flow through
 * `app/api/v1/submit.ts` + `app/api/v1/tile-commands.ts`. There is no
 * longer a browser-resident execution engine; per
 * `docs/agent-handoff/PROJECT-TRUTH.md` the web client is a thin v1 API
 * client, not a parallel reducer runtime.
 *
 * Consumers should migrate to the dedicated read hooks (`useActiveTile`,
 * `useTileList`, `useRecurringTemplates`, …) and the v1 command helpers
 * (`createTileCommand`, `startTileExecutionCommand`, …).
 */
function legacyExecutionEngineRemoved(): never {
  throw new Error(
    "useDaemonExecution is removed in v1; use the dedicated v1 read hooks " +
      "and the v1 command helpers (see app/api/v1/tile-commands.ts).",
  );
}

export function useDaemonExecution() {
  const [state] = useState<AppState>(AppState.initial());
  const [loading] = useState(false);

  // Throws — kept as a `useCallback` so existing call-sites type-check
  // until they migrate to the v1 command helpers.
  const execute = useCallback(async (_command: Command, _actor: Actor) => {
    void _command;
    void _actor;
    legacyExecutionEngineRemoved();
  }, []);

  return { state, loading, execute };
}
