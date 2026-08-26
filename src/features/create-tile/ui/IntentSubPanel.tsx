import { type SubPanelKey, SubPanelShell } from "@/features/create-tile/ui/SubPanelShell";
import { Paper, SimpleGrid, Text, UnstyledButton } from "@mantine/core";
import { Layers, Link2, ListChecks, Play, SlidersHorizontal, Type } from "lucide-react";
import { INTENT_ITEMS } from "./quick-create-utils";

export interface IntentSubPanelProps {
  activePanel: SubPanelKey | null;
  setActivePanel: (panel: SubPanelKey) => void;
  isDesktop: boolean;
  t: (key: string) => string;
}

export function IntentSubPanel({ activePanel, setActivePanel, isDesktop, t }: IntentSubPanelProps) {
  return (
    <SubPanelShell
      panelKey="intent"
      activeKey={activePanel}
      onClose={() => setActivePanel("base")}
      headingId="intent-heading"
      title={t("quickCreate.addConditionOrGroup")}
      description={t("quickCreate.intentSubTitle")}
      layout={isDesktop ? "drawer" : "sheet"}
    >
      <p className="mb-3 text-caption text-foreground-muted">{t("quickCreate.intentDescription")}</p>
      <SimpleGrid cols={2} spacing="xs" data-testid="intent-grid">
        {INTENT_ITEMS.map((item) => (
          <Paper key={item.key} radius="md">
            <UnstyledButton
              onClick={() => setActivePanel(item.panel)}
              className="flex min-h-[64px] w-full items-center gap-2.5 px-3 py-2 text-left focus-visible:ring-2 focus-visible:ring-primary"
            >
              <item.icon size={14} className="shrink-0 text-primary" />
              <div className="min-w-0">
                <Text size="xs" fw={600}>
                  {t(item.titleKey)}
                </Text>
                <Text size="10" c="var(--foreground-muted)">
                  {t(item.subKey)}
                </Text>
              </div>
            </UnstyledButton>
          </Paper>
        ))}
        <Paper radius="md" opacity={0.5}>
          <div className="flex min-h-[64px] items-center gap-2.5 px-3 py-2">
            <Type size={14} className="shrink-0 text-foreground-muted" />
            <div className="min-w-0">
              <Text size="xs" fw={600}>
                {t("quickCreate.intentTextCondition")}
              </Text>
              <Text size="10" c="var(--foreground-muted)">
                {t("quickCreate.intentTextConditionSub")}
              </Text>
            </div>
          </div>
        </Paper>
      </SimpleGrid>
    </SubPanelShell>
  );
}
