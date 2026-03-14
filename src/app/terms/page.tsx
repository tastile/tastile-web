export const metadata = {
  title: "Terms of Service — Tastile",
  description: "Tastile terms of service and usage agreement.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">
          Terms of Service
        </h1>
        
        <div className="prose dark:prose-invert max-w-none">
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Last updated: March 14, 2026
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-8 mb-4">
            1. Account Terms
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            You must be 13 years or older to use Tastile. You are responsible for maintaining 
            the security of your account and for all activities that occur under your account.
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-8 mb-4">
            2. Acceptable Use
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            You agree not to use Tastile for any unlawful purpose or to transmit any material 
            that violates any laws or regulations. You may not attempt to gain unauthorized 
            access to any portion of the service.
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-8 mb-4">
            3. Billing and Refunds
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Pro subscriptions are billed monthly through Stripe. You may cancel at any time. 
            Refunds are provided at our discretion for technical issues or service unavailability.
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-8 mb-4">
            4. Limitation of Liability
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Tastile is provided &quot;as is&quot; without warranties of any kind. We are not liable 
            for any indirect, incidental, or consequential damages arising from your use of the service.
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-8 mb-4">
            5. Termination
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            We reserve the right to suspend or terminate your account for violations of these terms. 
            You may delete your account at any time from the settings page.
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-8 mb-4">
            6. Changes to Terms
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            We may update these terms from time to time. Continued use of Tastile after changes 
            constitutes acceptance of the new terms.
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-8 mb-4">
            Contact
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            For questions about these terms, please contact legal@tastile.app
          </p>
        </div>
      </div>
    </div>
  );
}
