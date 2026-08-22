import { getTranslation } from "@/shared/i18n/get-translation";
import { getFooterTranslations, getHeaderTranslations } from "@/shared/i18n/server-translations";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { SiteHeader } from "@/shared/ui/SiteHeader";

const PAGE_LOCALE = "en" as const;

export const metadata = {
  title: getTranslation(PAGE_LOCALE, "legal.terms.metaTitle"),
  description: getTranslation(PAGE_LOCALE, "legal.terms.metaDescription"),
};

export default function TermsPage() {
  const title = getTranslation(PAGE_LOCALE, "legal.terms.title");
  const lastUpdated = getTranslation(PAGE_LOCALE, "legal.terms.lastUpdated");
  const section1Heading = getTranslation(PAGE_LOCALE, "legal.terms.section1Heading");
  const section2Heading = getTranslation(PAGE_LOCALE, "legal.terms.section2Heading");
  const section3Heading = getTranslation(PAGE_LOCALE, "legal.terms.section3Heading");
  const section4Heading = getTranslation(PAGE_LOCALE, "legal.terms.section4Heading");
  const section5Heading = getTranslation(PAGE_LOCALE, "legal.terms.section5Heading");
  const section6Heading = getTranslation(PAGE_LOCALE, "legal.terms.section6Heading");
  const contactHeading = getTranslation(PAGE_LOCALE, "legal.terms.contactHeading");
  const contactBody = getTranslation(PAGE_LOCALE, "legal.terms.contactBody");

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <SiteHeader translations={getHeaderTranslations(PAGE_LOCALE)} />
      <main className="flex-1">
        <div className="layout-shell max-w-3xl py-12">
          <h1 className="mb-8 text-3xl font-[510] tracking-[-0.02em] text-foreground">{title}</h1>

          <div className="prose dark:prose-invert max-w-none">
            <p className="mb-6 text-foreground-muted">{lastUpdated}</p>

            <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">{section1Heading}</h2>
            <p className="text-foreground-muted">
              You must be 13 years or older to use Tastile. You are responsible for maintaining the
              security of your account and for all activities that occur under your account.
            </p>

            <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">{section2Heading}</h2>
            <p className="text-foreground-muted">
              You agree not to use Tastile for any unlawful purpose or to transmit any material that
              violates any laws or regulations. You may not attempt to gain unauthorized access to
              any portion of the service.
            </p>

            <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">{section3Heading}</h2>
            <p className="text-foreground-muted">
              Pro subscriptions are billed monthly through Stripe. You may cancel at any time.
              Refunds are provided at our discretion for technical issues or service unavailability.
            </p>

            <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">{section4Heading}</h2>
            <p className="text-foreground-muted">
              Tastile is provided &quot;as is&quot; without warranties of any kind. We are not
              liable for any indirect, incidental, or consequential damages arising from your use of
              the service.
            </p>

            <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">{section5Heading}</h2>
            <p className="text-foreground-muted">
              We reserve the right to suspend or terminate your account for violations of these
              terms. You may delete your account at any time from the settings page.
            </p>

            <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">{section6Heading}</h2>
            <p className="text-foreground-muted">
              We may update these terms from time to time. Continued use of Tastile after changes
              constitutes acceptance of the new terms.
            </p>

            <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">{contactHeading}</h2>
            <p className="text-foreground-muted">{contactBody}</p>
          </div>
        </div>
      </main>
      <SiteFooter translations={getFooterTranslations(PAGE_LOCALE)} />
    </div>
  );
}
