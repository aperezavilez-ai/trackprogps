/**
 * create-admin-sql.mjs
 * Crea el super admin directamente via SQL + Admin API
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

async function main() {
  console.log('✅ Conectado a DB\n')

  // Step 1: Disable RLS on public.users so trigger can insert
  console.log('⏸  Desactivando RLS en public.users temporalmente...')
  await client.query(`ALTER TABLE public.users DISABLE ROW LEVEL SECURITY`)

  let userId
  try {
    // Step 2: Create auth user via Admin API
    console.log('👤 Creando usuario en auth...')
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
    if (!res.ok) {
      if (data.msg?.includes('already') || data.message?.includes('already')) {
        console.log('   Usuario ya existe en auth, buscando...')
        const listRes = await fetch(
          `${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(ADMIN_EMAIL)}`,
          { headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY } }
        )
        const listData = await listRes.json()
        userId = listData.users?.[0]?.id
        if (!userId) throw new Error('No se encontró el usuario: ' + JSON.stringify(listData))
      } else {
        throw new Error('Auth API error: ' + JSON.stringify(data))
      }
    } else {
      userId = data.id
    }
    console.log(`✅ Auth user ID: ${userId}`)

    // Step 3: Upsert public.users profile
    console.log('📝 Insertando/actualizando perfil en public.users...')
    await client.query(`
      INSERT INTO public.users (id, email, full_name, role, company_id, is_active)
      VALUES ($1, $2, $3, 'super_admin', NULL, true)
      ON CONFLICT (id) DO UPDATE SET
        role = 'super_admin', full_name = $3, is_active = true, company_id = NULL
    `, [userId, ADMIN_EMAIL, ADMIN_NAME])
    console.log('✅ Perfil creado/actualizado')

  } finally {
    // Step 4: Re-enable RLS
    console.log('▶  Reactivando RLS...')
    await client.query(`ALTER TABLE public.users ENABLE ROW LEVEL SECURITY`)
    await client.end()
  }

  console.log('\n🎉 Super admin creado exitosamente!')
  console.log(`   Email:    ${ADMIN_EMAIL}`)
  console.log(`   Password: ${ADMIN_PASSWORD}`)
  console.log(`   Role:     super_admin`)
  console.log(`\n👉 Inicia sesión en: https://trackprogps.mx/login\n`)
}

main().catch(async err => {
  console.error('❌', err.message)
  try { await client.query(`ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created`) } catch {}
  await client.end()
  process.exit(1)
})
