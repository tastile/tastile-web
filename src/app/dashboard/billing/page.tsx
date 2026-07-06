import { SubscriptionSection } from "@/components/account/SubscriptionSection";

export default function BillingPage() {
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
