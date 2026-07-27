import { Button } from "@mantine/core";
import { Apple, Fingerprint, Globe } from "lucide-react";
import Link from "next/link";
import { TastileLogo } from "@/components/TastileLogo";
import {
  getConfiguredCognitoIdentityProviders,
  parseCognitoPlatform,
} from "@/lib/cognito/login-url";

const ERROR_MESSAGES: Record<string, string> = {
  no_session: "Sign-in is required.",
  session_expired: "Your session has expired. Please sign in again.",
  missing_code: "Authentication code not found. Please try again.",
  state_mismatch: "Could not verify the authentication state. Please try again.",
  auth_failed: "Authentication failed. Please try again.",
  cognito_not_configured:
    "The authentication service is misconfigured. Please contact an administrator.",
  unsupported_provider: "This sign-in method is not enabled yet.",
  provider_not_configured:
    "This sign-in method is not enabled yet. Continue with passkey or email.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    redirect_uri?: string;
    state?: string;
    code_challenge?: string;
    platform?: string;
  }>;
}) {
  const params = await searchParams;
  const errorKey = typeof params?.error === "string" ? params.error : null;
  const errorMessage = errorKey
    ? (ERROR_MESSAGES[errorKey] ?? `Sign-in failed: ${errorKey}`)
    : null;
  const configuredProviders = getConfiguredCognitoIdentityProviders();
  const googleEnabled = configuredProviders.has("Google");
  const appleEnabled = configuredProviders.has("SignInWithApple");
  const platform = parseCognitoPlatform(
    typeof params?.platform === "string" ? params.platform : null,
  );
  const desktopQuery = new URLSearchParams();
  if (typeof params?.redirect_uri === "string")
    desktopQuery.set("redirect_uri", params.redirect_uri);
  if (typeof params?.state === "string") desktopQuery.set("state", params.state);
  if (typeof params?.code_challenge === "string")
    desktopQuery.set("code_challenge", params.code_challenge);
  if (platform !== "web") desktopQuery.set("platform", platform);
  const desktopSuffix = desktopQuery.size > 0 ? `&${desktopQuery.toString()}` : "";
  const desktopPageSuffix = desktopQuery.size > 0 ? `?${desktopQuery.toString()}` : "";

  return (
    <div className="min-h-svh bg-background font-[family-name:var(--font-jp)]">
      <main className="flex min-h-svh w-full flex-col items-center justify-center px-4 py-4">
        <section
          data-testid="login-panel"
          className="mt-6 w-full max-w-sm rounded-xl bg-surface-elevated p-5 sm:p-6"
        >
          <div className="flex min-h-12 items-center justify-center gap-2 text-foreground">
            <TastileLogo size={36} />
            <span className="text-lg font-semibold leading-none tracking-tight">tastile</span>
            <h1 className="font-[family-name:var(--font-jp-heading)] text-xl font-semibold leading-none text-foreground">
              Sign in
            </h1>
          </div>

          {errorMessage ? (
            <div
              role="alert"
              className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm leading-5 text-danger"
            >
              {errorMessage}
            </div>
          ) : null}

          <div className="my-2 space-y-2">
            {googleEnabled ? (
              <Button
                component="a"
                href={`/auth/cognito/login?provider=Google${desktopSuffix}`}
                leftSection={<Globe className="h-4 w-4" aria-hidden="true" />}
                fullWidth
              >
                Continue with Google
              </Button>
            ) : null}
            {appleEnabled ? (
              <Button
                component="a"
                href={`/auth/cognito/login?provider=SignInWithApple${desktopSuffix}`}
                leftSection={<Apple className="h-4 w-4" aria-hidden="true" />}
                fullWidth
              >
                Continue with Apple
              </Button>
            ) : null}
            <Button
              component="a"
              href={`/auth/email${desktopPageSuffix}`}
              leftSection={<Fingerprint className="h-4 w-4" aria-hidden="true" />}
              fullWidth
            >
              Continue with passkey or email
            </Button>
          </div>
          <hr className="mx-1 opacity-20" />
          <Button
            component="a"
            href={`/auth/signup${desktopPageSuffix}`}
            fullWidth
            className="my-2"
            variant="outline"
          >
            Create account
          </Button>
          <section className="mx-4 text-center text-sm leading-5 text-foreground-subtle">
            <p className="text-center text-[11px] leading-4 text-foreground-subtle">
              By continuing, you agree to our{" "}
              <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
                Privacy Policy
              </Link>
              .
            </p>
          </section>
        </section>
      </main>
    </div>
  );
}
