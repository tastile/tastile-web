"use client";

import { Button } from "@mantine/core";

import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";

/**
 * Title-row submit button. Reads `submitState`, `canSubmit`, and
 * `mode` directly from the QuickCreate store so consumers can drop it
 * into a `FormRow` `trailing` slot without prop wiring.
 *
 * The actual submit call lives in QuickCreatePanel — this component is
 * presentation only. It dispatches a `quick-create:submit` window
 * event on click; QuickCreatePanel listens for the event and runs the
 * shared `handleSubmit`. This keeps the button decoupled from the
 * panel's internal closures.
 *
 * `data-testid="quick-create-submit"` is preserved so external tests
 * and consumers continue to find the submit affordance by id.
 */
export function QuickCreateSubmitButton() {
  const { t } = useTranslation();
  const submitState = useQuickCreateStore((s) => s.submitState);
  const canSubmit = useQuickCreateStore((s) => s.canSubmit);
  const mode = useQuickCreateStore((s) => s.mode);

  const isSubmitting = submitState.kind === "submitting";
  const label = mode === "edit" ? t("quickCreate.update") : t("quickCreate.create");

  const handleClick = () => {
    window.dispatchEvent(new CustomEvent("quick-create:submit"));
  };

  return (
    <Button
      onClick={handleClick}
      loading={isSubmitting}
      disabled={!canSubmit}
      data-testid="quick-create-submit"
      size="sm"
    >
      {label || "Create"}
    </Button>
  );
}
