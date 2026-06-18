import { supabase } from './supabase'

export interface UserProfile {
  id: string
  company_id: string | null
  role: string
  is_active: boolean
  full_name: string
}

const READ_ONLY_ROLES = ['cliente_consulta', 'miembro_familiar']

export function isReadOnlyRole(role: string) {
  return READ_ONLY_ROLES.includes(role)
}

export function canAcknowledgeAlerts(role: string) {
  return !isReadOnlyRole(role)
}

export function canViewReports(role: string) {
  return role !== 'miembro_familiar'
}

export async function fetchUserProfile(userId: string): Promise<UserProfile | null> {
  const { data } = await supabase
    .from('users')
    .select('id, company_id, role, is_active, full_name')
    .eq('id', userId)
    .single()
  return data as UserProfile | null
}

export async function validateSession(): Promise<{ ok: true; profile: UserProfile } | { ok: false; reason: string }> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, reason: 'no_session' }

  if (!user.email_confirmed_at) {
    await supabase.auth.signOut()
    return { ok: false, reason: 'unconfirmed' }
  }

  const profile = await fetchUserProfile(user.id)
  if (!profile) {
    await supabase.auth.signOut()
    return { ok: false, reason: 'no_profile' }
  }
  if (!profile.is_active) {
    await supabase.auth.signOut()
    return { ok: false, reason: 'inactive' }
  }

  return { ok: true, profile }
}
