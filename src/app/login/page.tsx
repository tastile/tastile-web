import { Apple, Chrome, Fingerprint, KeyRound, Laptop, MailCheck, Smartphone } from "lucide-react";
import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { TastileLogo } from "@/components/TastileLogo";
import {
  getConfiguredCognitoIdentityProviders,
  parseCognitoPlatform,
} from "@/lib/cognito/login-url";

const ERROR_MESSAGES: Record<string, string> = {
  no_session: "サインインが必要です。",
  session_expired: "セッションが切れました。もう一度サインインしてください。",
  missing_code: "認証コードが見つかりませんでした。もう一度お試しください。",
  state_mismatch: "認証状態の確認に失敗しました。もう一度お試しください。",
  auth_failed: "認証に失敗しました。もう一度お試しください。",
  cognito_not_configured: "Cognito が設定されていません。管理者にご連絡ください。",
  unsupported_provider: "このログイン方法はまだ有効化されていません。",
  provider_not_configured:
    "このログイン方法は Cognito 側の設定が未完了です。Passkey / メールで続行してください。",
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
    ? (ERROR_MESSAGES[errorKey] ?? `サインインに失敗しました: ${errorKey}`)
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
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader hideAuth />

      <main className="layout-shell grid flex-1 items-center gap-8 py-12 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="space-y-8">
          <div className="space-y-5">
            <div className="flex items-center gap-4">
              <TastileLogo size={64} className="text-foreground" />
              <div>
                <p className="text-sm font-medium text-primary">Tastile Account</p>
                <h1 className="mt-1 text-4xl font-semibold text-foreground sm:text-5xl">
                  実行制御を、すぐ始める
                </h1>
              </div>
            </div>
            <p className="max-w-2xl text-lg leading-8 text-foreground-muted">
              Web、Windows、Android で同じ Cognito アカウントを使います。Passkey 対応の Hosted UI
              で登録し、Tastile API はパスワードのみのトークンを受け付けません。
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg bg-surface-1 p-4">
              <Fingerprint className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-foreground">Passkey ready</p>
              <p className="mt-1 text-sm text-foreground-subtle">
                対応端末では生体認証やセキュリティキーを使えます。
              </p>
            </div>
            <div className="rounded-lg bg-surface-1 p-4">
              <Laptop className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-foreground">Desktop</p>
              <p className="mt-1 text-sm text-foreground-subtle">
                Windows アプリはブラウザ認証後に戻ります。
              </p>
            </div>
            <div className="rounded-lg bg-surface-1 p-4">
              <Smartphone className="h-5 w-5 text-primary" aria-hidden="true" />
              <p className="mt-3 text-sm font-medium text-foreground">Android</p>
              <p className="mt-1 text-sm text-foreground-subtle">
                Android も同じ Hosted UI callback を使います。
              </p>
            </div>
          </div>
        </section>

        <section
          data-testid="login-panel"
          className="w-full rounded-lg bg-surface-elevated p-6 sm:p-8"
        >
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">アカウント</h2>
              <p className="mt-2 text-sm leading-6 text-foreground-muted">
                新規登録も既存ログインも Cognito の安全な画面で完了します。
              </p>
            </div>

            {errorMessage ? (
              <div className="rounded-lg bg-danger/10 px-4 py-3 text-sm text-danger">
                {errorMessage}
              </div>
            ) : null}

            <div className="space-y-3">
              {googleEnabled ? (
                <a
                  href={`/auth/cognito/login?provider=Google${desktopSuffix}`}
                  className="flex w-full items-center justify-center gap-3 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
                >
                  <Chrome className="h-4 w-4" aria-hidden="true" />
                  Google で続行
                </a>
              ) : (
                <div className="flex w-full items-center justify-between gap-3 rounded-md bg-surface-0 px-4 py-3 text-sm text-foreground-muted">
                  <span className="inline-flex items-center gap-3">
                    <Chrome className="h-4 w-4" aria-hidden="true" />
                    Google で続行
                  </span>
                  <span className="text-xs">設定中</span>
                </div>
              )}
              {appleEnabled ? (
                <a
                  href={`/auth/cognito/login?provider=SignInWithApple${desktopSuffix}`}
                  className="flex w-full items-center justify-center gap-3 rounded-md bg-surface-1 px-4 py-3 text-sm font-medium text-foreground hover:bg-surface-2"
                >
                  <Apple className="h-4 w-4" aria-hidden="true" />
                  Apple で続行
                </a>
              ) : (
                <div className="flex w-full items-center justify-between gap-3 rounded-md bg-surface-0 px-4 py-3 text-sm text-foreground-muted">
                  <span className="inline-flex items-center gap-3">
                    <Apple className="h-4 w-4" aria-hidden="true" />
                    Apple で続行
                  </span>
                  <span className="text-xs">設定中</span>
                </div>
              )}
              <a
                href={`/auth/email${desktopPageSuffix}`}
                className="flex w-full items-center justify-center gap-3 rounded-md bg-surface-1 px-4 py-3 text-sm font-medium text-foreground hover:bg-surface-2"
              >
                <Fingerprint className="h-4 w-4" aria-hidden="true" />
                Passkey / メールで続行
              </a>
              <a
                href={`/auth/signup${desktopPageSuffix}`}
                className="flex w-full items-center justify-center gap-3 rounded-md bg-surface-0 px-4 py-3 text-sm font-medium text-foreground-muted hover:bg-surface-1 hover:text-foreground"
              >
                <KeyRound className="h-4 w-4" aria-hidden="true" />
                新しいアカウントを作成
              </a>
              <a
                href={`/auth/signup${desktopPageSuffix}`}
                className="flex w-full items-center justify-center gap-3 rounded-md bg-surface-0 px-4 py-3 text-sm font-medium text-foreground-muted hover:bg-surface-1 hover:text-foreground"
              >
                タイル管理から始める
              </a>
            </div>

            <div className="rounded-lg bg-surface-0 p-4">
              <div className="flex gap-3">
                <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
                <p className="text-sm leading-6 text-foreground-muted">
                  本番 API は password-only 認証を拒否します。登録後は Passkey を追加してから Web /
                  Desktop / Android で利用してください。
                </p>
              </div>
            </div>

            <p className="text-xs leading-5 text-foreground-subtle">
              続行すると、
              <Link href="/terms" className="underline hover:text-foreground">
                利用規約
              </Link>
              と
              <Link href="/privacy" className="underline hover:text-foreground">
                プライバシーポリシー
              </Link>
              に同意したものとみなされます。
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
