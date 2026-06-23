"use client";

import { ChevronLeft, X } from "lucide-react";

interface Props {
  onBack: () => void;
  onClose: () => void;
  t: (key: string) => string;
  locale: "ja" | "en";
  interruptPenalty: number;
  setInterruptPenalty: (n: number) => void;
  resumePenalty: number;
  setResumePenalty: (n: number) => void;
  externalInterruptOnly: boolean;
  setExternalInterruptOnly: (v: boolean) => void;
}

export function QuickTileInterruptSubPanel({
  onBack,
  onClose,
  t,
  locale,
  interruptPenalty,
  setInterruptPenalty,
  resumePenalty,
  setResumePenalty,
  externalInterruptOnly,
  setExternalInterruptOnly,
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
          {t("quickCreate.interruptNavTitle")}
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
              {t("quickCreate.interruptPenaltyTitle")}
            </h3>
            <p className="mb-2 text-xs text-foreground-muted">
              {t("quickCreate.interruptPenaltyGuide")}
            </p>
            <div className="grid grid-cols-5 gap-section">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={`interrupt-${level}`}
                  type="button"
                  onClick={() => setInterruptPenalty(level)}
                  aria-pressed={interruptPenalty === level}
                  className="rounded-md border border-border bg-surface-1 px-3 py-1.5 text-sm"
                >
                  {String(level)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-medium text-foreground">
              {t("quickCreate.resumePenaltyTitle")}
            </h3>
            <p className="mb-2 text-xs text-foreground-muted">
              {t("quickCreate.resumePenaltyGuide")}
            </p>
            <div className="grid grid-cols-5 gap-section">
              {[1, 2, 3, 4, 5].map((level) => (
                <button
                  key={`resume-${level}`}
                  type="button"
                  onClick={() => setResumePenalty(level)}
                  aria-pressed={resumePenalty === level}
                  className="rounded-md border border-border bg-surface-1 px-3 py-1.5 text-sm"
                >
                  {String(level)}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-medium text-foreground">
              {t("quickCreate.externalInterruptOnlyTitle")}
            </h3>
            <p className="mb-2 text-xs text-foreground-muted">
              {t("quickCreate.externalInterruptOnlyGuide")}
            </p>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={externalInterruptOnly}
                onChange={(e) => setExternalInterruptOnly(e.target.checked)}
                aria-label={t("quickCreate.externalInterruptOnlyTitle")}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
              />
              <span>{t("quickCreate.externalInterruptOnlyTitle")}</span>
            </label>
          </div>
        </div>
      </div>
    </>
  );
}
