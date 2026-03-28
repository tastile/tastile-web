import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DashboardLayoutClient } from './layout-client'

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const bypassAuth =
    process.env.NODE_ENV !== 'production' &&
    (process.env.E2E_BYPASS_AUTH === '1' || process.env.NEXT_PUBLIC_E2E_BYPASS_AUTH === '1')
  if (bypassAuth) {
    return <DashboardLayoutClient>{children}</DashboardLayoutClient>
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <DashboardLayoutClient>{children}</DashboardLayoutClient>
}
