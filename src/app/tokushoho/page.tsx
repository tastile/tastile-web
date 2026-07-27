import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getFooterTranslations, getHeaderTranslations } from "@/lib/i18n/server-translations";

export const metadata = {
  title: "Commercial Disclosure (Tokushoho) - Tastile",
  description: "Disclosed under Article 11 of the Act on Specified Commercial Transactions.",
};

export default function TokushohoPage() {
  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <SiteHeader showFeatureLink translations={getHeaderTranslations("en")} />
      <main className="flex-1">
        <div className="layout-shell max-w-3xl py-12">
          <h1 className="mb-8 text-3xl font-[510] tracking-[-0.02em] text-foreground">
            Commercial Disclosure (Tokushoho)
          </h1>

          <div className="prose dark:prose-invert max-w-none">
            <p className="mb-6 text-foreground-muted">
              Disclosed in accordance with Article 11 of the Act on Specified Commercial
              Transactions.
            </p>

            <table className="w-full border-collapse text-sm">
              <tbody>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    Seller
                  </th>
                  <td className="py-3 text-foreground-muted">Yusuke Kimura</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    Operating Manager
                  </th>
                  <td className="py-3 text-foreground-muted">Yusuke Kimura</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    Address
                  </th>
                  <td className="py-3 text-foreground-muted">Disclosed promptly upon request.</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    Phone
                  </th>
                  <td className="py-3 text-foreground-muted">Disclosed promptly upon request.</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    Email
                  </th>
                  <td className="py-3 text-foreground-muted">support@tastile.app</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    Price
                  </th>
                  <td className="py-3 text-foreground-muted">
                    Amounts listed on each plan page (tax included).
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    Other charges
                  </th>
                  <td className="py-3 text-foreground-muted">None</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    Payment methods
                  </th>
                  <td className="py-3 text-foreground-muted">Credit card, Apple Pay, Google Pay</td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    Payment timing
                  </th>
                  <td className="py-3 text-foreground-muted">
                    Credit card payments are processed immediately.
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    Service delivery
                  </th>
                  <td className="py-3 text-foreground-muted">
                    The service is available immediately after payment is confirmed.
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    Returns & refunds
                  </th>
                  <td className="py-3 text-foreground-muted">
                    Due to the nature of digital content, returns and refunds are not accepted for
                    customer convenience. If there is a technical issue with the service, please
                    contact support@tastile.app. We will investigate and respond accordingly.
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    Sign-up period
                  </th>
                  <td className="py-3 text-foreground-muted">
                    No particular restriction. The service can be used continuously.
                  </td>
                </tr>
                <tr className="border-b border-border">
                  <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                    System requirements
                  </th>
                  <td className="py-3 text-foreground-muted">
                    An internet connection is required. Recommended browsers: Google Chrome, Safari,
                    Firefox, Microsoft Edge. Mobile: latest iOS / Android.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </main>
      <SiteFooter translations={getFooterTranslations("en")} />
    </div>
  );
}
