"use client";

import { Button } from "@mantine/core";
import { FileText } from "lucide-react";

import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { FormRow } from "@/shared/ui/form";
import type { SubPanelKey } from "../SubPanelShell";

interface DetailsAffordanceButtonProps {
  /** Sub-panel key to activate when the user clicks the button. */
  panelKey: SubPanelKey;
  /** i18n key for the button label. */
  labelKey: string;
  /** English fallback used when the i18n key resolves to empty. */
  fallbackLabel: string;
  testId: string;
}

/**
 * Details affordance button — shared across the specialized workflow
 * forms. Each workflow has a "details" sub-panel (Task details / Event
 * details / Recurring details) that is opened by tapping this button.
 *
 * The store-driven `setActivePanel(panelKey)` is called directly so the
 * shared component never receives the active-panel callback as a prop.
 * Wrapped in `px-4 py-3` so consumers can drop it in directly.
 */
export function DetailsAffordanceButton({
  panelKey,
  labelKey,
  fallbackLabel,
  testId,
}: DetailsAffordanceButtonProps) {
  const { t } = useTranslation();
  const setActivePanel = useQuickCreateStore((s) => s.setActivePanel);

  return (
    <div className="px-4 py-3">
      <FormRow icon={<FileText className="h-4 w-4" aria-hidden />}>
        <Button
          variant="default"
          size="sm"
          onClick={() => setActivePanel(panelKey)}
          data-testid={testId}
          fullWidth
          className="w-full"
        >
          {t(labelKey) || fallbackLabel}
        </Button>
      </FormRow>
    </div>
  );
}
