"use client";

import { useSidePanel } from "@/shared/context/side-panel-context";
import { useTranslation } from "@/shared/i18n/use-translation";
import { PageSummaryPanel } from "@/shared/ui/PageSummaryPanel";
import { SubscriptionSection } from "@/shared/ui/SubscriptionSection";
import { Card as MantineCard, Progress, Stack, Text } from "@mantine/core";

export default function Billing() {
  const { t } = useTranslation();
  const sidePanel = (
    <PageSummaryPanel
      title={t("dashboard.billing.title")}
      description={t("dashboard.billing.description")}
      sections={[
        {
          heading: t("dashboard.billing.sections.quickLinks"),
          items: [
            { label: t("dashboard.billing.labels.quota"), value: "→", href: "/dashboard/quota" },
            {
              label: t("dashboard.billing.labels.account"),
              value: "→",
              href: "/dashboard/preferences/account",
            },
            { label: t("dashboard.billing.labels.pricing"), value: "→", href: "/pricing" },
          ],
        },
        {
          heading: t("dashboard.billing.sections.related"),
          items: [
            { label: t("dashboard.billing.labels.timeline"), value: "→", href: "/dashboard/timeline" },
            { label: t("dashboard.billing.labels.apiExplorer"), value: "→", href: "/dashboard/api" },
          ],
        },
      ]}
    />
  );
  useSidePanel(sidePanel);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-[590] text-foreground">{t("dashboard.billing.title")}</h1>
      <SubscriptionSection />
      <MantineCard
        radius="md"
        withBorder
        shadow="xs"
        bg="var(--surface-1)"
        className="border-border"
      >
        <Text size="lg" fw={590} mb="md">
          {t("dashboard.billing.usageHeading")}
        </Text>
        <Stack gap="md">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <Text size="sm" c="dimmed">
                {t("dashboard.billing.labels.tiles")}
              </Text>
              <Text size="sm">{t("dashboard.billing.labels.tilesDescription")}</Text>
            </div>
            <Progress value={0} size="sm" radius="xl" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <Text size="sm" c="dimmed">
                {t("dashboard.billing.labels.history")}
              </Text>
              <Text size="sm">{t("dashboard.billing.labels.historyDescription")}</Text>
            </div>
          </div>
        </Stack>
      </MantineCard>
    </div>
  );
}
