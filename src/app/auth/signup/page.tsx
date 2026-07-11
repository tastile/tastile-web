import { UserPlus } from "lucide-react";
import Link from "next/link";
import { tryGetCognitoEnv } from "@/lib/cognito/env";
import { authErrorMessage } from "@/lib/cognito/form";
import { safeOAuthRedirectUri, safePkceValue } from "@/lib/cognito/login-url";
import { getFooterTranslations, getHeaderTranslations } from "@/lib/i18n/server-translations";
import { AuthShell } from "../auth-shell";

export default async function SignupPage({
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
  const isNative = redirectUri === "tastile://auth/callback" && !!state;

  return (
    <AuthShell
      title="アカウントを作成"
      subtitle="メールアドレスとパスワード (12 文字以上) を設定してください。"
      message={message}
      headerTranslations={getHeaderTranslations("ja")}
      footerTranslations={getFooterTranslations("ja")}
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
            defaultValue={email}
            className="mt-2 w-full rounded-md bg-surface-0 px-3 py-3 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="you@example.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            パスワード
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            minLength={12}
            className="mt-2 w-full rounded-md bg-surface-0 px-3 py-3 text-foreground outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="12 文字以上、大文字小文字数字を含む"
          />
        </div>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-3 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
        >
          <UserPlus className="h-4 w-4" aria-hidden="true" />
          確認コードを送信
        </button>
      </form>
      <p className="mt-5 text-sm text-foreground-muted">
        すでにアカウントがある場合は{" "}
        <Link
          className="underline hover:text-foreground"
          href={`/auth/email${isNative ? `?redirect_uri=${encodeURIComponent(redirectUri)}&state=${encodeURIComponent(state)}` : ""}`}
        >
          ログイン
        </Link>{" "}
        へ。
      </p>
    </AuthShell>
  );
}
