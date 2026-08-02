import { Button } from "@mantine/core";

import { getFooterTranslations, getHeaderTranslations } from "@/shared/i18n/server-translations";
import { AuthShell } from "../auth-shell";

export default async function EmailPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    redirect_uri?: string;
    state?: string;
  }>;
}) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const redirectUri = typeof params.redirect_uri === "string" ? params.redirect_uri : "";
  const state = typeof params.state === "string" ? params.state : "";

  return (
    <AuthShell
      title="Sign in with email"
      subtitle="Enter your email address. We will send a password or verification code."
      message={error ? decodeURIComponent(error) : null}
      headerTranslations={getHeaderTranslations("en")}
      footerTranslations={getFooterTranslations("en")}
    >
      <form action="/auth/email/start" method="post" className="space-y-5">
        {redirectUri ? <input type="hidden" name="redirect_uri" value={redirectUri} /> : null}
        {state ? <input type="hidden" name="state" value={state} /> : null}
        <div>
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="mt-2 w-full rounded-md border border-border bg-surface-0 px-3 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            placeholder="you@example.com"
          />
        </div>
        <Button type="submit" className="w-full">
          Continue
        </Button>
      </form>
    </AuthShell>
  );
}
