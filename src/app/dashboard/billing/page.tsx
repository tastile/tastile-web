"use client";

import { SubscriptionSection } from "@/components/account/SubscriptionSection";
import { PageSummaryPanel } from "@/components/panels/PageSummaryPanel";
import { useSidePanel } from "@/lib/context/side-panel-context";

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

export default function BillingPage() {
  useSidePanel(BILLING_SIDE_PANEL);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-[590] text-foreground">Billing</h1>
      <SubscriptionSection />
      <div className="rounded-xl bg-surface-elevated p-6">
        <h2 className="mb-4 text-lg font-[590] text-foreground">Usage</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-foreground-muted">Tiles</span>
              <span className="text-foreground">Up to 50 cloud</span>
            </div>
            <div className="h-2 rounded-full bg-surface-2">
              <div className="h-2 rounded-full bg-primary" style={{ width: "0%" }} />
            </div>
          </div>
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-foreground-muted">History</span>
              <span className="text-foreground">30 days</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
