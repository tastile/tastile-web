"use client";

import type { PendingPrompt, SyncStatus } from "@/execution/model/execution";
import type { TileId } from "@/shared/model/ids";
import type { Tile } from "@/tile/model/tile";
import { type ReactNode, createContext, useContext } from "react";

interface ExecutionEngineValue {
  state: {
    tiles: Map<TileId, Tile>;
    execution: {
      activeTileId: string | null;
      phaseKind: "work" | "break" | "idle";
      phaseStartedAt: Date | null;
      phaseEndsAt: Date | null;
      pendingPrompt: PendingPrompt | null;
      syncStatus: SyncStatus | null;
    };
  };
  loading: boolean;
  execute: (...args: unknown[]) => Promise<never>;
}

const STUB: ExecutionEngineValue = {
  state: {
    tiles: new Map(),
    execution: {
      activeTileId: null,
      phaseKind: "idle",
      phaseStartedAt: null,
      phaseEndsAt: null,
      pendingPrompt: null,
      syncStatus: null,
    },
  },
  loading: false,
  execute: () => {
    throw new Error(
      "useDaemonExecution is removed in v1; use the dedicated v1 read hooks " +
        "and the v1 command helpers (see app/api/v1/tile-commands.ts).",
    );
  },
};

const ExecutionEngineContext = createContext<ExecutionEngineValue | null>(null);

export function ExecutionEngineProvider({ children }: { children: ReactNode }) {
  return <ExecutionEngineContext.Provider value={STUB}>{children}</ExecutionEngineContext.Provider>;
}

export function useExecutionEngineContext() {
  const value = useContext(ExecutionEngineContext);
  if (!value) {
    throw new Error("useExecutionEngineContext must be used within ExecutionEngineProvider");
  }
  return value;
}
