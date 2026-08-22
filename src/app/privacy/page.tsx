import { getTranslation } from "@/shared/i18n/get-translation";
import { getFooterTranslations, getHeaderTranslations } from "@/shared/i18n/server-translations";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { SiteHeader } from "@/shared/ui/SiteHeader";

const PAGE_LOCALE = "en" as const;

export const metadata = {
  title: getTranslation(PAGE_LOCALE, "legal.privacy.metaTitle"),
  description: getTranslation(PAGE_LOCALE, "legal.privacy.metaDescription"),
};

export default function PrivacyPage() {
  const title = getTranslation(PAGE_LOCALE, "legal.privacy.title");
  const lastUpdated = getTranslation(PAGE_LOCALE, "legal.privacy.lastUpdated");
  const dataHeading = getTranslation(PAGE_LOCALE, "legal.privacy.dataHeading");
  const storeHeading = getTranslation(PAGE_LOCALE, "legal.privacy.storeHeading");
  const thirdPartyHeading = getTranslation(PAGE_LOCALE, "legal.privacy.thirdPartyHeading");
  const rightsHeading = getTranslation(PAGE_LOCALE, "legal.privacy.rightsHeading");
  const contactHeading = getTranslation(PAGE_LOCALE, "legal.privacy.contactHeading");
  const contactBody = getTranslation(PAGE_LOCALE, "legal.privacy.contactBody");

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <SiteHeader translations={getHeaderTranslations(PAGE_LOCALE)} />
      <main className="flex-1">
        <div className="layout-shell max-w-3xl py-12">
          <h1 className="mb-8 text-3xl font-[510] tracking-[-0.02em] text-foreground">{title}</h1>

          <div className="prose dark:prose-invert max-w-none">
            <p className="mb-6 text-foreground-muted">{lastUpdated}</p>

            <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">{dataHeading}</h2>
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

            <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">{storeHeading}</h2>
            <p className="text-foreground-muted">
              Your cloud data is stored securely on Tastile-managed AWS infrastructure. Local tiles
              are stored on your device only. Cloud tiles and events are encrypted in transit and at
              rest.
            </p>

            <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">{thirdPartyHeading}</h2>
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

            <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">{rightsHeading}</h2>
            <p className="text-foreground-muted">
              You can request deletion of your account and all associated data at any time by
              contacting us. Local data can be deleted by uninstalling the application.
            </p>

            <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">{contactHeading}</h2>
            <p className="text-foreground-muted">{contactBody}</p>
          </div>
        </div>
      </main>
      <SiteFooter translations={getFooterTranslations(PAGE_LOCALE)} locale={PAGE_LOCALE}/>
    </div>
  );
}
