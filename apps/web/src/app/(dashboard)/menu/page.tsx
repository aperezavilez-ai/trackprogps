import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { MobileMenuPage } from '@/components/layout/mobile-menu-page'

export const dynamic = 'force-dynamic'

export default async function MenuPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/login')

  return <MobileMenuPage role={profile.role} />
}
