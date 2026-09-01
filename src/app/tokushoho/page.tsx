import { getTranslation } from "@/shared/i18n/get-translation";
import {
  getFooterTranslations,
  getHeaderTranslations,
} from "@/shared/i18n/server-translations";
import { SiteFooter } from "@/shared/ui/SiteFooter";
import { SiteHeader } from "@/shared/ui/SiteHeader";

const PAGE_LOCALE = "en" as const;

export const metadata = {
  title: getTranslation(PAGE_LOCALE, "legal.tokushoho.metaTitle"),
  description: getTranslation(PAGE_LOCALE, "legal.tokushoho.metaDescription"),
};

export default function TokushohoPage() {
  const title = getTranslation(PAGE_LOCALE, "legal.tokushoho.title");
  const preamble = getTranslation(PAGE_LOCALE, "legal.tokushoho.preamble");
  const sellerLabel = getTranslation(PAGE_LOCALE, "legal.tokushoho.seller");
  const operatingManagerLabel = getTranslation(
    PAGE_LOCALE,
    "legal.tokushoho.operatingManager",
  );
  const operatorName = getTranslation(
    PAGE_LOCALE,
    "legal.tokushoho.operatorName",
  );
  const addressLabel = getTranslation(PAGE_LOCALE, "legal.tokushoho.address");
  const addressValue = getTranslation(
    PAGE_LOCALE,
    "legal.tokushoho.addressValue",
  );
  const phoneLabel = getTranslation(PAGE_LOCALE, "legal.tokushoho.phone");
  const phoneValue = getTranslation(PAGE_LOCALE, "legal.tokushoho.phoneValue");
  const emailLabel = getTranslation(PAGE_LOCALE, "legal.tokushoho.email");
  const emailValue = getTranslation(PAGE_LOCALE, "legal.tokushoho.emailValue");
  const priceLabel = getTranslation(PAGE_LOCALE, "legal.tokushoho.price");
  const priceValue = getTranslation(PAGE_LOCALE, "legal.tokushoho.priceValue");
  const otherChargesLabel = getTranslation(
    PAGE_LOCALE,
    "legal.tokushoho.otherCharges",
  );
  const otherChargesValue = getTranslation(
    PAGE_LOCALE,
    "legal.tokushoho.otherChargesValue",
  );
  const paymentMethodsLabel = getTranslation(
    PAGE_LOCALE,
    "legal.tokushoho.paymentMethods",
  );
  const paymentMethodsValue = getTranslation(
    PAGE_LOCALE,
    "legal.tokushoho.paymentMethodsValue",
  );
  const paymentTimingLabel = getTranslation(
    PAGE_LOCALE,
    "legal.tokushoho.paymentTiming",
  );
  const paymentTimingValue = getTranslation(
    PAGE_LOCALE,
    "legal.tokushoho.paymentTimingValue",
  );
  const serviceDeliveryLabel = getTranslation(
    PAGE_LOCALE,
    "legal.tokushoho.serviceDelivery",
  );
  const serviceDeliveryValue = getTranslation(
    PAGE_LOCALE,
    "legal.tokushoho.serviceDeliveryValue",
  );
  const returnsRefundsLabel = getTranslation(
    PAGE_LOCALE,
    "legal.tokushoho.returnsRefunds",
  );
  const returnsRefundsValue = getTranslation(
    PAGE_LOCALE,
    "legal.tokushoho.returnsRefundsValue",
  );
  const signupPeriodLabel = getTranslation(
    PAGE_LOCALE,
    "legal.tokushoho.signupPeriod",
  );
  const signupPeriodValue = getTranslation(
    PAGE_LOCALE,
    "legal.tokushoho.signupPeriodValue",
  );
  const systemRequirementsLabel = getTranslation(
    PAGE_LOCALE,
    "legal.tokushoho.systemRequirements",
  );
  const systemRequirementsValue = getTranslation(
    PAGE_LOCALE,
    "legal.tokushoho.systemRequirementsValue",
  );

  return (
    <div className="min-h-dvh bg-background flex flex-col">
      <SiteHeader translations={getHeaderTranslations(PAGE_LOCALE)} />
      <main className="flex-1">
        <div className="layout-shell max-w-3xl py-12">
          <h1 className="mb-8 text-3xl font-[510] tracking-[-0.02em] text-foreground">
            {title}
          </h1>

          <div className="prose dark:prose-invert max-w-none">
            <p className="mb-6 text-foreground-muted">{preamble}</p>

            <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <table className="w-full border-collapse text-sm">
                <tbody className="divide-y divide-border">
                  <tr>
                    <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                      {sellerLabel}
                    </th>
                    <td className="py-3 text-foreground-muted">
                      {operatorName}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                      {operatingManagerLabel}
                    </th>
                    <td className="py-3 text-foreground-muted">
                      {operatorName}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                      {addressLabel}
                    </th>
                    <td className="py-3 text-foreground-muted">
                      {addressValue}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                      {phoneLabel}
                    </th>
                    <td className="py-3 text-foreground-muted">{phoneValue}</td>
                  </tr>
                  <tr>
                    <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                      {emailLabel}
                    </th>
                    <td className="py-3 text-foreground-muted">{emailValue}</td>
                  </tr>
                  <tr>
                    <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                      {priceLabel}
                    </th>
                    <td className="py-3 text-foreground-muted">{priceValue}</td>
                  </tr>
                  <tr>
                    <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                      {otherChargesLabel}
                    </th>
                    <td className="py-3 text-foreground-muted">
                      {otherChargesValue}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                      {paymentMethodsLabel}
                    </th>
                    <td className="py-3 text-foreground-muted">
                      {paymentMethodsValue}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                      {paymentTimingLabel}
                    </th>
                    <td className="py-3 text-foreground-muted">
                      {paymentTimingValue}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                      {serviceDeliveryLabel}
                    </th>
                    <td className="py-3 text-foreground-muted">
                      {serviceDeliveryValue}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                      {returnsRefundsLabel}
                    </th>
                    <td className="py-3 text-foreground-muted">
                      {returnsRefundsValue}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                      {signupPeriodLabel}
                    </th>
                    <td className="py-3 text-foreground-muted">
                      {signupPeriodValue}
                    </td>
                  </tr>
                  <tr>
                    <th className="py-3 pr-4 text-left font-[590] text-foreground whitespace-nowrap">
                      {systemRequirementsLabel}
                    </th>
                    <td className="py-3 text-foreground-muted">
                      {systemRequirementsValue}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
      <SiteFooter
        translations={getFooterTranslations(PAGE_LOCALE)}
        locale={PAGE_LOCALE}
      />
    </div>
  );
}
