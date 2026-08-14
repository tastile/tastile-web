"use client";

import { ColorInput } from "@mantine/core";
import { Folder } from "lucide-react";

import { useTranslation } from "@/shared/i18n/use-translation";
import { useQuickCreateStore } from "@/shared/stores/quick-create-store";
import { FormRow } from "@/shared/ui/form";
import { ProjectPicker } from "../ProjectPicker";

interface ProjectColorRowProps {
  pickerTestId: string;
  colorTestId: string;
  swatches: string[];
  /** Override the trailing color input width. Default `w-[120px]`. */
  colorClassName?: string;
}

/**
 * Project + Color row — shared across the specialized workflow forms.
 *
 * Renders a `FormRow` with a `Folder` icon, `ProjectPicker` in the main
 * cell, and `ColorInput` in the trailing slot. Each workflow passes its
 * own swatch palette (Task / Event / Recurring have distinct defaults).
 * Wrapped in `px-4 py-3` so consumers can drop it in directly.
 */
export function ProjectColorRow({
  pickerTestId,
  colorTestId,
  swatches,
  colorClassName = "w-[120px]",
}: ProjectColorRowProps) {
  const { t } = useTranslation();
  const visualColor = useQuickCreateStore((s) => s.identity.visual.color);
  const setField = useQuickCreateStore((s) => s.setField);

  return (
    <div className="px-4 py-3">
      <FormRow
        icon={<Folder className="h-4 w-4" aria-hidden />}
        trailing={
          <ColorInput
            value={visualColor}
            onChange={(v) => setField("identity.visual.color", v)}
            size="sm"
            format="hex"
            fixOnBlur
            withPicker={false}
            withEyeDropper={false}
            aria-label={t("quickCreate.colorLabel") || "Color"}
            swatches={swatches}
            data-testid={colorTestId}
            className={colorClassName}
          />
        }
      >
        <ProjectPicker testId={pickerTestId} />
      </FormRow>
    </div>
  );
}
