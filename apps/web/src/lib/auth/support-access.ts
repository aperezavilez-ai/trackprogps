import type { SupabaseClient } from '@supabase/supabase-js'

const PLATFORM_INTERNAL_EMAIL = 'interno@trackprogps.mx'

export type SupportActor = {
  role: string
  company_id: string | null
  company?: { email?: string | null; settings?: { platform_internal?: boolean } | null } | null
}

export function isPlatformInternalCompany(company: SupportActor['company']): boolean {
  if (!company) return false
  if (company.email === PLATFORM_INTERNAL_EMAIL) return true
  const settings = company.settings
  return settings != null && typeof settings === 'object' && settings.platform_internal === true
}

/** super_admin o equipo interno TrackPro (admin/supervisor) */
export function canAccessSupportInbox(profile: SupportActor | null | undefined): boolean {
  if (!profile) return false
  if (profile.role === 'super_admin') return true
  if (!isPlatformInternalCompany(profile.company)) return false
  return ['admin_empresa', 'supervisor'].includes(profile.role)
}

export async function getSupportActor(
  supabase: SupabaseClient,
  userId: string,
): Promise<SupportActor | null> {
  const { data } = await supabase
    .from('users')
    .select('role, company_id, company:companies(email, settings)')
    .eq('id', userId)
    .single()
  return data as SupportActor | null
}

export function ticketSubjectFromBody(body: string): string {
  const line = body.trim().replace(/\s+/g, ' ')
  if (line.length <= 80) return line || 'Consulta de soporte'
  return `${line.slice(0, 77)}…`
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, '').slice(0, 15)
}
