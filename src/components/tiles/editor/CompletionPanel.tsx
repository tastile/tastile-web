"use client";

/**
 * CompletionPanel — Plan.completion editor (TimeRequirement + Tasks + Condition tree).
 *
 * Scaffold for Plan #6 Phase 4. Currently renders the completion section from
 * the shell verbatim. Will be promoted to a real panel in a follow-up commit
 * once SchedulePanel extraction is verified end-to-end.
 */

import { Clock, ListChecks, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/Button";
import { FormRow } from "@/components/ui/form";
import type { TimeRequirement } from "@/lib/domain/v1/completion";

export interface CompletionPanelProps {
  timeRequirements: TimeRequirement[];
  setField: (path: string, value: unknown) => void;
  t: (key: string) => string;
}

export function CompletionPanel({ timeRequirements, setField, t }: CompletionPanelProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-foreground-muted">
        <ListChecks size={14} aria-hidden="true" />
        <span>{t("quickCreate.completionNavTitle")}</span>
      </div>
      {timeRequirements.map((tr, i) => (
        <FormRow key={tr.id} icon={<Clock size={20} />}>
          <div className="grid w-full grid-cols-2 gap-2 text-xs">
            <span className="text-foreground-muted">
              #{i + 1} · {tr.required.minMs !== null ? `${Math.round(tr.required.minMs / 60000)} min` : "—"}
            </span>
            <Button
              type="button"
              size="icon-xs"
              variant="ghost"
              icon={<Trash2 size={12} aria-hidden="true" />}
              onClick={() => {
                const next = timeRequirements.slice();
                next.splice(i, 1);
                setField("plan.completion.timeRequirements", next);
              }}
              aria-label={t("quickCreate.removeItem")}
            />
          </div>
        </FormRow>
      ))}
      <Button
        type="button"
        size="small"
        variant="default"
        rounded
        iconLeft={<Plus size={12} aria-hidden="true" />}
        onClick={() => {
          setField("plan.completion.timeRequirements", [
            ...timeRequirements,
            {
              id: `tr_${Math.random().toString(36).slice(2, 9)}`,
              observation: { scope: 0 as never },
              required: { minMs: 60 * 60000 },
            },
          ]);
        }}
      >
        {t("quickCreate.timeRequirement")}
      </Button>
    </div>
  );
}