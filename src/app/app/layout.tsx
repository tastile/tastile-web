import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AppLayoutClient } from './layout-client'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  return <AppLayoutClient>{children}</AppLayoutClient>
}
