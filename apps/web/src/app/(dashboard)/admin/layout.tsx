import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export default async function AdminSectionLayout({ children }: { children: React.ReactNode }) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('role, is_active')
    .eq('id', user.id)
    .single()

  if (!profile?.is_active) redirect('/login?error=inactive')
  if (!profile || !['super_admin', 'admin_empresa'].includes(profile.role)) {
    redirect('/dashboard')
  }

  return <>{children}</>
}
