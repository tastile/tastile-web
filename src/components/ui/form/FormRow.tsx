import { cn } from "@/lib/utils/cn";
import { Box, Group } from "@mantine/core";
import type { ReactNode } from "react";

interface FormRowProps {
  "data-testid"?: string;
  icon: ReactNode;
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
      <Group justify="center" gap={0} wrap="nowrap" className="text-foreground-muted">
        {icon}
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
