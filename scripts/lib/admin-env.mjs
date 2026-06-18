import { loadRootEnv, PROJECT_REF } from './load-env.mjs'

export function requireAdminEnv() {
  loadRootEnv()

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? `https://${PROJECT_REF}.supabase.co`
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const adminEmail = process.env.ADMIN_EMAIL
  const adminPassword = process.env.ADMIN_PASSWORD ?? process.env.SUPABASE_DB_PASSWORD
  const adminName = process.env.ADMIN_NAME ?? 'Admin'

  const missing = []
  if (!serviceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY')
  if (!adminEmail) missing.push('ADMIN_EMAIL')
  if (!adminPassword) missing.push('ADMIN_PASSWORD o SUPABASE_DB_PASSWORD')

  if (missing.length) {
    console.error(`Faltan variables en .env: ${missing.join(', ')}`)
    process.exit(1)
  }

  return { supabaseUrl, serviceRoleKey, adminEmail, adminPassword, adminName }
}
