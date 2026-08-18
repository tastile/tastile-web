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
  children?: ReactNode;
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
        // 2-column grid (icon + content). The trailing element lives
        // inside the content cell so it can be right-justified without
        // a 12px gap sitting between the content and an empty `auto`
        // track — that gap used to leave a noticeable dead zone on the
        // right of the title / memo underline.
        "grid grid-cols-[20px_1fr] items-center gap-3",
        tight ? "min-h-row-tight" : "min-h-row",
        className,
      )}
    >
      <Group justify="center" gap={0} wrap="nowrap" className="text-foreground-muted" aria-hidden={icon === undefined}>
        {icon ?? <span className="w-5" />}
      </Group>
      <div className="flex min-w-0 items-center justify-between gap-3">
        <div className="min-w-0 flex-1">{children}</div>
        {trailing !== undefined ? (
          <Group justify="flex-end" gap={0} wrap="nowrap" className="shrink-0">
            {trailing}
          </Group>
        ) : null}
      </div>
    </Box>
  );
}
