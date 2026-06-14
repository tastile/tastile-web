import Link from 'next/link'
import { MailPlus } from 'lucide-react'
import { AuthShell } from '../auth-shell'
import { authErrorMessage } from '@/lib/cognito/form'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const params = await searchParams
  const message = authErrorMessage(params.error ?? null)

  return (
    <AuthShell
      title="アカウントを作成"
      subtitle="メールアドレスだけで登録します。パスワードを作らず、確認コードと passkey / email OTP を使う認証経路にします。"
      message={message}
    >
      <form action="/auth/email/signup" method="post" className="space-y-5">
        <div>
          <label htmlFor="email" className="text-sm font-medium text-foreground">メールアドレス</label>
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
        <button className="flex w-full items-center justify-center gap-3 rounded-md bg-primary px-4 py-3 text-sm font-semibold text-primary-fg hover:bg-primary-hover">
          <MailPlus className="h-4 w-4" aria-hidden="true" />
          確認コードを送信
        </button>
      </form>
      <p className="mt-5 text-sm text-foreground-muted">
        すでにコードを持っている場合は <Link className="underline hover:text-foreground" href="/auth/confirm">確認画面</Link> を開いてください。
      </p>
    </AuthShell>
  )
}
