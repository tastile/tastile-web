import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface FormPanelProps {
  children: ReactNode;
  className?: string;
}

export function FormPanel({ children, className }: FormPanelProps) {
  return (
    <div data-testid="form-panel" className={cn("p-panel flex flex-col gap-2", className)}>
      {children}
    </div>
  );
}
