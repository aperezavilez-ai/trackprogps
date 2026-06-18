export interface UserProfile {
  role: string
  company_id: string | null
}

export function isSuperAdmin(profile: UserProfile) {
  return profile.role === 'super_admin'
}

/** Aplica filtro por empresa; super_admin sin empresa ve todo */
export function scopeByCompany<T extends { eq: (col: string, val: string) => T }>(
  query: T,
  companyId: string | null,
  column = 'company_id'
): T {
  return companyId ? query.eq(column, companyId) : query
}

const FULL_ACCESS_ROLES = ['super_admin', 'admin_empresa', 'supervisor'] as const

export function hasFullVehicleAccess(role: string) {
  return FULL_ACCESS_ROLES.includes(role as typeof FULL_ACCESS_ROLES[number])
}
