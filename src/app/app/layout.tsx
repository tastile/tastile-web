import { redirect } from 'next/navigation'
import { getIdTokenFromCookies } from '@/lib/cognito/cookies'
import { AppLayoutClient } from './layout-client'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const bypassAuth =
    process.env.NODE_ENV !== 'production' &&
    (process.env.E2E_BYPASS_AUTH === '1' || process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === '1')
  if (bypassAuth) {
    return <AppLayoutClient>{children}</AppLayoutClient>
  }
  const idToken = await getIdTokenFromCookies()
  if (!idToken) {
    redirect('/login')
  }

  return <AppLayoutClient>{children}</AppLayoutClient>
}
