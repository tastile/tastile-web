"use client";

import { Button, Stack, Switch, Text } from "@mantine/core";

import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { FormRow } from "@/shared/ui/form";
import { Link2, ListChecks, Tag } from "lucide-react";
import { SubPanelShell } from "./SubPanelShell";

export interface EventDetailsSubPanelProps {
  opened: boolean;
  onClose: () => void;
}

/**
 * Event-specific details sub-panel. Surfaces the "advanced" fields the
 * base view intentionally omits — the period-label toggle, sub-tasks,
 * and references. Kept intentionally minimal so the panel stays out of
 * the way of the common flow.
 */
export function EventDetailsSubPanel({ opened, onClose }: EventDetailsSubPanelProps) {
  const { t } = useTranslation();
  const activePanel = useQuickCreateStore((s) => s.activePanel);
  const tasks = useQuickCreateStore((s) => s.plan.completion.tasks);
  const references = useQuickCreateStore((s) => s.plan.references);
  const isLabelOnly = useQuickCreateStore((s) => s.meta.isLabelOnly);
  const setLabelOnly = useQuickCreateStore((s) => s.setLabelOnly);
  const setField = useQuickCreateStore((s) => s.setField);

  return (
    <SubPanelShell
      panelKey="event-details"
      activeKey={activePanel}
      onClose={onClose}
      headingId="event-details-heading"
      title={t("quickCreate.detailsEventTitle")}
      description={t("quickCreate.detailsSubDescription") || ""}
      layout="drawer"
    >
      <Stack gap="md">
        <FormRow icon={<Tag className="size-4" aria-hidden />} className="items-start">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">{t("quickCreate.periodLabelTitle")}</span>
            <Switch
              checked={isLabelOnly}
              onChange={(e) => setLabelOnly(e.currentTarget.checked)}
              label={t("quickCreate.periodLabelDescription")}
              size="sm"
              data-testid="event-label-only-toggle"
            />
          </div>
        </FormRow>

        <FormRow icon={<ListChecks className="size-4" aria-hidden />} className="items-start">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">{t("quickCreate.subtasksLabel")}</span>
            <Stack gap={2}>
              {tasks.length === 0 ? (
                <Text size="sm" c="dimmed">
                  {t("quickCreate.subtasksEmpty")}
                </Text>
              ) : (
                tasks.map((task) => (
                  <div
                    key={task.id}
                    className="flex items-center gap-2 rounded-md border border-border px-2 py-1.5"
                  >
                    <Text size="sm" className="flex-1 truncate">
                      {task.content.title}
                    </Text>
                  </div>
                ))
              )}
            </Stack>
            <Text size="xs" c="dimmed">
              {t("quickCreate.subtasksHint")}
            </Text>
          </div>
        </FormRow>

        <FormRow icon={<Link2 className="size-4" aria-hidden />} className="items-start">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">{t("quickCreate.referencesLabel")}</span>
            <Text size="sm" c="dimmed">
              {references.length === 0
                ? t("quickCreate.referencesEmpty")
                : `${references.length} reference${references.length === 1 ? "" : "s"}`}
            </Text>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setField("plan.references", []);
              }}
              data-testid="event-details-clear-refs"
            >
              {t("quickCreate.detailsClearReferences")}
            </Button>
          </div>
        </FormRow>
      </Stack>
    </SubPanelShell>
  );
}