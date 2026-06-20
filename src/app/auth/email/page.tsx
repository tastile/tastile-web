import { MailCheck } from "lucide-react";
import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { authErrorMessage } from "@/lib/cognito/form";
import { safeOAuthRedirectUri, safePkceValue } from "@/lib/cognito/login-url";
import { AuthShell } from "../auth-shell";

export default async function EmailLoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    error?: string;
    notice?: string;
    redirect_uri?: string;
    state?: string;
    code_challenge?: string;
  }>;
}) {
  const params = await searchParams;
  const env = tryGetCognitoEnv();
  const message = authErrorMessage(params.error ?? params.notice ?? null);
  const email = typeof params.email === "string" ? params.email : "";
  const redirectUri = safeOAuthRedirectUri(params.redirect_uri ?? null, env?.callbackUrl ?? "");
  const state = safePkceValue(params.state ?? null);
  const codeChallenge = safePkceValue(params.code_challenge ?? null);
  const isDesktop = redirectUri === "tastile://auth/callback" && !!state;

  return (
    <AuthShell
      title="メールでログイン"
      subtitle="パスワードではなく、メールに届くワンタイムコードで Tastile にログインします。"
      message={message}
    >
      <form action="/auth/email/start" method="post" className="space-y-5">
        {isDesktop ? (
          <>
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            <input type="hidden" name="state" value={state} />
            {codeChallenge ? (
              <input type="hidden" name="code_challenge" value={codeChallenge} />
            ) : null}
          </>
        ) : null}
        <div>
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            メールアドレス
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={email}
            className="mt-2 w-full rounded-md bg-surface-0 px-3 py-3 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="you@example.com"
          />
        </div>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
        >
          <MailCheck className="h-4 w-4" aria-hidden="true" />
          ログインコードを送信
        </button>
      </form>
    </AuthShell>
  );
}
