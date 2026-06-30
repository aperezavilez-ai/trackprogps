import type { SupabaseClient } from '@supabase/supabase-js'

const FULL_ACCESS_ROLES = ['super_admin', 'admin_empresa', 'supervisor'] as const

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null)
}

export function hasFullVehicleAccess(role: string, groupAccessCount: number) {
  return FULL_ACCESS_ROLES.includes(role as typeof FULL_ACCESS_ROLES[number]) || groupAccessCount === 0
}

export async function setUserGroupAccess(
  supabase: SupabaseClient,
  userId: string,
  companyId: string,
  groupIds: string[]
) {
  await supabase.from('user_vehicle_group_access').delete().eq('user_id', userId)

  if (!groupIds.length) return

  const rows = groupIds.map(groupId => ({
    user_id:    userId,
    group_id:   groupId,
    company_id: companyId,
  }))

  const { error } = await supabase.from('user_vehicle_group_access').insert(rows)
  if (error) throw error
}

export async function getUserGroupAccessMap(
  supabase: SupabaseClient,
  userIds: string[]
) {
  if (!userIds.length) return new Map<string, Array<{ id: string; name: string; color: string }>>()

  const { data } = await supabase
    .from('user_vehicle_group_access')
    .select('user_id, group:vehicle_groups(id, name, color)')
    .in('user_id', userIds)

  const map = new Map<string, Array<{ id: string; name: string; color: string }>>()
  for (const row of data ?? []) {
    const group = firstOrNull(row.group) as { id: string; name: string; color: string } | null
    if (!group) continue
    const list = map.get(row.user_id) ?? []
    list.push(group)
    map.set(row.user_id, list)
  }
  return map
}
