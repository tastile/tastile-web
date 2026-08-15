"use client";

import { Button, Stack, Text } from "@mantine/core";
import { Link2 } from "lucide-react";

import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { FormRow } from "@/shared/ui/form";
import { SubPanelShell } from "./SubPanelShell";
import { SubtasksSection } from "./sections/SubtasksSection";

export interface TaskDetailsSubPanelProps {
  opened: boolean;
  onClose: () => void;
  durationMinMs: number | null;
  durationMaxMs: number | null;
}

/**
 * Task-specific details sub-panel. Surfaces the "advanced" fields the
 * base view intentionally omits — sub-task checklist and the linked-
 * tile references. Kept intentionally minimal so the panel stays out
 * of the way of the common flow.
 */
export function TaskDetailsSubPanel({
  opened,
  onClose,
  durationMinMs,
  durationMaxMs,
}: TaskDetailsSubPanelProps) {
  const { t } = useTranslation();
  const activePanel = useQuickCreateStore((s) => s.activePanel);
  const setField = useQuickCreateStore((s) => s.setField);

  return (
    <SubPanelShell
      panelKey="task-details"
      activeKey={activePanel}
      onClose={onClose}
      headingId="task-details-heading"
      title={t("quickCreate.detailsTaskTitle") || "Task details"}
      description={t("quickCreate.detailsSubDescription") || ""}
      layout="drawer"
    >
      <Stack gap="md">
        <SubtasksSection testId="task-details-subtasks" bare />

        <FormRow icon={<Link2 className="h-4 w-4" aria-hidden />} className="items-start">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">{t("quickCreate.timeRequirementLabel") || "Time requirement"}</span>
            <Text size="sm" c="dimmed">
              {durationMinMs == null
                ? t("quickCreate.durationNoneTitle") || "No required duration"
                : `${Math.round((durationMinMs ?? 0) / 60_000)} min`}
            </Text>
            <Text size="xs" c="dimmed">
              {t("quickCreate.durationNoneSub") ||
                "Adjust the base form duration chip to change this."}
            </Text>
          </div>
        </FormRow>

        <FormRow icon={null}>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setField("plan.references", []);
            }}
            data-testid="task-details-clear-refs"
          >
            {t("quickCreate.detailsClearReferences") || "Clear references"}
          </Button>
        </FormRow>
      </Stack>
    </SubPanelShell>
  );
}
