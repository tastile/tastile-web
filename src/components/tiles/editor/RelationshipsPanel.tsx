"use client";

/**
 * RelationshipsPanel — Plan.references + Plan.planning (containment, placement permissions).
 *
 * Scaffold for Plan #6 Phase 4. Real implementation in a follow-up commit once
 * SchedulePanel extraction is verified end-to-end.
 */

import { Link2 } from "lucide-react";

import { FormRow } from "@/components/ui/form";

export interface RelationshipsPanelProps {
  references: ReadonlyArray<{ id: string; targetKind: number; targetId: string }>;
  t: (key: string) => string;
}

export function RelationshipsPanel({ references, t }: RelationshipsPanelProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        <Link2 size={14} aria-hidden="true" />
        <span>{t("quickCreate.referencesNavTitle")}</span>
      </div>
      {references.length === 0 ? (
        <FormRow icon={null}>
          <span className="text-xs text-foreground-muted">{t("quickCreate.phaseNotReady")}</span>
        </FormRow>
      ) : (
        references.map((r, i) => (
          <FormRow key={r.id} icon={null}>
            <span className="text-xs">
              #{i + 1} · kind={r.targetKind} · {r.targetId.slice(0, 8)}…
            </span>
          </FormRow>
        ))
      )}
    </div>
  );
}
