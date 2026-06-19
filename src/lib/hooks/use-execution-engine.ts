"use client";

import { useDaemonExecution } from "./use-daemon-execution";

/** @deprecated use useDaemonExecution directly. */
export function useExecutionEngine() {
  return useDaemonExecution();
}
