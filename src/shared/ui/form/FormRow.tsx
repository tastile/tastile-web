import { cn } from "@/shared/lib/cn";
import { Box, Group } from "@mantine/core";
import type { ReactNode } from "react";

interface FormRowProps {
  "data-testid"?: string;
  /**
   * Optional icon. When omitted, the icon column stays reserved at 20px so
   * the content column always starts at the same offset — this is how
   * title rows (no icon) align with regular field rows without `pl-[48px]`
   * magic numbers. The grid track is structural, not conditional.
   */
  icon?: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
  tight?: boolean;
}

export function FormRow({
  icon,
  children,
  trailing,
  className,
  tight = false,
  "data-testid": dataTestid,
}: FormRowProps) {
  return (
    <Box
      data-testid={dataTestid ?? "form-row"}
      className={cn(
        "grid grid-cols-[20px_1fr_auto] items-center gap-3",
        tight ? "min-h-row-tight" : "min-h-row",
        className,
      )}
    >
      <Group justify="center" gap={0} wrap="nowrap" className="text-foreground-muted" aria-hidden={icon === undefined}>
        {icon ?? <span className="w-5" />}
      </Group>
      <div className="min-w-0 flex items-center">{children}</div>
      {trailing !== undefined && (
        <Group justify="flex-end" gap={0} wrap="nowrap">
          {trailing}
        </Group>
      )}
    </Box>
  );
}
