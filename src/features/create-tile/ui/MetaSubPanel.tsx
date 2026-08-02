import { type SubPanelKey, SubPanelShell } from "@/features/create-tile/ui/SubPanelShell";
import type { Locale } from "@/shared/stores/locale-store";
import { Textarea } from "@/shared/ui/Input";
import { FormPanel, FormRow, SectionHeader } from "@/shared/ui/form";
import { ActionIcon, Button, Select, TagsInput } from "@mantine/core";
import { FolderOpen, Plus, Trash2 } from "lucide-react";

export interface MetaSubPanelProps {
  activePanel: SubPanelKey | null;
  setActivePanel: (panel: SubPanelKey) => void;
  isDesktop: boolean;
  t: (key: string) => string;
  meta: { ownerSubjectId: string | null; tags: string[]; memo: string };
  setField: (path: string, value: unknown) => void;
  projects: { workspaces: { id: string; display_name: string }[] };
  knownTags: string[];
  openProjectModal: () => void;
}

export function MetaSubPanel({
  activePanel,
  setActivePanel,
  isDesktop,
  t,
  meta,
  setField,
  projects,
  knownTags,
  openProjectModal,
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
        <SectionHeader icon={FolderOpen} title={t("quickCreate.metaNavTitle")} />
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
            <span>{t("quickCreate.organizeProject")}</span>
          </div>
          <div className="flex flex-col gap-2" data-testid="meta-project-catalog">
            <div className="flex items-center gap-1">
              <Select
                size="xs"
                variant="filled"
                aria-label={t("quickCreate.organizeProject")}
                placeholder={t("quickCreate.organizeProject")}
                value={meta.ownerSubjectId ?? ""}
                onChange={(value) => setField("meta.ownerSubjectId", value ? value : null)}
                allowDeselect={false}
                leftSection={<FolderOpen size={14} aria-hidden="true" />}
                data={[
                  {
                    value: "",
                    label: t("quickCreate.projectOwnerDefault"),
                  },
                  ...projects.workspaces.map((w) => ({
                    value: w.id,
                    label: w.display_name,
                  })),
                ]}
                comboboxProps={{ withinPortal: true }}
                searchable
                className="flex-1"
                styles={{
                  input: { backgroundColor: "var(--surface-2)" },
                }}
              />
              <ActionIcon
                type="button"
                variant="outline"
                size="md"
                radius="md"
                aria-label={t("quickCreate.projectCreateLabel")}
                data-testid="meta-project-create"
                onClick={openProjectModal}
              >
                <Plus size={14} aria-hidden="true" />
              </ActionIcon>
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wide text-foreground-muted">
            <span>{t("quickCreate.organizeTags")}</span>
            <span className="text-[10px] font-normal text-foreground-muted">
              {t("quickCreate.organizeTagsMulti")}
            </span>
          </div>
          <TagsInput
            data-testid="meta-tag-chips"
            value={meta.tags}
            onChange={(values) => setField("meta.tags", values)}
            placeholder={t("quickCreate.tagsPlaceholder")}
            aria-label={t("quickCreate.tagsPlaceholder")}
            size="xs"
            variant="filled"
            splitChars={[",", " "]}
            clearable
            data={knownTags}
            styles={{
              input: { backgroundColor: "var(--surface-2)" },
              pill: { backgroundColor: "var(--accent-soft, var(--surface-2))" },
            }}
          />
        </div>
        <FormRow icon={null}>
          <Textarea
            value={meta.memo}
            onChange={(e) => setField("meta.memo", e.target.value)}
            placeholder={t("quickCreate.memoPlaceholder")}
            aria-label={t("quickCreate.memoPlaceholder")}
            rows={6}
            className="w-full resize-none border-0 bg-transparent p-0 text-sm focus:ring-0"
          />
        </FormRow>
        <div className="flex items-center gap-2 border-t border-border/40 pt-3">
          <Button
            type="button"
            size="sm"
            variant="subtle"
            leftSection={<Trash2 size={12} aria-hidden="true" />}
            onClick={() => {
              setField("meta.ownerSubjectId", null);
              setField("meta.tags", []);
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
