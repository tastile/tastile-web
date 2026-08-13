"use client";

import { Button, Stack, Text } from "@mantine/core";

import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { FormRow } from "@/shared/ui/form";
import { Link2, Repeat } from "lucide-react";
import { SubPanelShell } from "./SubPanelShell";

export interface RecurringDetailsSubPanelProps {
  opened: boolean;
  onClose: () => void;
}

/**
 * Recurring-specific details sub-panel. Surfaces the "advanced" fields
 * the base view intentionally omits — frameRules summary, condition
 * tree placeholder, and references clear. Kept intentionally minimal so
 * the panel stays out of the way of the common flow.
 */
export function RecurringDetailsSubPanel({
  opened,
  onClose,
}: RecurringDetailsSubPanelProps) {
  const { t } = useTranslation();
  const activePanel = useQuickCreateStore((s) => s.activePanel);
  const frameRules = useQuickCreateStore((s) => s.recurring.frameRules);
  const references = useQuickCreateStore((s) => s.plan.references);
  const setField = useQuickCreateStore((s) => s.setField);

  return (
    <SubPanelShell
      panelKey="recurring-details"
      activeKey={activePanel}
      onClose={onClose}
      headingId="recurring-details-heading"
      title={t("quickCreate.detailsRecurringTitle") || "Recurring details"}
      description={t("quickCreate.detailsSubDescription") || ""}
      layout="drawer"
    >
      <Stack gap="md">
        <FormRow icon={<Repeat className="h-4 w-4" aria-hidden />} className="items-start">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">{t("quickCreate.frameRulesLabel") || "Frame rules"}</span>
            <Text size="sm" c="dimmed">
              {frameRules.length === 0
                ? t("quickCreate.frameRulesEmpty") ||
                  "No frame rules yet — defaults apply."
                : `${frameRules.length} rule${frameRules.length === 1 ? "" : "s"}`}
            </Text>
          </div>
        </FormRow>

        <FormRow icon={<Link2 className="h-4 w-4" aria-hidden />} className="items-start">
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium">{t("quickCreate.referencesLabel") || "References"}</span>
            <Text size="sm" c="dimmed">
              {references.length === 0
                ? t("quickCreate.referencesEmpty") || "No references yet"
                : `${references.length} reference${references.length === 1 ? "" : "s"}`}
            </Text>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setField("plan.references", []);
              }}
              data-testid="recurring-details-clear-refs"
            >
              {t("quickCreate.detailsClearReferences") || "Clear references"}
            </Button>
          </div>
        </FormRow>
      </Stack>
    </SubPanelShell>
  );
}
