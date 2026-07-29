"use client";

import { type ReactNode, createContext, useContext } from "react";
import { useDaemonExecution } from "./use-daemon-execution";

type ExecutionEngineValue = ReturnType<typeof useDaemonExecution>;

const ExecutionEngineContext = createContext<ExecutionEngineValue | null>(null);

export function ExecutionEngineProvider({ children }: { children: ReactNode }) {
  const engine = useDaemonExecution();
  return (
    <ExecutionEngineContext.Provider value={engine}>{children}</ExecutionEngineContext.Provider>
  );
}

export function useExecutionEngineContext() {
  const value = useContext(ExecutionEngineContext);
  if (!value) {
    throw new Error("useExecutionEngineContext must be used within ExecutionEngineProvider");
  }
  return value;
}
