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

/** Plan Empresarial en sandbox interno para pruebas móvil (super_admin). */
export async function ensureSandboxMobilePlan(
  serviceClient: SupabaseClient,
  companyId: string,
): Promise<void> {
  const { data: plan } = await serviceClient
    .from('plans')
    .select('id')
    .eq('type', 'empresarial')
    .eq('is_active', true)
    .maybeSingle()

  if (!plan?.id) return

  await serviceClient
    .from('companies')
    .update({ plan_id: plan.id, status: 'active', account_type: 'business' })
    .eq('id', companyId)

  const { data: sub } = await serviceClient
    .from('subscriptions')
    .select('id')
    .eq('company_id', companyId)
    .maybeSingle()

  const periodEnd = new Date(Date.now() + 365 * 86400000).toISOString()
  if (sub?.id) {
    await serviceClient
      .from('subscriptions')
      .update({
        plan_id: plan.id,
        status: 'active',
        current_period_end: periodEnd,
        updated_at: new Date().toISOString(),
      })
      .eq('company_id', companyId)
  } else {
    await serviceClient.from('subscriptions').insert({
      company_id: companyId,
      plan_id: plan.id,
      status: 'active',
      current_period_start: new Date().toISOString(),
      current_period_end: periodEnd,
    })
  }
}
