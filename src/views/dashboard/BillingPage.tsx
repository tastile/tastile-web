"use client";

import { useSidePanel } from "@/shared/context/side-panel-context";
import { PageSummaryPanel } from "@/shared/ui/PageSummaryPanel";
import { SubscriptionSection } from "@/shared/ui/SubscriptionSection";
import { Card as MantineCard, Progress, Stack, Text } from "@mantine/core";

const BILLING_SIDE_PANEL = (
  <PageSummaryPanel
    title="Billing"
    description="Manage your subscription, payment method, and invoice history. Pro features unlock when the webhook confirms."
    sections={[
      {
        heading: "Quick links",
        items: [
          { label: "Quota", value: "→", href: "/dashboard/quota" },
          { label: "Account", value: "→", href: "/dashboard/preferences/account" },
          { label: "Pricing", value: "→", href: "/pricing" },
        ],
      },
      {
        heading: "Related",
        items: [
          { label: "Timeline", value: "→", href: "/dashboard/timeline" },
          { label: "API explorer", value: "→", href: "/dashboard/api" },
        ],
      },
    ]}
  />
);

export default function Billing() {
  useSidePanel(BILLING_SIDE_PANEL);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-[590] text-foreground">Billing</h1>
      <SubscriptionSection />
      <MantineCard
        radius="md"
        withBorder
        shadow="xs"
        bg="var(--surface-1)"
        className="border-border"
      >
        <Text size="lg" fw={590} mb="md">
          Usage
        </Text>
        <Stack gap="md">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <Text size="sm" c="dimmed">
                Tiles
              </Text>
              <Text size="sm">Up to 50 cloud</Text>
            </div>
            <Progress value={0} size="sm" radius="xl" />
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <Text size="sm" c="dimmed">
                History
              </Text>
              <Text size="sm">30 days</Text>
            </div>
          </div>
        </Stack>
      </MantineCard>
    </div>
  );
}
