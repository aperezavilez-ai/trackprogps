import type { NextRequest } from 'next/server'
import type { createSupabaseServerClient, createSupabaseServiceClient } from '@/lib/supabase/server'

type ServerClient = ReturnType<typeof createSupabaseServerClient>
type ServiceClient = ReturnType<typeof createSupabaseServiceClient>

export const FLEET_WRITE_ROLES = ['super_admin', 'admin_empresa', 'supervisor'] as const
export const ADMIN_ROLES = ['super_admin', 'admin_empresa'] as const

export type ActorProfile = {
  id: string
  company_id: string | null
  role: string
}

export function getClientAuditMeta(request: NextRequest) {
  return {
    ip_address: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      ?? request.headers.get('x-real-ip')
      ?? null,
    user_agent: request.headers.get('user-agent'),
  }
}

export async function getActorProfile(
  supabase: ServerClient,
  userId: string,
): Promise<ActorProfile | null> {
  const { data } = await supabase
    .from('users')
    .select('id, company_id, role')
    .eq('id', userId)
    .single()

  return data ?? null
}

export function hasRole(profile: ActorProfile | null, roles: readonly string[]) {
  return Boolean(profile && roles.includes(profile.role))
}

export function canAccessCompany(profile: ActorProfile, companyId: string | null) {
  if (profile.role === 'super_admin') return true
  return Boolean(companyId && profile.company_id === companyId)
}

export async function writeAuditLog(
  supabase: ServerClient | ServiceClient,
  input: {
    companyId: string | null
    userId: string
    action: string
    tableName?: string
    recordId?: string
    oldValues?: unknown
    newValues?: unknown
    request?: NextRequest
  },
) {
  const meta = input.request ? getClientAuditMeta(input.request) : { ip_address: null, user_agent: null }
  await supabase.from('audit_logs').insert({
    company_id: input.companyId,
    user_id: input.userId,
    action: input.action,
    table_name: input.tableName ?? null,
    record_id: input.recordId ?? null,
    old_values: input.oldValues ?? null,
    new_values: input.newValues ?? null,
    ...meta,
  })
}
