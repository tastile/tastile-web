"use client";

import { Ban } from "lucide-react";
import { FormPanel, RowSegmented, RowToggle } from "@/components/ui/form";
import { SubPanelHeader } from "./SubPanelHeader";

interface Props {
  onBack: () => void;
  onClose: () => void;
  t: (key: string) => string;
  locale: "ja" | "en";
  interruptPenalty: number;
  setInterruptPenalty: (n: number) => void;
  resumePenalty: number;
  setResumePenalty: (n: number) => void;
  externalInterruptOnly: boolean;
  setExternalInterruptOnly: (v: boolean) => void;
}

export function QuickTileInterruptSubPanel({
  onBack,
  onClose,
  t,
  locale,
  interruptPenalty,
  setInterruptPenalty,
  resumePenalty,
  setResumePenalty,
  externalInterruptOnly,
  setExternalInterruptOnly,
}: Props) {
  return (
    <>
      <SubPanelHeader
        onBack={onBack}
        onClose={onClose}
        title={t("quickCreate.interruptNavTitle")}
        locale={locale}
        t={t}
      />
      <div className="flex-1 overflow-y-auto">
        <FormPanel>
          <h3 className="mb-1 text-sm font-medium text-foreground">
            {t("quickCreate.interruptPenaltyTitle")}
          </h3>
          <p className="mb-2 text-xs text-foreground-muted">
            {t("quickCreate.interruptPenaltyGuide")}
          </p>
          <RowSegmented
            icon={Ban}
            options={[1, 2, 3, 4, 5].map((level) => ({
              value: String(level),
              label: String(level),
            }))}
            value={String(interruptPenalty)}
            onChange={(v) => setInterruptPenalty(Number(v))}
          />

          <h3 className="mt-2 mb-1 text-sm font-medium text-foreground">
            {t("quickCreate.resumePenaltyTitle")}
          </h3>
          <p className="mb-2 text-xs text-foreground-muted">
            {t("quickCreate.resumePenaltyGuide")}
          </p>
          <RowSegmented
            icon={Ban}
            options={[1, 2, 3, 4, 5].map((level) => ({
              value: String(level),
              label: String(level),
            }))}
            value={String(resumePenalty)}
            onChange={(v) => setResumePenalty(Number(v))}
          />

          <h3 className="mt-2 mb-1 text-sm font-medium text-foreground">
            {t("quickCreate.externalInterruptOnlyTitle")}
          </h3>
          <p className="mb-2 text-xs text-foreground-muted">
            {t("quickCreate.externalInterruptOnlyGuide")}
          </p>
          <RowToggle
            icon={Ban}
            placeholder={t("quickCreate.externalInterruptOnlyTitle")}
            checked={externalInterruptOnly}
            onChange={setExternalInterruptOnly}
          />
        </FormPanel>
      </div>
    </>
  );
}
