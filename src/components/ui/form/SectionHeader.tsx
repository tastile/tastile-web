import type { AlertCircle } from "lucide-react";

export function SectionHeader({
  icon: Icon,
  title,
}: {
  icon: typeof AlertCircle;
  title: string;
}) {
  return (
    <div
      className="flex items-center gap-2 pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted"
      data-testid="section-header"
    >
      <Icon size={14} aria-hidden="true" />
      <span>{title}</span>
    </div>
  );
}