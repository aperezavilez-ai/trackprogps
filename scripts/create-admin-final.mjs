/**
 * create-admin-final.mjs
 * Estrategia: deshabilitar RLS completamente → crear usuario → rehabilitar
 */
import { createDbClient } from './lib/db.mjs'
import { requireAdminEnv } from './lib/admin-env.mjs'

const {
  supabaseUrl: SUPABASE_URL,
  serviceRoleKey: SERVICE_ROLE_KEY,
  adminEmail: ADMIN_EMAIL,
  adminPassword: ADMIN_PASSWORD,
  adminName: ADMIN_NAME,
} = requireAdminEnv()

const client = await createDbClient()
console.log('✅ Conectado\n')

try {
  // Disable RLS on users completely
  console.log('⏸  Desactivando RLS en public.users...')
  await client.query(`ALTER TABLE public.users DISABLE ROW LEVEL SECURITY`)

  // Create auth user
  console.log('👤 Creando usuario admin en Supabase Auth...')
  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey': SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: ADMIN_NAME, role: 'super_admin' },
    }),
  })

  const data = await res.json()
  let userId

  if (!res.ok) {
    const errStr = JSON.stringify(data).toLowerCase()
    if (errStr.includes('already') || errStr.includes('registered')) {
      console.log('   Usuario ya existe. Buscando...')
      const list = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=100`, {
        headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY }
      })
      const listData = await list.json()
      const found = listData.users?.find(u => u.email === ADMIN_EMAIL)
      if (!found) {
        console.log('   Lista completa:', JSON.stringify(listData).slice(0, 500))
        throw new Error('No se encontró el usuario existente')
      }
      userId = found.id
      console.log(`   ID: ${userId}`)
    } else {
      console.error('   Error completo:', JSON.stringify(data, null, 2))
      throw new Error('No se pudo crear el usuario auth')
    }
  } else {
    userId = data.id
    console.log(`✅ Usuario creado: ${userId}`)
  }

  // Upsert profile
  console.log('📝 Guardando perfil...')
  await client.query(`
    INSERT INTO public.users (id, email, full_name, role, company_id, is_active)
    VALUES ($1, $2, $3, 'super_admin', NULL, true)
    ON CONFLICT (id) DO UPDATE SET
      role = 'super_admin', full_name = $3, company_id = NULL, is_active = true
  `, [userId, ADMIN_EMAIL, ADMIN_NAME])
  console.log('✅ Perfil guardado')

} finally {
  // Always re-enable RLS
  console.log('▶  Reactivando RLS...')
  await client.query(`ALTER TABLE public.users ENABLE ROW LEVEL SECURITY`)
  await client.end()
}

console.log('\n🎉 ¡Super admin listo!')
console.log(`   Email:    ${ADMIN_EMAIL}`)
console.log(`   Password: ${ADMIN_PASSWORD}`)
console.log(`   URL:      https://trackprogps.mx/login`)
