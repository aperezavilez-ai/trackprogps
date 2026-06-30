/**
 * Vincula super_admin a empresa sandbox interna para pruebas móvil + mapa web.
 * Uso: node scripts/setup-admin-mobile-test.mjs [email]
 */
import { createClient } from '@supabase/supabase-js'
import { loadRootEnv } from './lib/load-env.mjs'

loadRootEnv()

const email = (process.argv[2] ?? 'alfonsoavilery@icloud.com').trim().toLowerCase()
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env')
  process.exit(1)
}

const service = createClient(url, key, { auth: { persistSession: false } })

const { data: plan } = await service
  .from('plans')
  .select('id, name')
  .eq('type', 'empresarial')
  .eq('is_active', true)
  .maybeSingle()

if (!plan) {
  console.error('No se encontró plan Empresarial')
  process.exit(1)
}

let { data: internal } = await service
  .from('companies')
  .select('id, name')
  .eq('email', 'interno@trackprogps.mx')
  .maybeSingle()

if (!internal) {
  const { data: created, error } = await service
    .from('companies')
    .insert({
      name: 'TrackPro GPS — Equipo interno',
      email: 'interno@trackprogps.mx',
      plan_id: plan.id,
      status: 'active',
      account_type: 'business',
      settings: { platform_internal: true },
    })
    .select('id, name')
    .single()
  if (error) {
    console.error('Error creando empresa interna:', error.message)
    process.exit(1)
  }
  internal = created
}

await service
  .from('companies')
  .update({ plan_id: plan.id, status: 'active' })
  .eq('id', internal.id)

const { data: sub } = await service
  .from('subscriptions')
  .select('id')
  .eq('company_id', internal.id)
  .maybeSingle()

const periodEnd = new Date(Date.now() + 365 * 86400000).toISOString()
if (sub?.id) {
  await service.from('subscriptions').update({
    plan_id: plan.id,
    status: 'active',
    current_period_end: periodEnd,
  }).eq('company_id', internal.id)
} else {
  await service.from('subscriptions').insert({
    company_id: internal.id,
    plan_id: plan.id,
    status: 'active',
    current_period_start: new Date().toISOString(),
    current_period_end: periodEnd,
  })
}

const { data: authList } = await service.auth.admin.listUsers({ page: 1, perPage: 500 })
const authUser = authList?.users.find(u => u.email?.toLowerCase() === email)

if (!authUser) {
  console.error(`No hay usuario auth con email: ${email}`)
  process.exit(1)
}

const { data: userRow, error: userErr } = await service
  .from('users')
  .update({
    company_id: internal.id,
    role: 'super_admin',
    is_active: true,
    updated_at: new Date().toISOString(),
  })
  .eq('id', authUser.id)
  .select('id, email, role, company_id')
  .single()

if (userErr) {
  console.error('Error actualizando users:', userErr.message)
  process.exit(1)
}

console.log('Listo — prueba móvil habilitada')
console.log('  Usuario:', userRow.email, `(${userRow.role})`)
console.log('  Empresa sandbox:', internal.name)
console.log('  Plan:', plan.name)
console.log('')
console.log('Pasos:')
console.log('  1. Cierra sesión en web y app móvil si estabas logueado')
console.log('  2. App: https://trackprogps.mx/descargar — login con tu correo')
console.log('  3. Acepta permisos de ubicación y activa el rastreo')
console.log('  4. Web: mapa en https://trackprogps.mx/map — verás tu celular')
