import type { SupabaseClient } from '@supabase/supabase-js'

export const PLATFORM_INTERNAL_COMPANY_NAME = 'TrackPro GPS — Equipo interno'

/** Roles que puede tener el equipo interno de TrackPro (no clientes). */
export const INTERNAL_TEAM_ROLES = ['super_admin', 'admin_empresa', 'supervisor', 'operador'] as const

export type InternalTeamRole = typeof INTERNAL_TEAM_ROLES[number]

export function isInternalTeamRole(role: string): role is InternalTeamRole {
  return INTERNAL_TEAM_ROLES.includes(role as InternalTeamRole)
}

/** Empresa virtual para staff interno (admin/supervisor/operador de plataforma). */
export async function ensurePlatformInternalCompany(
  serviceClient: SupabaseClient,
): Promise<string> {
  const { data: existing } = await serviceClient
    .from('companies')
    .select('id')
    .eq('email', 'interno@trackprogps.mx')
    .maybeSingle()

  if (existing?.id) return existing.id

  const { data: plan } = await serviceClient
    .from('plans')
    .select('id')
    .eq('is_active', true)
    .order('price_monthly')
    .limit(1)
    .maybeSingle()

  const { data: created, error } = await serviceClient
    .from('companies')
    .insert({
      name: PLATFORM_INTERNAL_COMPANY_NAME,
      email: 'interno@trackprogps.mx',
      plan_id: plan?.id ?? null,
      status: 'active',
      settings: { platform_internal: true },
    })
    .select('id')
    .single()

  if (error) throw error
  return created.id
}

export async function getPlatformInternalCompanyId(
  serviceClient: SupabaseClient,
): Promise<string | null> {
  const { data } = await serviceClient
    .from('companies')
    .select('id')
    .eq('email', 'interno@trackprogps.mx')
    .maybeSingle()
  return data?.id ?? null
}
