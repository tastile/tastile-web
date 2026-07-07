/**
 * Integrations dashboard page.
 *
 * The v1 product truth does not include Google Calendar sync — see
 * `docs/agent-handoff/PROJECT-TRUTH.md`. The legacy `/auth/integrations/*`
 * and `/sync/trigger` paths were removed in the v1-only migration, so the
 * daemon-backed loader that previously lived here would only ever emit
 * 404 / 410 responses. Render an explicit notice instead of pretending to
 * load anything.
 */
export default function IntegrationsPage() {
  return (
    <div className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-[590] text-foreground">Integrations</h1>
        <p className="mt-2 text-foreground-muted">Manage Google Calendar connections and sync.</p>
      </div>

      <div className="rounded-xl bg-surface-elevated p-5">
        <h2 className="text-lg font-semibold">Google Calendar</h2>
        <p className="mt-2 text-sm text-foreground-muted">
          This integration is outside the current Tastile v1 scope.
        </p>
        <p className="mt-1 text-sm text-foreground-muted">
          Until v2, do not expect the dashboard to load or sync any integration state. See
          <code className="mx-1 rounded bg-surface-1 px-1.5 py-0.5 text-xs">
            docs/agent-handoff/PROJECT-TRUTH.md
          </code>
          for the current scope.
        </p>
      </div>
    </div>
  );
}
