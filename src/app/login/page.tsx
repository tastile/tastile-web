import { Apple, Fingerprint, Globe } from "lucide-react";
import Link from "next/link";
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
  cognito_not_configured: "認証サービスの設定に問題があります。管理者にご連絡ください。",
  unsupported_provider: "このログイン方法はまだ有効化されていません。",
  provider_not_configured:
    "このログイン方法はまだ有効化されていません。Passkey / メールで続行してください。",
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
    <div className="min-h-svh bg-background font-[family-name:var(--font-jp)]">
      <main className="flex min-h-svh w-full flex-col items-center justify-center px-4 py-4">
        <Link
          href="/"
          aria-label="Tastile ホーム"
          className="flex min-h-12 items-center gap-2 text-foreground"
        >
          <TastileLogo size={36} />
          <span className="text-lg font-semibold tracking-tight">tastile</span>
        </Link>

        <section
          data-testid="login-panel"
          className="mt-6 w-full max-w-sm rounded-xl bg-surface-elevated p-5 sm:p-6"
        >
          <h1 className="font-[family-name:var(--font-jp-heading)] text-xl font-semibold text-foreground">
            ログイン
          </h1>

          {errorMessage ? (
            <div
              role="alert"
              className="mt-4 rounded-lg bg-danger/10 px-3 py-2 text-sm leading-5 text-danger"
            >
              {errorMessage}
            </div>
          ) : null}

          <div className="mt-5 space-y-2">
            {googleEnabled ? (
              <a
                href={`/auth/cognito/login?provider=Google${desktopSuffix}`}
                className="flex min-h-12 w-full items-center justify-center gap-3 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover"
              >
                <Globe className="h-4 w-4" aria-hidden="true" />
                Google で続行
              </a>
            ) : null}
            {appleEnabled ? (
              <a
                href={`/auth/cognito/login?provider=SignInWithApple${desktopSuffix}`}
                className="flex min-h-12 w-full items-center justify-center gap-3 rounded-md bg-surface-1 px-4 py-3 text-sm font-medium text-foreground hover:bg-surface-2"
              >
                <Apple className="h-4 w-4" aria-hidden="true" />
                Apple で続行
              </a>
            ) : null}
            <a
              href={`/auth/email${desktopPageSuffix}`}
              className="flex min-h-12 w-full items-center justify-center gap-3 rounded-md bg-surface-1 px-4 py-3 text-sm font-medium text-foreground hover:bg-surface-2"
            >
              <Fingerprint className="h-4 w-4" aria-hidden="true" />
              Passkey / メールで続行
            </a>
          </div>

          <a
            href={`/auth/signup${desktopPageSuffix}`}
            className="mt-3 flex min-h-12 items-center justify-center text-sm text-foreground-muted underline underline-offset-2 hover:text-foreground"
          >
            アカウントを作成
          </a>

          <p className="text-center text-[11px] leading-4 text-foreground-subtle">
            続行すると、
            <Link href="/terms" className="underline underline-offset-2 hover:text-foreground">
              利用規約
            </Link>
            と
            <Link href="/privacy" className="underline underline-offset-2 hover:text-foreground">
              プライバシーポリシー
            </Link>
            に同意したものとみなされます。
          </p>
        </section>
      </main>
    </div>
  );
}
