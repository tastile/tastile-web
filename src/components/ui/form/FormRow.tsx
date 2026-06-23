import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

interface FormRowProps {
  icon: ReactNode;
  children: ReactNode;
  trailing?: ReactNode;
  className?: string;
  tight?: boolean;
}

export function FormRow({ icon, children, trailing, className, tight = false }: FormRowProps) {
  return (
    <div
      data-testid="form-row"
      className={cn(
        "grid grid-cols-[20px_1fr_auto] items-center gap-3",
        tight ? "min-h-row-tight" : "min-h-row",
        className,
      )}
    >
      <div className="flex items-center justify-center text-foreground-muted">{icon}</div>
      <div className="min-w-0 flex items-center">{children}</div>
      {trailing !== undefined && <div className="flex items-center justify-end">{trailing}</div>}
    </div>
  );
}
