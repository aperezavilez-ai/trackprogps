export type AppRole =
  | 'super_admin'
  | 'admin_empresa'
  | 'supervisor'
  | 'operador'
  | 'cliente_consulta'
  | 'miembro_familiar'

const FLEET_WRITE: AppRole[] = ['super_admin', 'admin_empresa', 'supervisor']
const COMMAND: AppRole[] = ['super_admin', 'admin_empresa', 'supervisor']
const ADMIN: AppRole[] = ['super_admin', 'admin_empresa']
const READ_ONLY: AppRole[] = ['cliente_consulta', 'miembro_familiar']

export function canWriteFleet(role: string) {
  return FLEET_WRITE.includes(role as AppRole)
}

export function canCommandDevices(role: string) {
  return COMMAND.includes(role as AppRole)
}

export function canManageUsers(role: string) {
  return ADMIN.includes(role as AppRole)
}

export function canManageBilling(role: string) {
  return ADMIN.includes(role as AppRole)
}

export function canManageGroups(role: string) {
  return ['super_admin', 'admin_empresa', 'supervisor'].includes(role)
}

export function canAcknowledgeAlerts(role: string) {
  return !READ_ONLY.includes(role as AppRole)
}

export function isReadOnlyRole(role: string) {
  return READ_ONLY.includes(role as AppRole)
}

/** Rutas permitidas por rol (prefijo) */
const FAMILY_ROUTES = ['/dashboard', '/map', '/vehicles', '/alerts', '/history', '/settings']
const READONLY_BUSINESS_ROUTES = [
  ...FAMILY_ROUTES, '/drivers', '/devices', '/mobile', '/reports', '/geofences', '/maintenance',
]
const OPERATOR_ROUTES = READONLY_BUSINESS_ROUTES

export function canAccessRoute(role: string, pathname: string): boolean {
  if (['super_admin', 'admin_empresa', 'supervisor'].includes(role)) return true
  if (role === 'miembro_familiar') {
    return FAMILY_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
  }
  if (role === 'cliente_consulta') {
    return READONLY_BUSINESS_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
  }
  if (role === 'operador') {
    return OPERATOR_ROUTES.some(r => pathname === r || pathname.startsWith(r + '/'))
  }
  return true
}

export function filterNavByRole(role: string, href: string): boolean {
  if (canManageBilling(role)) return true
  if (href.startsWith('/billing')) return false
  if (href.startsWith('/admin')) return role === 'super_admin' || role === 'admin_empresa'

  if (role === 'miembro_familiar') {
    return ['/dashboard', '/map', '/vehicles', '/alerts', '/history', '/settings'].includes(href)
  }
  if (role === 'cliente_consulta') {
    return !['/billing', '/admin/users'].some(b => href.startsWith(b))
  }
  if (role === 'operador') {
    return !['/billing', '/admin/users'].some(b => href.startsWith(b))
  }
  return true
}

export function denyUnless(role: string, allowed: AppRole[]) {
  return !allowed.includes(role as AppRole)
}
