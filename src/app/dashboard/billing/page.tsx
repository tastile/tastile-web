export default function BillingPage() {
  // The plan previously lived in the Supabase `profiles` table. After the
  // Supabase → Cognito migration, no plan source is wired yet; default to
  // `free` so the page still renders. The Stripe portal is reachable from
  // `/pricing` for pro users who navigate to it directly.
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-[590] text-foreground">Billing</h1>

      {/* Current Plan */}
      <div className="rounded-xl border border-border bg-surface-elevated p-6">
        <h2 className="mb-4 text-lg font-[590] text-foreground">Current Plan</h2>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-[590] capitalize text-foreground">free</p>
            <p className="text-foreground-muted">Free forever</p>
          </div>
          <div className="px-3 py-1 rounded-full text-sm font-medium bg-surface-2 text-foreground-muted">
            Free
          </div>
        </div>
      </div>

      {/* Usage */}
      <div className="rounded-xl border border-border bg-surface-elevated p-6">
        <h2 className="mb-4 text-lg font-[590] text-foreground">Usage</h2>
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-1">
              <span className="text-foreground-muted">Tiles</span>
              <span className="text-foreground">Up to 50 cloud</span>
            </div>
            <div className="h-2 rounded-full bg-surface-2">
              <div className="h-2 rounded-full bg-primary" style={{ width: '0%' }} />
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

      {/* Upgrade (free) */}
      <div className="rounded-xl border border-border bg-surface-elevated p-6">
        <h2 className="mb-4 text-lg font-[590] text-foreground">Upgrade</h2>
        <p className="mb-4 text-foreground-muted">
          Upgrade to Pro for more tiles, longer history, and desktop sync.
        </p>
        <a
          href="/pricing"
          className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover"
        >
          View Plans
        </a>
      </div>
    </div>
  )
}
