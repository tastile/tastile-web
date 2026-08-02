"use client";

import { QuickCreate } from "@/features/create-tile/ui/QuickCreate";
import {
  ExecutionEngineProvider,
  useExecutionEngineContext,
} from "@/shared/hooks/execution-engine-context";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { AppShell } from "@/widgets/app-shell/ui/AppShell";
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

  const activeTile = state.execution.activeTileId
    ? state.tiles.get(state.execution.activeTileId as import("@/shared/model/ids").TileId)
    : null;

  return (
    <AppShell
      quickCreatePanel={<QuickCreate />}
      executionState={{
        activeTileTitle: activeTile?.core.title ?? null,
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
