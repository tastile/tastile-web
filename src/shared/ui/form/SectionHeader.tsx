import { Group } from "@mantine/core";
import type { AlertCircle } from "lucide-react";

export function SectionHeader({ icon: Icon, title }: { icon: typeof AlertCircle; title: string }) {
  return (
    <Group
      gap="xs"
      py={4}
      className="pt-2 pb-1 text-xs font-semibold uppercase tracking-wide text-foreground-muted"
      data-testid="section-header"
    >
      <Icon size={14} aria-hidden="true" />
      <span>{title}</span>
    </Group>
  );
}
