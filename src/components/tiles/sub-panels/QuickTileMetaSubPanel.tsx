"use client";

import { ChevronLeft, X } from "lucide-react";

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
      <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-section">
        <button
          type="button"
          onClick={onBack}
          className="flex items-center gap-1 text-sm font-medium text-foreground-subtle hover:text-foreground transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
          {t("quickCreate.back")}
        </button>
        <h2 className="text-base font-semibold text-foreground">
          {t("quickCreate.metaNavTitle")}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={locale === "ja" ? "パネルを閉じる" : "Close panel"}
          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-2"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-section">
        <div className="space-y-section">
          <div>
            <h3 className="mb-1 text-sm font-medium text-foreground">
              {t("quickCreate.timedLabelsTitle")}
            </h3>
            <p className="mb-2 text-xs text-foreground-muted">
              {t("quickCreate.timedLabelsGuide")}
            </p>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={timedLabelDraft}
                onChange={(e) => setTimedLabelDraft(e.target.value)}
                placeholder={t("quickCreate.timedLabelsLabel")}
                aria-label={t("quickCreate.timedLabelsLabel")}
                className="flex-1 rounded-md border border-border bg-surface-1 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary/40"
              />
              <button
                type="button"
                onClick={() => {
                  const label = timedLabelDraft.trim();
                  if (!label) return;
                  setTimedLabels([...timedLabels, { label, startAt: null, endAt: null }]);
                  setTimedLabelDraft("");
                }}
                className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-fg"
              >
                {t("quickCreate.timedLabelsAdd")}
              </button>
            </div>
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
          </div>
        </div>
      </div>
    </>
  );
}
