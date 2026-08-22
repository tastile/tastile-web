"use client";

import { useTranslation } from "@/shared/i18n/use-translation";
import { cn } from "@/shared/lib/cn";
import { Button, Group } from "@mantine/core";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { FormRow } from "./FormRow";

interface RowSubPanelProps {
  icon: LucideIcon;
  name: string;
  value: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  className?: string;
  emptyLabel?: string;
  disabled?: boolean;
}

export function RowSubPanel({
  icon: Icon,
  name,
  value,
  onClick,
  className,
  emptyLabel,
  disabled,
}: RowSubPanelProps) {
  const { t } = useTranslation();
  const isEmpty = value.trim() === "";
  return (
    <FormRow
      icon={
        <Icon
          size={20}
          className={disabled ? "text-foreground-muted/50" : "text-foreground-muted"}
        />
      }
      trailing={disabled ? null : <ChevronRight size={16} className="text-foreground-muted" />}
      className={className}
    >
      <Button
        onClick={disabled ? undefined : onClick}
        disabled={disabled}
        className={cn(
          "flex w-full items-center justify-between gap-3 text-left focus:outline-hidden focus-visible:ring-2 focus-visible:ring-background-control focus-visible:ring-offset-2 focus-visible:ring-offset-surface-1",
          disabled ? "cursor-not-allowed opacity-50" : null,
        )}
      >
        <Group gap="xs" wrap="nowrap">
          <span className={cn("text-sm", disabled ? "text-foreground-muted" : "text-foreground")}>
            {name}
          </span>
        </Group>
        <span
          className={isEmpty ? "text-xs text-foreground-muted" : "text-sm text-foreground-muted"}
        >
          {isEmpty ? (emptyLabel ?? t("common.notSet")) : value}
        </span>
      </Button>
    </FormRow>
  );
}
