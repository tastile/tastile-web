import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata = {
  title: "Terms of Service — Tastile",
  description: "Tastile terms of service and usage agreement.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader showFeatureLink />
      <main className="flex-1">
      <div className="layout-shell max-w-3xl py-12">
        <h1 className="mb-8 text-3xl font-[510] tracking-[-0.02em] text-foreground">
          Terms of Service
        </h1>
        
        <div className="prose dark:prose-invert max-w-none">
          <p className="mb-6 text-foreground-muted">
            Last updated: March 14, 2026
          </p>

          <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">
            1. Account Terms
          </h2>
          <p className="text-foreground-muted">
            You must be 13 years or older to use Tastile. You are responsible for maintaining 
            the security of your account and for all activities that occur under your account.
          </p>

          <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">
            2. Acceptable Use
          </h2>
          <p className="text-foreground-muted">
            You agree not to use Tastile for any unlawful purpose or to transmit any material 
            that violates any laws or regulations. You may not attempt to gain unauthorized 
            access to any portion of the service.
          </p>

          <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">
            3. Billing and Refunds
          </h2>
          <p className="text-foreground-muted">
            Pro subscriptions are billed monthly through Stripe. You may cancel at any time. 
            Refunds are provided at our discretion for technical issues or service unavailability.
          </p>

          <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">
            4. Limitation of Liability
          </h2>
          <p className="text-foreground-muted">
            Tastile is provided &quot;as is&quot; without warranties of any kind. We are not liable 
            for any indirect, incidental, or consequential damages arising from your use of the service.
          </p>

          <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">
            5. Termination
          </h2>
          <p className="text-foreground-muted">
            We reserve the right to suspend or terminate your account for violations of these terms. 
            You may delete your account at any time from the settings page.
          </p>

          <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">
            6. Changes to Terms
          </h2>
          <p className="text-foreground-muted">
            We may update these terms from time to time. Continued use of Tastile after changes 
            constitutes acceptance of the new terms.
          </p>

          <h2 className="mt-8 mb-4 text-xl font-[590] text-foreground">
            Contact
          </h2>
          <p className="text-foreground-muted">
            For questions about these terms, please contact legal@tastile.app
          </p>
        </div>
      </div>
      </main>
      <SiteFooter />
    </div>
  );
}
