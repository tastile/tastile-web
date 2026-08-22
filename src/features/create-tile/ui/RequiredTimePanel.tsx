"use client";

import { useTranslation } from "@/shared/i18n/use-translation";
import { FormRow } from "@/shared/ui/form";
import { NumberInput } from "@mantine/core";
import { Timer } from "lucide-react";

const MIN_MINUTES = 5;

export function RequiredTimePanel({
  minutes,
  onChange,
}: {
  minutes: number;
  onChange: (minutes: number) => void;
}) {
  const { t } = useTranslation();
  return (
    <FormRow icon={<Timer className="h-4 w-4" aria-hidden />} className="items-start">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium">{t("quickCreate.durationTitle")}</span>
        <NumberInput
          aria-label={t("quickCreate.durationInputLabel")}
          min={MIN_MINUTES}
          step={5}
          value={minutes}
          onChange={(value) => onChange(Math.max(MIN_MINUTES, Number(value) || MIN_MINUTES))}
          suffix=" min"
          size="xs"
          styles={{
            input: { backgroundColor: "var(--surface-2)" },
          }}
        />
        <p className="text-xs text-foreground-muted">{t("quickCreate.durationSub")}</p>
      </div>
    </FormRow>
  );
}
