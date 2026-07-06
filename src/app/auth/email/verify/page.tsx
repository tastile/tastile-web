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
    mode?: string;
    error?: string;
    redirect_uri?: string;
    state?: string;
    code_challenge?: string;
  }>;
}) {
  const params = await searchParams;
  const env = tryGetCognitoEnv();
  const message = authErrorMessage(params.error ?? null);
  const email = typeof params.email === "string" ? params.email : "";
  const mode = params.mode === "software_token_mfa" ? "software_token_mfa" : "email_otp";
  const redirectUri = safeOAuthRedirectUri(params.redirect_uri ?? null, env?.callbackUrl ?? "");
  const state = safePkceValue(params.state ?? null);
  const codeChallenge = safePkceValue(params.code_challenge ?? null);
  const isDesktop = redirectUri === "tastile://auth/callback" && !!state;

  return (
    <AuthShell
      title={mode === "software_token_mfa" ? "認証アプリのコード" : "コードを入力"}
      subtitle={
        mode === "software_token_mfa"
          ? "認証アプリに表示されている 6 桁のコードを入力してください。"
          : "メールに届いたログインコードを入力してください。コードは短時間で期限切れになります。"
      }
      message={message}
    >
      <form action="/auth/email/complete" method="post" className="space-y-5">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="mode" value={mode} />
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
          <label htmlFor="code" className="text-sm font-medium text-foreground">
            {mode === "software_token_mfa" ? "認証アプリのコード" : "ログインコード"}
          </label>
          <input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            pattern="[0-9]{6}"
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
