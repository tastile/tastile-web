"use client";

import { ActionIcon, Group, Stack } from "@mantine/core";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

interface SubPanelHeaderProps {
  onBack: () => void;
  backAriaLabel: string;
  title: ReactNode;
  subtitle?: ReactNode;
}

export function SubPanelHeader({ onBack, backAriaLabel, title, subtitle }: SubPanelHeaderProps) {
  return (
    <Group h={62} gap="sm" px="sm" className="shrink-0 border-b border-border bg-surface-0">
      <ActionIcon
        type="button"
        onClick={onBack}
        variant="subtle"
        size={34}
        radius="lg"
        aria-label={backAriaLabel}
      >
        <ChevronLeft size={16} />
      </ActionIcon>
      <Stack gap={0} className="min-w-0 flex-1">
        <strong className="block truncate text-sm font-semibold">{title}</strong>
        {subtitle ? (
          <small className="block truncate text-[10px] text-foreground-muted">{subtitle}</small>
        ) : null}
      </Stack>
    </Group>
  );
}
