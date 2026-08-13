import { Suspense } from "react";
import { TasksPageClient } from "./page-client";

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="p-6 text-xs text-foreground-subtle">Loading tasks...</div>}>
      <TasksPageClient />
    </Suspense>
  );
}
