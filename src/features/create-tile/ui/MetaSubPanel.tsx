import { type SubPanelKey, SubPanelShell } from "@/features/create-tile/ui/SubPanelShell";
import { Textarea } from "@/shared/ui/Input";
import { FormPanel, FormRow, SectionHeader } from "@/shared/ui/form";
import { Button } from "@mantine/core";
import { MessageSquare, Trash2 } from "lucide-react";

export interface MetaSubPanelProps {
  activePanel: SubPanelKey | null;
  setActivePanel: (panel: SubPanelKey) => void;
  isDesktop: boolean;
  t: (key: string) => string;
  meta: { ownerSubjectId: string | null; memo: string };
  setField: (path: string, value: unknown) => void;
}

export function MetaSubPanel({
  activePanel,
  setActivePanel,
  isDesktop,
  t,
  meta,
  setField,
}: MetaSubPanelProps) {
  return (
    <SubPanelShell
      panelKey="meta"
      activeKey={activePanel}
      onClose={() => setActivePanel("base")}
      headingId="meta-heading"
      title={t("quickCreate.metaNavTitle")}
      layout={isDesktop ? "drawer" : "sheet"}
    >
      <FormPanel>
        <SectionHeader icon={MessageSquare} title={t("quickCreate.metaNavTitle")} />
        <FormRow icon={null}>
          <Textarea
            value={meta.memo}
            onChange={(e) => setField("meta.memo", e.target.value)}
            placeholder={t("quickCreate.memoPlaceholder")}
            aria-label={t("quickCreate.memoPlaceholder")}
            rows={6}
            data-testid="quick-create-input-meta-memo"
            className="w-full resize-none border-0 bg-transparent p-0 text-sm focus-visible:outline-none"
          />
        </FormRow>
        <div className="flex items-center gap-2 pt-3">
          <Button
            type="button"
            size="sm"
            variant="subtle"
            leftSection={<Trash2 size={12} aria-hidden="true" />}
            onClick={() => {
              setField("meta.ownerSubjectId", null);
              setField("meta.memo", "");
            }}
            className="text-danger hover:bg-danger/10"
          >
            {t("quickCreate.completionRemoveLabel")}
          </Button>
        </div>
      </FormPanel>
    </SubPanelShell>
  );
}
