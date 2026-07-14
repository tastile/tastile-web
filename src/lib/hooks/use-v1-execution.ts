"use client";

/**
 * use-v1-execution -- thin client wrapper around the v1 lifecycle
 * (start / pause / resume / finish) for the active placement.
 *
 * This is the minimum surface needed for the user to actually
 * "run" their schedule in the UI: pick a tile from the timeline,
 * click Start, then pause / resume / finish as the day unfolds.
 *
 * Unlike the v0 execution engine (`use-daemon-execution`) this hook
 * does NOT hold a parallel reducer -- every action issues a v1
 CommandRequest through the v1 client (which wraps the envelope
 + idempotency_key + occurred_at).  The server is the source of
 truth; the UI just observes `/v1/active-tile` for the next state.
 */

import { useCallback, useState } from "react";
import {
  finishExecutionCommand,
  makeClient,
  pauseExecutionCommand,
  resumeExecutionCommand,
  startExecutionCommand,
  type Result,
} from "@/lib/api/v1";
import type { CommandResponse } from "@/lib/domain/v1/envelope";

export interface V1ExecutionSnapshot {
  tile_id: string;
  placement_id: string;
  execution_id: string | null;
  title: string;
  span_start: string;
  span_end: string;
}

export type V1ExecutionAction = "start" | "pause" | "resume" | "finish";

export interface V1ExecutionState {
  busy: V1ExecutionAction | null;
  error: string | null;
  last: {
    action: V1ExecutionAction;
    at: number;
    ok: boolean;
  } | null;
}

const INITIAL: V1ExecutionState = { busy: null, error: null, last: null };

function describeError(action: V1ExecutionAction, err: unknown): string {
  if (!err || typeof err !== "object") return `${action} failed`;
  const e = err as { message?: string; kind?: number };
  if (typeof e.message === "string" && e.message.length > 0) return e.message;
  if (typeof e.kind === "number") return `${action} failed (kind=${e.kind})`;
  return `${action} failed`;
}

export function useV1Execution(snapshot: V1ExecutionSnapshot | null) {
  const [state, setState] = useState<V1ExecutionState>(INITIAL);

  const run = useCallback(
    async (action: V1ExecutionAction): Promise<Result<CommandResponse>> => {
      if (!snapshot) {
        const err = { kind: 4 as const, message: "no active placement", currentRevision: null, violations: [] };
        setState({ busy: null, error: err.message, last: { action, at: Date.now(), ok: false } });
        return { ok: false, error: err };
      }
      setState((prev) => ({ ...prev, busy: action, error: null }));
      const client = makeClient();
      let result: Result<CommandResponse>;
      try {
        switch (action) {
          case "start":
            result = await startExecutionCommand({
              client,
              placementId: snapshot.placement_id,
            });
            break;
          case "pause":
          case "resume":
            if (!snapshot.execution_id) {
              result = {
                ok: false,
                error: {
                  kind: 4 as const,
                  message: "no execution to " + action,
                  currentRevision: null,
                  violations: [],
                },
              };
            } else if (action === "pause") {
              result = await pauseExecutionCommand({ client, executionId: snapshot.execution_id });
            } else {
              result = await resumeExecutionCommand({ client, executionId: snapshot.execution_id });
            }
            break;
          case "finish":
            if (!snapshot.execution_id) {
              result = {
                ok: false,
                error: {
                  kind: 4 as const,
                  message: "no execution to finish",
                  currentRevision: null,
                  violations: [],
                },
              };
            } else {
              result = await finishExecutionCommand({ client, executionId: snapshot.execution_id });
            }
            break;
        }
      } catch (err) {
        result = { ok: false, error: { kind: 7 as const, message: describeError(action, err), currentRevision: null, violations: [] } };
      }
      setState({
        busy: null,
        error: result.ok ? null : result.error.message,
        last: { action, at: Date.now(), ok: result.ok },
      });
      return result;
    },
    [snapshot],
  );

  return { state, run };
}

/**
 * Helper: build a V1ExecutionSnapshot from the polling hook
 output (`/v1/active-tile`).  Returns null when nothing is running.
 */
export function snapshotFromActiveTile(active: {
  tile_id: string | null;
  placement_id: string | null;
  execution_id: string | null;
  title: string | null;
  span_start: string | null;
  span_end: string | null;
}): V1ExecutionSnapshot | null {
  if (!active.tile_id || !active.placement_id || !active.title || !active.span_start || !active.span_end) {
    return null;
  }
  return {
    tile_id: active.tile_id,
    placement_id: active.placement_id,
    execution_id: active.execution_id,
    title: active.title,
    span_start: active.span_start,
    span_end: active.span_end,
  };
}
