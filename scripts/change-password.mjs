import { loadRootEnv } from './lib/load-env.mjs'

loadRootEnv()

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const EMAIL        = process.env.CHANGE_PASSWORD_EMAIL ?? 'monitor@gmail.com'
const NEW_PASSWORD = process.env.CHANGE_PASSWORD_NEW ?? process.env.ADMIN_PASSWORD

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !NEW_PASSWORD) {
  console.error('Requiere NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY y CHANGE_PASSWORD_NEW en .env')
  process.exit(1)
}

// Get user ID first
const list = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=100`, {
  headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY }
})
const listData = await list.json()
const user = listData.users?.find(u => u.email === EMAIL)
if (!user) throw new Error('Usuario no encontrado')

// Update password
const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users/${user.id}`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY },
  body: JSON.stringify({ password: NEW_PASSWORD })
})
const data = await res.json()
if (!res.ok) throw new Error(JSON.stringify(data))

console.log(`✅ Contraseña actualizada`)
console.log(`   Email:    ${EMAIL}`)
