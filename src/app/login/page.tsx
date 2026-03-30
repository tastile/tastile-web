'use client'

import { useState } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import Link from 'next/link'
import { TastileLogo } from '@/components/TastileLogo'
import { buildSupabaseCallbackUrl, tryGetSupabaseEnv } from '@/lib/supabase/env'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const env = tryGetSupabaseEnv()
  const supabase = env
    ? createBrowserClient(
        env.url,
        env.publishableKey
      )
    : null

  const handleGoogleLogin = async () => {
    if (!supabase) {
      setError('Supabase is not configured')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: buildSupabaseCallbackUrl(window.location.origin),
        },
      })

      if (error) {
        setError(error.message)
      }
    } catch {
      setError('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 flex flex-col">
      {/* Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800">
        <div className="mx-auto max-w-7xl px-6 h-16 flex items-center">
          <Link href="/" className="flex items-center gap-2">
            <TastileLogo size={22} className="text-zinc-900 dark:text-zinc-100" />
            <span className="font-bold text-lg tracking-tight text-zinc-900 dark:text-zinc-100">tastile</span>
          </Link>
        </div>
      </header>

      {/* Login Card */}
      <div className="flex-1 flex items-center justify-center px-6">
        <div className="w-full max-w-sm space-y-8">
          <div className="text-center">
            <TastileLogo size={40} className="text-zinc-900 dark:text-zinc-100 mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Tastileにログイン
            </h1>
            <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
              タスク実行を、自動で最適化
            </p>
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 px-4 py-3 text-sm text-red-700 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            onClick={handleGoogleLogin}
            disabled={isLoading || !supabase}
            className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              'Loading...'
            ) : (
              <>
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Googleでログイン
              </>
            )}
          </button>

          {!supabase ? (
            <p className="text-center text-xs text-zinc-500 dark:text-zinc-400">
              Supabase environment variables are not configured for this deployment.
            </p>
          ) : null}

          <p className="text-center text-xs text-zinc-400 dark:text-zinc-500">
            ログインすると、<Link href="/terms" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">利用規約</Link>と<Link href="/privacy" className="underline hover:text-zinc-600 dark:hover:text-zinc-300">プライバシーポリシー</Link>に同意したものとみなされます
          </p>
        </div>
      </div>
    </div>
  )
}
