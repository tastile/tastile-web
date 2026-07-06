"use client";

import { Suspense, useMemo } from "react";
import { ReferencesSidePanel } from "@/components/panels/ReferencesSidePanel";
import { ReferencesMain } from "@/components/references/ReferencesMain";
import { useSidePanel } from "@/lib/context/side-panel-context";
import { useTrackVisit } from "@/lib/hooks/use-track-visit";

export default function ReferencesPage() {
  return (
    <Suspense
      fallback={<div className="p-6 text-xs text-foreground-subtle">Loading references...</div>}
    >
      <ReferencesPageInner />
    </Suspense>
  );
}

function ReferencesPageInner() {
  useTrackVisit("/dashboard/references");
  // メモ化しないと毎レンダーで新規 JSX が作られ useSidePanel → setContent
  // → 親再描画 → ページ再描画のループが "Maximum update depth exceeded"
  // を起こす
  const sidePanel = useMemo(() => <ReferencesSidePanel />, []);
  useSidePanel(sidePanel);

  return (
    <div className="h-full overflow-y-auto">
      <ReferencesMain />
    </div>
  );
}
