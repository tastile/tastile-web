"use client";

import type { Command } from "@/execution/model/command";
import type {
  PendingPrompt,
  PromptAction,
  SyncStatus,
} from "@/execution/model/types";
import { useExecutionEngineContext } from "@/shared/hooks/execution-engine-context";
import { useTranslation } from "@/shared/i18n/use-translation";
import { Actor } from "@/tile/model/actor";
import { ActionIcon } from "@mantine/core";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useRef, useState } from "react";
import { GlobalPromptBanner } from "./GlobalPromptBanner";
import { Header } from "./Header";
import { LeftTabs } from "./LeftTabs";
import { MobileBottomTabs } from "./MobileBottomTabs";
import { RightSidebar } from "./RightSidebar";

interface AppShellProps {
  children: React.ReactNode;
  rightSidebar?: React.ReactNode;
  quickCreatePanel?: React.ReactNode;
  executionState?: {
    activeTileTitle: string | null;
    phaseKind: "work" | "break" | "idle";
    phaseStartedAt: Date | null;
    phaseEndsAt: Date | null;
    nextActionableStartAt?: Date | null;
    pendingPrompt?: PendingPrompt | null;
    syncStatus?: SyncStatus | null;
  };
}

const RAIL_PINNED_KEY = "dashboard-left-rail-pinned";
const DEFAULT_PROMPT_EXTENSION_MINUTES = 5;
const DEFAULT_PROMPT_DEFER_MINUTES = 30;

export function AppShell({
  children,
  rightSidebar,
  quickCreatePanel,
  executionState,
}: AppShellProps) {
  const { execute } = useExecutionEngineContext();
  const { t } = useTranslation();
  const [showSidebar, setShowSidebar] = useState(true);
  const handlingPromptActionRef = useRef(false);
  const setHandlingPromptAction = (v: boolean) => {
    handlingPromptActionRef.current = v;
  };
  const [startupRecoveryStopAt, setStartupRecoveryStopAt] = useState(() =>
    toLocalDateTimeValue(new Date()),
  );
  // TODO: wire pin/unpin toggle. The pinned state is currently read once from
  // localStorage and never written back — `LeftTabs` consumes `pinnedOpen`
  // but no UI handler flips it. Once a pin/unpin control exists, expose a
  // setter here and persist on change at the call site.
  const [railPinned] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(RAIL_PINNED_KEY) === "1";
  });

  return (
    <div className="flex h-dvh flex-col bg-background pb-9">
      {executionState?.pendingPrompt ? (
        <div
          className="fixed inset-0 z-[68] bg-foreground/25 backdrop-blur-[1px]"
          aria-hidden="true"
        />
      ) : null}
      <GlobalPromptBanner
        prompt={executionState?.pendingPrompt ?? null}
        onDismiss={() => {
          const prompt = executionState?.pendingPrompt;
          if (!prompt) return;
          void execute(
            {
              type: "clear_prompt",
              prompt_id: prompt.promptId,
              reason: "dismissed",
            },
            Actor.human("self"),
          );
        }}
        onAction={(action, payload) => {
          const prompt = executionState?.pendingPrompt;
          if (!prompt || handlingPromptActionRef.current) return;
          // Fire-and-forget the prompt-action sequence; chain .then() instead
          // of try/finally so the React Compiler sees a supported pattern in
          // the render path.
          handlingPromptActionRef.current = true;
          void runPromptAction(
            execute,
            action,
            prompt,
            startupRecoveryStopAt,
            payload?.deferMinutes,
          ).finally(() => {
            handlingPromptActionRef.current = false;
          });
        }}
      />
      {executionState?.pendingPrompt?.actions.includes("confirm_stop_at") ? (
        <div className="fixed top-28 left-1/2 z-[69] w-[min(96vw,820px)] -translate-x-1/2 rounded-xl bg-surface-1 p-3 backdrop-blur">
          <label className="flex flex-col gap-1 text-xs font-semibold text-foreground-muted">
            {t("execution.prompt.stopAt")}
            <input
              type="datetime-local"
              value={startupRecoveryStopAt}
              onChange={(event) => setStartupRecoveryStopAt(event.target.value)}
              className="themed-datetime-input rounded-lg bg-surface-0 px-3 py-2 text-input text-foreground"
            />
          </label>
        </div>
      ) : null}

      {/* Header */}
      <div className="px-3 py-2">
        <Header executionState={executionState} />
      </div>

      {/* Main Layout */}
      <div
        className={`flex flex-1 gap-3 overflow-hidden px-3 py-3 ${executionState?.pendingPrompt ? "pointer-events-none" : ""}`}
      >
        <div className="hidden lg:block">
          <LeftTabs pinnedOpen={railPinned} />
        </div>

        {/* Main Content */}
        <main className="flex-1 overflow-auto rounded-xl bg-surface-1 p-6">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>

        <div className="hidden lg:block">{quickCreatePanel}</div>

        <div className="hidden lg:block">
          {showSidebar &&
            (rightSidebar ?? (
              <RightSidebar nextTile={null} timelineItems={[]} />
            ))}
        </div>
      </div>

      <MobileBottomTabs />

      <div className="lg:hidden">{quickCreatePanel}</div>

      {/* Sidebar Toggle - Fixed Bottom Right */}
      <ActionIcon
        variant="subtle"
        size="lg"
        onClick={() => setShowSidebar(!showSidebar)}
        className="fixed bottom-6 right-0 z-50 hidden h-12 w-10 items-center justify-center rounded-l-xl bg-surface-1 text-foreground-muted transition-colors hover:bg-surface-2 hover:text-foreground lg:flex"
        style={{
          transform: showSidebar ? "translateX(0)" : "translateX(4px)",
        }}
      >
        {showSidebar ? (
          <ChevronRight className="size-5" />
        ) : (
          <ChevronLeft className="size-5" />
        )}
      </ActionIcon>
    </div>
  );
}

function toPromptActionCommand(
  action: PromptAction,
  prompt: PendingPrompt,
  startupRecoveryStopAt: string,
  deferMinutes?: number,
): Command | null {
  const tileId = prompt.tileId;
  if (action === "dismiss") return null;
  if (action === "start_tile" && tileId) {
    return {
      type: "start_tile",
      tile_id: tileId,
      started_at: new Date(),
      source: "prompt",
    };
  }
  if (action === "complete_tile" && tileId) {
    return {
      type: "complete_tile",
      tile_id: tileId,
      completed_at: new Date(),
      next_tile_id: null,
      scope: "tile",
    };
  }
  if (action === "complete_phase" && tileId) {
    return {
      type: "complete_tile",
      tile_id: tileId,
      completed_at: new Date(),
      next_tile_id: null,
      scope: "phase",
    };
  }
  if (action === "start_break_parallel" || action === "start_break_split") {
    return {
      type: "start_break",
      linked_tile_id: tileId,
      break_min: DEFAULT_PROMPT_EXTENSION_MINUTES,
      reason: action,
    };
  }
  if (action === "start_break_split_and_extend") {
    return {
      type: "start_break",
      linked_tile_id: tileId,
      break_min: prompt.suggestedMinutes ?? DEFAULT_PROMPT_EXTENSION_MINUTES,
      reason: action,
    };
  }
  if (action === "defer_tile" && tileId) {
    return {
      type: "defer_tile",
      tile_id: tileId,
      deferred_at: new Date(),
      next_start_at: resolvePromptDeferStartAt(prompt, deferMinutes),
    };
  }
  if (action === "extend_phase" && tileId) {
    return {
      type: "extend_phase",
      tile_id: tileId,
      delta_min: prompt.suggestedMinutes ?? DEFAULT_PROMPT_EXTENSION_MINUTES,
    };
  }
  if (action === "end_break") {
    return { type: "end_break", tile_id: tileId, ended_at: new Date() };
  }
  if (
    (action === "confirm_continue" ||
      action === "confirm_stop_at" ||
      action === "confirm_executed" ||
      action === "confirm_skipped") &&
    tileId
  ) {
    return {
      type: "respond_startup_recovery",
      prompt_id: prompt.promptId,
      tile_id: tileId,
      action,
      stop_at:
        action === "confirm_stop_at"
          ? parseLocalDateTime(startupRecoveryStopAt)
          : null,
    };
  }
  return null;
}

function parseLocalDateTime(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

function toLocalDateTimeValue(date: Date): string {
  const pad2 = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

function resolvePromptDeferStartAt(
  prompt: PendingPrompt,
  explicitDeferMinutes?: number,
): Date {
  const deferMin =
    typeof explicitDeferMinutes === "number" && explicitDeferMinutes > 0
      ? explicitDeferMinutes
      : typeof prompt.suggestedMinutes === "number" &&
          prompt.suggestedMinutes > 0
        ? prompt.suggestedMinutes
        : DEFAULT_PROMPT_DEFER_MINUTES;
  return new Date(Date.now() + deferMin * 60 * 1000);
}

// Module-local async helper extracted out of the render path so the React
// Compiler does not have to model a try/finally inside the component body.
// The Promise chain drives the busy-flag reset via .finally(), matching the
// original behavior (reset on both success and failure).
async function runPromptAction(
  execute: (
    command: Command,
    actor: ReturnType<typeof Actor.human>,
  ) => Promise<unknown>,
  action: PromptAction,
  prompt: PendingPrompt,
  startupRecoveryStopAt: string,
  deferMinutes?: number,
): Promise<void> {
  const command = toPromptActionCommand(
    action,
    prompt,
    startupRecoveryStopAt,
    deferMinutes,
  );
  if (command) {
    await execute(command, Actor.human("self"));
    await execute(
      {
        type: "clear_prompt",
        prompt_id: prompt.promptId,
        reason: "actioned",
      },
      Actor.human("self"),
    );
    return;
  }
  // Fallback: action that maps to null (e.g. dismiss) still clears the prompt.
  await execute(
    {
      type: "clear_prompt",
      prompt_id: prompt.promptId,
      reason: "dismissed",
    },
    Actor.human("self"),
  );
}
