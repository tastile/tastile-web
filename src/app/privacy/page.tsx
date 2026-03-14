export const metadata = {
  title: "Privacy Policy — Tastile",
  description: "Tastile privacy policy and data handling practices.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 py-16">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-8">
          Privacy Policy
        </h1>
        
        <div className="prose dark:prose-invert max-w-none">
          <p className="text-zinc-600 dark:text-zinc-400 mb-6">
            Last updated: March 14, 2026
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-8 mb-4">
            What Data We Collect
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-zinc-600 dark:text-zinc-400">
            <li><strong>Account Information:</strong> Email address and authentication data from Google OAuth.</li>
            <li><strong>Tile Data:</strong> Titles, descriptions, and execution status of your tiles.</li>
            <li><strong>Event Data:</strong> Execution history including start times, completions, and breaks.</li>
            <li><strong>Usage Data:</strong> Basic analytics on feature usage to improve the service.</li>
          </ul>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-8 mb-4">
            How We Store Data
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            Your data is stored securely with Supabase, our database provider. 
            Local tiles are stored on your device only. Cloud tiles and events 
            are encrypted in transit and at rest.
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-8 mb-4">
            Third-Party Services
          </h2>
          <ul className="list-disc pl-6 space-y-2 text-zinc-600 dark:text-zinc-400">
            <li><strong>Supabase:</strong> Authentication and data storage.</li>
            <li><strong>Stripe:</strong> Payment processing for Pro subscriptions.</li>
            <li><strong>Google OAuth:</strong> Optional authentication method.</li>
          </ul>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-8 mb-4">
            Your Rights
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            You can request deletion of your account and all associated data at any time 
            by contacting us. Local data can be deleted by uninstalling the application.
          </p>

          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mt-8 mb-4">
            Contact
          </h2>
          <p className="text-zinc-600 dark:text-zinc-400">
            For privacy-related inquiries, please contact privacy@tastile.app
          </p>
        </div>
      </div>
    </div>
  );
}
