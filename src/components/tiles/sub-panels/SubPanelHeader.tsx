"use client";

import { ChevronLeft, X } from "lucide-react";

interface Props {
  onBack: () => void;
  onClose: () => void;
  title: string;
  locale: "ja" | "en";
  t: (key: string) => string;
}

export function SubPanelHeader({ onBack, onClose, title, locale, t }: Props) {
  return (
    <div className="flex h-14 shrink-0 items-center justify-between border-b border-border px-section">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 text-sm font-medium text-foreground-subtle hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        {t("quickCreate.back")}
      </button>
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <button
        type="button"
        onClick={onClose}
        aria-label={locale === "ja" ? "パネルを閉じる" : "Close panel"}
        className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface-2"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
