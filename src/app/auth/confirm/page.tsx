import { BadgeCheck, RefreshCcw } from "lucide-react";
import Link from "next/link";
import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { authErrorMessage } from "@/lib/cognito/form";
import { safeOAuthRedirectUri, safePkceValue } from "@/lib/cognito/login-url";
import { AuthShell } from "../auth-shell";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    error?: string;
    notice?: string;
    redirect_uri?: string;
    state?: string;
  }>;
}) {
  const params = await searchParams;
  const env = tryGetCognitoEnv();
  const message = authErrorMessage(params.error ?? params.notice ?? null);
  const email = typeof params.email === "string" ? params.email : "";
  const redirectUri = safeOAuthRedirectUri(params.redirect_uri ?? null, env?.callbackUrl ?? "");
  const state = safePkceValue(params.state ?? null);
  const isNative = redirectUri === "tastile://auth/callback" && !!state;

  return (
    <AuthShell
      title="メールを確認"
      subtitle="届いた 6 桁の確認コードを入力してください。届いていない場合は、この画面から再送できます。"
      message={message}
    >
      <form action="/auth/email/confirm" method="post" className="space-y-5">
        {isNative ? (
          <>
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            <input type="hidden" name="state" value={state} />
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
          />
        </div>
        <div>
          <label htmlFor="code" className="text-sm font-medium text-foreground">
            確認コード
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
          <BadgeCheck className="h-4 w-4" aria-hidden="true" />
          アカウントを確認
        </button>
      </form>
      <form action="/auth/email/resend" method="post" className="mt-3">
        <input type="hidden" name="email" value={email} />
        {isNative ? (
          <>
            <input type="hidden" name="redirect_uri" value={redirectUri} />
            <input type="hidden" name="state" value={state} />
          </>
        ) : null}
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-md bg-surface-1 px-4 py-3 text-sm font-medium text-foreground hover:bg-surface-2"
        >
          <RefreshCcw className="h-4 w-4" aria-hidden="true" />
          確認コードを再送
        </button>
      </form>
      <p className="mt-5 text-sm text-foreground-muted">
        確認済みの場合は{" "}
        <Link
          className="underline hover:text-foreground"
          href={`/auth/email${isNative ? `?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}` : ""}`}
        >
          メール OTP ログイン
        </Link>{" "}
        に進んでください。
      </p>
    </AuthShell>
  );
}
