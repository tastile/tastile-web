"use client";

import { AppShell } from "@/components/layout/AppShell";
import { QuickTileCreate } from "@/components/tiles/QuickTileCreate";
import {
  ExecutionEngineProvider,
  useExecutionEngineContext,
} from "@/lib/hooks/execution-engine-context";
import { useQuickCreateStore } from "@/lib/stores/quick-create-store";
import { useEffect } from "react";

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  return (
    <ExecutionEngineProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </ExecutionEngineProvider>
  );
}

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const { open } = useQuickCreateStore();
  const { state } = useExecutionEngineContext();

  // Keyboard shortcut: Cmd+N
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        open();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  return (
    <AppShell
      quickCreatePanel={<QuickTileCreate />}
      executionState={{
        activeTileTitle: state.execution.activeTileId
          ? (state.tiles.get(state.execution.activeTileId)?.core.title ?? null)
          : null,
        phaseKind: state.execution.phaseKind,
        phaseStartedAt: state.execution.phaseStartedAt,
        phaseEndsAt: state.execution.phaseEndsAt,
        pendingPrompt: state.execution.pendingPrompt,
        syncStatus: state.execution.syncStatus ?? null,
      }}
    >
      {children}
    </AppShell>
  );
}
