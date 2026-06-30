import type { SupabaseClient } from '@supabase/supabase-js'
import { isDemoTourActive } from '@/lib/demo-data'

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

export async function getUserCompanyContext(supabase: SupabaseClient, userId: string) {
  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role, company:companies(status, settings)')
    .eq('id', userId)
    .single()

  const company = firstOrNull(profile?.company) as {
    status: string
    settings: Record<string, unknown> | null
  } | null

  return {
    companyId: profile?.company_id ?? null,
    role: profile?.role ?? null,
    companyStatus: company?.status ?? null,
    companySettings: company?.settings ?? null,
    demoTour: isDemoTourActive(company),
  }
}
