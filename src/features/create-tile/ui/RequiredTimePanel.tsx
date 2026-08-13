"use client";

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
  return (
    <FormRow icon={<Timer className="h-4 w-4" aria-hidden />} className="items-start">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium">Required time</span>
        <NumberInput
          aria-label="Required time (min)"
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
        <p className="text-xs text-foreground-muted">
          Actual start and end times are decided later from available time.
        </p>
      </div>
    </FormRow>
  );
}
