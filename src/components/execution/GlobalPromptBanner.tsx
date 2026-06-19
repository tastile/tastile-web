"use client";

import { useState } from "react";
import type { PendingPrompt, PromptAction } from "@/lib/domain/execution";
import { useTranslation } from "@/lib/i18n/use-translation";

interface GlobalPromptBannerProps {
  prompt: PendingPrompt | null;
  onAction?: (action: PromptAction, payload?: { deferMinutes?: number }) => void;
  onDismiss?: () => void;
}

const PROMPT_TITLE: Record<PendingPrompt["kind"], string> = {
  start_tile: "Start tile",
  end_tile: "End tile",
  end_break: "End break",
};

const SEVERITY_STYLE: Record<NonNullable<PendingPrompt["severity"]>, string> = {
  soft: "bg-surface-elevated",
  elevated: "bg-warning/10",
  critical: "bg-danger/10",
};

export function GlobalPromptBanner({ prompt, onAction, onDismiss }: GlobalPromptBannerProps) {
  const { t, locale } = useTranslation();
  const [deferMenuPromptId, setDeferMenuPromptId] = useState<string | null>(null);
  if (!prompt) return null;
  const deferOptions =
    locale === "ja"
      ? [
          { label: "30分", minutes: 30 },
          { label: "1時間", minutes: 60 },
          { label: "2時間", minutes: 120 },
          { label: "明日", minutes: 1440 },
          { label: "来週", minutes: 10080 },
        ]
      : [
          { label: "30 min", minutes: 30 },
          { label: "1 hour", minutes: 60 },
          { label: "2 hours", minutes: 120 },
          { label: "Tomorrow", minutes: 1440 },
          { label: "Next week", minutes: 10080 },
        ];

  const showDeferOptions = deferMenuPromptId === prompt.promptId;
  const visibleActions = prompt.actions.filter((action) => action !== "dismiss");
  const canDismiss = prompt.actions.includes("dismiss") && typeof onDismiss === "function";
  const title = prompt.title?.trim() || PROMPT_TITLE[prompt.kind];

  return (
    <div className="fixed top-4 right-4 z-[70] w-[min(92vw,420px)]">
      <div className={`rounded-2xl p-4 backdrop-blur ${SEVERITY_STYLE[prompt.severity]}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-foreground">{title}</div>
          </div>
          {canDismiss ? (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-md px-2 py-1 text-xs text-foreground-muted hover:bg-surface-2"
            >
              {t("common.close")}
            </button>
          ) : null}
        </div>
        {showDeferOptions ? (
          <div className="mt-3">
            <div className="grid grid-cols-2 gap-2">
              {deferOptions.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => onAction?.("defer_tile", { deferMinutes: option.minutes })}
                  className="min-h-10 rounded-full bg-surface-2 px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-1"
                >
                  {option.label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setDeferMenuPromptId(null)}
              className="mt-2 min-h-9 rounded-full bg-surface-2 px-3 py-2 text-xs font-semibold text-foreground-muted hover:bg-surface-1"
            >
              {locale === "ja" ? "戻る" : "Back"}
            </button>
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {visibleActions.map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => {
                  if (action === "defer_tile") {
                    setDeferMenuPromptId(prompt.promptId);
                    return;
                  }
                  onAction?.(action);
                }}
                className="min-h-10 rounded-full bg-surface-2 px-4 py-2 text-sm font-semibold text-foreground hover:bg-surface-1"
              >
                {labelForAction(action, t)}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function labelForAction(action: PromptAction, t: (key: string) => string): string {
  switch (action) {
    case "start_tile":
      return t("tiles.actions.start");
    case "complete_tile":
      return t("tiles.actions.complete");
    case "complete_phase":
      return t("tiles.actions.complete");
    case "start_break_parallel":
      return t("prompt.actions.startBreak");
    case "start_break_split":
      return t("prompt.actions.startBreak");
    case "start_break_split_and_extend":
      return t("prompt.actions.extend");
    case "extend_phase":
      return t("prompt.actions.extend");
    case "defer_tile":
      return t("tiles.actions.defer");
    case "end_break":
      return t("prompt.actions.endBreak");
    case "confirm_continue":
      return t("prompt.actions.confirmContinue");
    case "confirm_stop_at":
      return t("prompt.actions.confirmStopAt");
    case "confirm_executed":
      return t("prompt.actions.confirmExecuted");
    case "confirm_skipped":
      return t("prompt.actions.confirmSkipped");
    case "dismiss":
      return t("common.close");
  }
}
