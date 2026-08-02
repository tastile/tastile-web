import { cn } from "@/shared/lib/cn";
import { Stack } from "@mantine/core";
import type { ReactNode } from "react";

interface FormPanelProps {
  children: ReactNode;
  className?: string;
}

export function FormPanel({ children, className }: FormPanelProps) {
  return (
    <Stack data-testid="form-panel" gap="xs" p="md" className={cn("p-panel", className)}>
      {children}
    </Stack>
  );
}
