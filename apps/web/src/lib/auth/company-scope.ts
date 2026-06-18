import type { SupabaseClient } from '@supabase/supabase-js'
import { isDemoTourActive } from '@/lib/demo-data'

export interface CompanyScope {
  userId: string
  role: string
  companyId: string | null
  demoTour: boolean
  /** super_admin sin empresa — no mostrar datos globales de clientes */
  platformOnly: boolean
}

export async function getCompanyScope(supabase: SupabaseClient): Promise<CompanyScope | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('role, company_id, company:companies(status, settings)')
    .eq('id', user.id)
    .single()

  if (!profile) return null

  const company = profile.company as { status: string; settings: Record<string, unknown> | null } | null
  const platformOnly = profile.role === 'super_admin' && !profile.company_id

  return {
    userId: user.id,
    role: profile.role,
    companyId: profile.company_id,
    demoTour: isDemoTourActive(company),
    platformOnly,
  }
}

export function emptyDashboardStats() {
  return {
    total_vehicles: 0,
    vehicles_online: 0,
    vehicles_stopped: 0,
    vehicles_offline: 0,
    vehicles_no_signal: 0,
    active_alerts: 0,
    km_today: 0,
    km_month: 0,
    productivity_today: 0,
    productivity_month: 0,
  }
}
