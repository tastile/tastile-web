import { getFooterTranslations, getHeaderTranslations } from "@/shared/i18n/server-translations";
import { Button } from "@mantine/core";
import { AuthShell } from "../../auth-shell";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    error?: string;
  }>;
}) {
  const params = await searchParams;
  const email = typeof params.email === "string" ? params.email : "";
  const error = typeof params.error === "string" ? params.error : null;

  return (
    <AuthShell
      title="Enter your verification code"
      subtitle="Enter the verification code we sent to your email."
      message={error ? decodeURIComponent(error) : null}
      headerTranslations={getHeaderTranslations("en")}
      footerTranslations={getFooterTranslations("en")}
    >
      <form action="/auth/email/confirm" method="post" className="space-y-5">
        <input type="hidden" name="email" value={email} />
        <div>
          <label htmlFor="code" className="text-sm font-medium text-foreground">
            Verification code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]{6}"
            required
            className="mt-2 w-full rounded-md border border-border bg-surface-0 px-3 py-3 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30"
            placeholder="6-digit code"
          />
        </div>
        <Button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
        >
          Verify
        </Button>
      </form>
    </AuthShell>
  );
}
