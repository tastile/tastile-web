import { getFooterTranslations, getHeaderTranslations } from "@/shared/i18n/server-translations";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { SiteHeader } from "@/shared/ui/SiteHeader";

export const metadata = {
  title: "Privacy Policy — Tastile",
  description: "Tastile privacy policy and data handling practices.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <SiteHeader showFeatureLink translations={getHeaderTranslations("ja")} />
      <main className="flex-1">
        <div className="layout-shell max-w-3xl py-12">
          <h1 className="mb-8 text-3xl font-[510] tracking-[-0.02em] text-foreground">
            Privacy Policy
          </h1>

          <div className="prose dark:prose-invert max-w-none">
            <p className="mb-6 text-foreground-muted">Last updated: March 14, 2026</p>

            <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">What Data We Collect</h2>
            <ul className="list-disc space-y-2 pl-6 text-foreground-muted">
              <li>
                <strong>Account Information:</strong> Email address and authentication data from
                Amazon Cognito and any configured federated identity provider.
              </li>
              <li>
                <strong>Tile Data:</strong> Titles, descriptions, and execution status of your
                tiles.
              </li>
              <li>
                <strong>Event Data:</strong> Execution history including start times, completions,
                and breaks.
              </li>
              <li>
                <strong>Usage Data:</strong> Basic analytics on feature usage to improve the
                service.
              </li>
            </ul>

            <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">How We Store Data</h2>
            <p className="text-foreground-muted">
              Your cloud data is stored securely on Tastile-managed AWS infrastructure. Local tiles
              are stored on your device only. Cloud tiles and events are encrypted in transit and at
              rest.
            </p>

            <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">Third-Party Services</h2>
            <ul className="list-disc space-y-2 pl-6 text-foreground-muted">
              <li>
                <strong>Amazon Cognito:</strong> Account registration and authentication.
              </li>
              <li>
                <strong>AWS:</strong> Application hosting, storage, and database infrastructure.
              </li>
              <li>
                <strong>Stripe:</strong> Payment processing for Pro subscriptions.
              </li>
              <li>
                <strong>Federated identity providers:</strong> Optional authentication methods when
                enabled.
              </li>
            </ul>

            <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">Your Rights</h2>
            <p className="text-foreground-muted">
              You can request deletion of your account and all associated data at any time by
              contacting us. Local data can be deleted by uninstalling the application.
            </p>

            <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">Contact</h2>
            <p className="text-foreground-muted">
              For privacy-related inquiries, please contact privacy@tastile.app
            </p>
          </div>
        </div>
      </main>
      <SiteFooter translations={getFooterTranslations("ja")} />
    </div>
  );
}
