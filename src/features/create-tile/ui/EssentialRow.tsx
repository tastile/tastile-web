import { useTranslation } from "@/shared/i18n/use-translation";
import { cn } from "@/shared/lib/cn";
import { FormRow } from "@/shared/ui/form";
import { Button } from "@mantine/core";
import { Check, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function EssentialRow({
  icon: Icon,
  label,
  chip,
  clearable,
  onClear,
  onClick,
  editAria,
  clearAria,
  confirmClearAria,
  confirmClearLabel,
  testId,
}: {
  icon: typeof import("lucide-react").Calendar;
  label: string;
  chip: React.ReactNode;
  clearable?: boolean;
  onClear?: () => void;
  onClick: () => void;
  editAria?: string;
  clearAria?: string;
  confirmClearAria?: string;
  confirmClearLabel?: string;
  testId?: string;
}) {
  const [armed, setArmed] = useState(false);
  const { t } = useTranslation();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  function disarm() {
    setArmed(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function handleClearClick() {
    if (!onClear) return;
    if (armed) {
      disarm();
      onClear();
    } else {
      setArmed(true);
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        setArmed(false);
      }, 4000);
    }
  }

  const canClear = Boolean(clearable && onClear);

  return (
    <div className="relative px-4 py-3">
      <FormRow
        icon={<Icon className="h-4 w-4" aria-hidden />}
        trailing={<ChevronRight size={16} className="text-foreground-muted" />}
      >
        <button
          type="button"
          onClick={onClick}
          aria-label={editAria ?? `${label} ${t("quickCreate.essentialRowEditSuffix")}`}
          data-testid={testId}
          className="group flex min-h-[48px] w-full items-center gap-2 rounded-lg transition-colors hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-primary"
        >
          <span className="w-[58px] shrink-0 select-none text-caption font-bold text-foreground-muted">
            {label}
          </span>
          <div className="min-w-0 flex-1 text-left">{chip}</div>
        </button>
      </FormRow>
      {canClear ? (
        <div className="absolute right-10 top-1/2 -translate-y-1/2">
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleClearClick();
            }}
            aria-label={armed ? (confirmClearAria ?? t("common.confirm")) : (clearAria ?? t("quickCreate.essentialRowClearDefaultAria"))}
            data-armed={armed ? "true" : undefined}
            variant="subtle"
            size="xs"
            className={cn(
              "transition-colors",
              armed
                ? "animate-pulse bg-danger text-white hover:bg-danger/90"
                : "text-foreground-muted hover:bg-danger/15 hover:text-danger",
            )}
            onBlur={() => armed && disarm()}
          >
            {armed ? (
              <>
                <Check size={12} />
                {confirmClearLabel ?? t("common.confirm")}
              </>
            ) : (
              <X size={12} />
            )}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
