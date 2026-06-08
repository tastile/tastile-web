import Link from 'next/link'
import { TastileLogo } from '@/components/TastileLogo'
import { SiteFooter } from '@/components/SiteFooter'
import { SiteHeader } from '@/components/SiteHeader'

const ERROR_MESSAGES: Record<string, string> = {
  no_session: 'サインインが必要です。',
  session_expired: 'セッションが切れました。もう一度サインインしてください。',
  missing_code: '認証コードが見つかりませんでした。もう一度お試しください。',
  state_mismatch: '認証状態の確認に失敗しました。もう一度お試しください。',
  auth_failed: '認証に失敗しました。もう一度お試しください。',
  cognito_not_configured: 'Cognito が設定されていません。管理者にご連絡ください。',
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const errorKey = typeof params?.error === 'string' ? params.error : null
  const errorMessage = errorKey ? (ERROR_MESSAGES[errorKey] ?? `サインインに失敗しました: ${errorKey}`) : null

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader hideAuth />

      <main className="layout-shell flex flex-1 items-center justify-center py-16">
        <section data-testid="login-panel" className="w-full max-w-xl rounded-xl border border-border bg-surface-elevated p-8">
          <div className="space-y-7">
            <div className="flex items-start gap-4">
              <TastileLogo size={60} className="mt-1 text-foreground" />
              <div>
                <h1 className="text-3xl font-[590] tracking-[-0.02em] text-foreground">
                  Tastileにログイン
                </h1>
                <p className="mt-3 text-base text-foreground-muted">
                  タスク実行を、自動で最適化
                </p>
              </div>
            </div>

            {errorMessage ? (
              <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-400">
                {errorMessage}
              </div>
            ) : null}

            <Link
              href="/auth/cognito/login"
              className="flex w-full items-center justify-center gap-3 rounded-md border border-border bg-surface-1 px-4 py-3 text-sm font-medium text-foreground hover:bg-surface-2"
            >
              Sign in
            </Link>

            <p className="text-xs text-foreground-subtle">
              ログインすると、<Link href="/terms" className="underline hover:text-foreground">利用規約</Link>と<Link href="/privacy" className="underline hover:text-foreground">プライバシーポリシー</Link>に同意したものとみなされます
            </p>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}
