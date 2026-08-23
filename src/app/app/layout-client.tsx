"use client";

import { QuickCreatePanel } from "@/features/create-tile/ui/QuickCreatePanel";
import {
  ExecutionEngineProvider,
  useExecutionEngineContext,
} from "@/shared/hooks/execution-engine-context";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { AppShell } from "@/widgets/app-shell/ui/AppShell";
import { Center, Loader } from "@mantine/core";
import { type ReactNode, useEffect, useState } from "react";

interface SessionShape {
  sub: string;
  exp: number;
  owner_id: string | null;
}

export function AppLayoutClient({ children }: { children: ReactNode }) {
  const [authState, setAuthState] = useState<"loading" | "ok">("loading");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch("/api/auth/session", { cache: "no-store" });
        if (cancelled) return;
        if (!res.ok) {
          window.location.replace("/login");
          return;
        }
        const body = (await res.json()) as SessionShape;
        if (cancelled) return;
        if (!body.sub) {
          window.location.replace("/login");
          return;
        }
        setAuthState("ok");
      } catch {
        if (!cancelled) window.location.replace("/login");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (authState === "loading") {
    return (
      <Center mih="100vh" data-testid="app-auth-loading">
        <Loader size="md" />
      </Center>
    );
  }

  return (
    <ExecutionEngineProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </ExecutionEngineProvider>
  );
}

function AppLayoutInner({ children }: { children: ReactNode }) {
  const { openCreate } = useQuickCreateStore();
  const { state } = useExecutionEngineContext();

  // Keyboard shortcut: Cmd+N. Defaults to Task — the picker page
  // inside the panel was intentionally removed; the user switches
  // workflows via the top-left WorkflowChip dropdown.
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "n") {
        e.preventDefault();
        openCreate({ workflow: "task" });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openCreate]);

  const activeTile = state.execution.activeTileId
    ? state.tiles.get(state.execution.activeTileId as import("@/shared/model/ids").TileId)
    : null;

  return (
    <AppShell
      quickCreatePanel={
        <QuickCreatePanel />
      }
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
