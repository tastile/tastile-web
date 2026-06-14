'use client'

import { useEffect, useState, useCallback } from 'react'
import { Copy, Check, Eye, EyeOff } from 'lucide-react'

type SessionData = {
  idToken: string
  refreshToken: string
  sub: string
  exp: number
}

export function AccessTokenSection() {
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    void fetchSession()
  }, [])

  async function fetchSession() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/session', { cache: 'no-store' })
      if (!res.ok) {
        setError('セッションを取得できませんでした。')
        setLoading(false)
        return
      }
      const data = (await res.json()) as SessionData
      setSession(data)
    } catch {
      setError('セッションの取得に失敗しました。')
    }
    setLoading(false)
  }

  const handleCopy = useCallback(async () => {
    if (!session?.idToken) return
    await navigator.clipboard.writeText(session.idToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [session])

  const isExpired = session ? Date.now() / 1000 > session.exp : false

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-semibold text-foreground">Access Token</h2>
        <p className="mt-1 text-foreground-muted">
          APIリクエストに使用するアクセストークンです。BearerトークンとしてAuthorizationヘッダーに含めて使用します。
        </p>
      </div>

      {loading && (
        <p className="text-sm text-foreground-subtle">読み込み中...</p>
      )}

      {error && (
        <div className="rounded-md bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      )}

      {session && !loading && (
        <section className="rounded-lg bg-surface-2 p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-foreground">API Key</h3>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setVisible(!visible)}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-foreground hover:bg-surface-0"
              >
                {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {visible ? '非表示' : '表示'}
              </button>
              <button
                type="button"
                onClick={() => void handleCopy()}
                disabled={isExpired}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg hover:bg-primary-hover disabled:opacity-60"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copied ? 'コピー済み' : 'コピー'}
              </button>
            </div>
          </div>

          <div className="rounded-md bg-surface-0 p-4">
            <p className="mb-2 text-xs text-foreground-subtle">Authorizationヘッダー:</p>
            <code className="block break-all font-mono text-xs text-foreground">
              {visible
                ? `Bearer ${session.idToken}`
                : 'Bearer ••••••••••••••••••••••••••••••••'}
            </code>
          </div>

          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-foreground-subtle">User ID</dt>
              <dd className="mt-1 break-all font-mono text-xs text-foreground">{session.sub}</dd>
            </div>
            <div>
              <dt className="text-foreground-subtle">有効期限</dt>
              <dd className={`mt-1 font-medium ${isExpired ? 'text-danger' : 'text-foreground'}`}>
                {new Date(session.exp * 1000).toLocaleString('ja-JP')}
                {isExpired && ' (期限切れ)'}
              </dd>
            </div>
          </dl>

          <div className="rounded-md bg-surface-3 p-4 text-xs text-foreground-muted space-y-2">
            <p className="font-semibold text-foreground">使用方法</p>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all">{`curl -H "Authorization: Bearer <your-token>" \\
  https://api.tastile.app/read/tiles`}</pre>
            <p>
              SSE接続時はクエリパラメータとして渡します:
              <br />
              <code className="text-foreground">/read/events/state?access_token=&lt;your-token&gt;</code>
            </p>
          </div>

          <button
            type="button"
            onClick={() => void fetchSession()}
            className="text-sm text-foreground-muted hover:text-foreground"
          >
            再読み込み
          </button>
        </section>
      )}
    </div>
  )
}
