import { MailPlus } from "lucide-react";
import Link from "next/link";
import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { authErrorMessage } from "@/lib/cognito/form";
import { safeOAuthRedirectUri, safePkceValue } from "@/lib/cognito/login-url";
import { AuthShell } from "../auth-shell";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; redirect_uri?: string; state?: string }>;
}) {
  const params = await searchParams;
  const env = tryGetCognitoEnv();
  const message = authErrorMessage(params.error ?? null);
  const redirectUri = safeOAuthRedirectUri(params.redirect_uri ?? null, env?.callbackUrl ?? "");
  const state = safePkceValue(params.state ?? null);
  const isNative = redirectUri === "tastile://auth/callback" && !!state;

  return (
    <AuthShell
      title="アカウントを作成"
      subtitle="メールアドレスだけで登録します。パスワードを作らず、確認コードと passkey / email OTP を使う認証経路にします。"
      message={message}
    >
      <form action="/auth/email/signup" method="post" className="space-y-5">
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
            className="mt-2 w-full rounded-md bg-surface-0 px-3 py-3 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="you@example.com"
          />
        </div>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
        >
          <MailPlus className="h-4 w-4" aria-hidden="true" />
          確認コードを送信
        </button>
      </form>
      <p className="mt-5 text-sm text-foreground-muted">
        すでにコードを持っている場合は{" "}
        <Link
          className="underline hover:text-foreground"
          href={`/auth/confirm${isNative ? `?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}` : ""}`}
        >
          確認画面
        </Link>{" "}
        を開いてください。
      </p>
    </AuthShell>
  );
}
