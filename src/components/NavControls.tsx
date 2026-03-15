'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sun, Moon, Globe, ChevronDown } from 'lucide-react'

export function ThemeToggle() {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    const stored = localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = stored === 'dark' || (!stored && prefersDark)
    setDark(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  function toggle() {
    const next = !dark
    setDark(next)
    document.documentElement.classList.toggle('dark', next)
    localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
      aria-label="Toggle theme"
    >
      {dark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  )
}

export function LanguageToggle() {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const searchParams = useSearchParams()
  const lang = searchParams.get('lang') || 'ja'

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function switchLang(newLang: string) {
    setOpen(false)
    const params = new URLSearchParams(searchParams.toString())
    if (newLang === 'ja') {
      params.delete('lang')
    } else {
      params.set('lang', newLang)
    }
    const qs = params.toString()
    router.push(qs ? `/?${qs}` : '/')
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2 py-2 rounded-md text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors text-sm"
        aria-label="Switch language"
      >
        <Globe size={16} />
        <span className="text-xs font-medium">{lang === 'en' ? 'EN' : 'JP'}</span>
        <ChevronDown size={12} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-32 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg z-50 py-1">
          <button
            onClick={() => switchLang('ja')}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
              lang === 'ja' ? 'text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            日本語
          </button>
          <button
            onClick={() => switchLang('en')}
            className={`w-full text-left px-3 py-2 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors ${
              lang === 'en' ? 'text-zinc-900 dark:text-zinc-100 font-medium' : 'text-zinc-500 dark:text-zinc-400'
            }`}
          >
            English
          </button>
        </div>
      )}
    </div>
  )
}
