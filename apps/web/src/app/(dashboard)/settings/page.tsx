import { createSupabaseServerClient } from '@/lib/supabase/server'
import { SettingsClient } from '@/components/settings/settings-client'

export const dynamic = 'force-dynamic'

export default async function SettingsPage() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('*, company:companies(*, plan:plans(features))')
    .eq('id', user.id).single()

  const { data: teamMembers } = await supabase
    .from('users')
    .select('id, full_name, email, role, is_active, created_at')
    .eq('company_id', profile?.company_id)
    .order('created_at')

  const planFeatures = (profile?.company as { plan?: { features?: Record<string, unknown> } } | undefined)?.plan?.features
  const hasApiAccess = planFeatures?.api_access === true

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Configuración</h1>
        <p className="text-sm text-gray-500 mt-1">Administra tu empresa, usuarios y preferencias</p>
      </div>
      <SettingsClient profile={profile} currentUserId={user.id} teamMembers={teamMembers ?? []} hasApiAccess={hasApiAccess} />
    </div>
  )
}
