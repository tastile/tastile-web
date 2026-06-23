"use client";

import { Tag } from "lucide-react";
import { FormPanel, FormRow } from "@/components/ui/form";
import { SubPanelHeader } from "./SubPanelHeader";

interface TimedLabel {
  label: string;
  startAt: Date | null;
  endAt: Date | null;
}

interface Props {
  onBack: () => void;
  onClose: () => void;
  t: (key: string) => string;
  locale: "ja" | "en";
  timedLabelDraft: string;
  setTimedLabelDraft: (v: string) => void;
  timedLabels: TimedLabel[];
  setTimedLabels: (v: TimedLabel[]) => void;
}

export function QuickTileMetaSubPanel({
  onBack,
  onClose,
  t,
  locale,
  timedLabelDraft,
  setTimedLabelDraft,
  timedLabels,
  setTimedLabels,
}: Props) {
  return (
    <>
      <SubPanelHeader
        onBack={onBack}
        onClose={onClose}
        title={t("quickCreate.metaNavTitle")}
        locale={locale}
        t={t}
      />
      <div className="flex-1 overflow-y-auto">
        <FormPanel>
          <h3 className="mb-1 text-sm font-medium text-foreground">
            {t("quickCreate.timedLabelsTitle")}
          </h3>
          <p className="mb-2 text-xs text-foreground-muted">
            {t("quickCreate.timedLabelsGuide")}
          </p>
          <FormRow icon={<Tag size={20} />}>
            <div role="group" className="flex w-full items-center gap-2">
              <input
                type="text"
                value={timedLabelDraft}
                onChange={(e) => setTimedLabelDraft(e.target.value)}
                placeholder={t("quickCreate.timedLabelsLabel")}
                aria-label={t("quickCreate.timedLabelsLabel")}
                className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-muted focus:outline-hidden"
              />
              <button
                type="button"
                onClick={() => {
                  const label = timedLabelDraft.trim();
                  if (!label) return;
                  setTimedLabels([...timedLabels, { label, startAt: null, endAt: null }]);
                  setTimedLabelDraft("");
                }}
                className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg"
              >
                {t("quickCreate.timedLabelsAdd")}
              </button>
            </div>
          </FormRow>
          {timedLabels.length > 0 ? (
            <ul className="mt-2 space-y-1">
              {timedLabels.map((entry, idx) => (
                <li
                  key={`${entry.label}-${idx}`}
                  className="flex items-center justify-between rounded-md border border-border bg-surface-1 px-3 py-1.5 text-sm"
                >
                  <span>{entry.label}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setTimedLabels(timedLabels.filter((_, i) => i !== idx))
                    }
                    aria-label={`${t("quickCreate.removeTag")} ${entry.label}`}
                    className="text-foreground-muted"
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </FormPanel>
      </div>
    </>
  );
}
