import { LogIn } from "lucide-react";
import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { authErrorMessage } from "@/lib/cognito/form";
import { safeOAuthRedirectUri, safePkceValue } from "@/lib/cognito/login-url";
import { AuthShell } from "../../auth-shell";

export default async function EmailVerifyPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    error?: string;
    redirect_uri?: string;
    state?: string;
  }>;
}) {
  const params = await searchParams;
  const env = tryGetCognitoEnv();
  const message = authErrorMessage(params.error ?? null);
  const email = typeof params.email === "string" ? params.email : "";
  const redirectUri = safeOAuthRedirectUri(params.redirect_uri ?? null, env?.callbackUrl ?? "");
  const state = safePkceValue(params.state ?? null);
  const isDesktop = redirectUri === "tastile://auth/callback" && !!state;

  return (
    <AuthShell
      title="コードを入力"
      subtitle="メールに届いたログインコードを入力してください。コードは短時間で期限切れになります。"
      message={message}
    >
      <form action="/auth/email/complete" method="post" className="space-y-5">
        <input type="hidden" name="email" value={email} />
        {isDesktop ? (
          <>
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            <input type="hidden" name="state" value={state} />
          </>
        ) : null}
        <div>
          <label htmlFor="code" className="text-sm font-medium text-foreground">
            ログインコード
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            className="mt-2 w-full rounded-md bg-surface-0 px-3 py-3 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="123456"
          />
        </div>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
        >
          <LogIn className="h-4 w-4" aria-hidden="true" />
          Tastile に入る
        </button>
      </form>
    </AuthShell>
  );
}
