/**
 * create-admin.mjs — Crea usuario super_admin en Supabase
 * Uso: node scripts/create-admin.mjs
 * Requiere en .env: SUPABASE_SERVICE_ROLE_KEY, ADMIN_EMAIL, ADMIN_PASSWORD
 */
import { requireAdminEnv } from './lib/admin-env.mjs'

const {
  supabaseUrl: SUPABASE_URL,
  serviceRoleKey: SERVICE_ROLE_KEY,
  adminEmail: ADMIN_EMAIL,
  adminPassword: ADMIN_PASSWORD,
  adminName: ADMIN_FULL_NAME,
} = requireAdminEnv()

async function main() {
  console.log('\n👤 Creando usuario super admin...')

  // 1. Create auth user via Admin API
  const createRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
      'apikey':        SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      email:             ADMIN_EMAIL,
      password:          ADMIN_PASSWORD,
      email_confirm:     true,
      user_metadata: {
        full_name: ADMIN_FULL_NAME,
        role:      'super_admin',
      },
    }),
  })

  const authUser = await createRes.json()

  if (!createRes.ok) {
    if (authUser.message?.includes('already been registered') || authUser.msg?.includes('already')) {
      console.log('⚠️  El usuario ya existe en auth. Buscando ID...')
      // Get existing user
      const listRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users?email=${encodeURIComponent(ADMIN_EMAIL)}`, {
        headers: {
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey': SERVICE_ROLE_KEY,
        },
      })
      const listData = await listRes.json()
      const existing = listData.users?.[0]
      if (!existing) throw new Error('No se pudo encontrar el usuario existente')
      authUser.id = existing.id
      console.log(`   ID encontrado: ${authUser.id}`)
    } else {
      throw new Error(`Auth error: ${JSON.stringify(authUser)}`)
    }
  } else {
    console.log(`✅ Auth user creado: ${authUser.id}`)
  }

  const userId = authUser.id

  // 2. Update public.users table to set role = super_admin
  const updateRes = await fetch(
    `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`,
    {
      method: 'PATCH',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
        'apikey':        SERVICE_ROLE_KEY,
        'Prefer':        'return=representation',
      },
      body: JSON.stringify({
        role:       'super_admin',
        full_name:  ADMIN_FULL_NAME,
        company_id: null,
        is_active:  true,
      }),
    }
  )

  if (updateRes.ok) {
    const updated = await updateRes.json()
    if (updated?.length > 0) {
      console.log(`✅ Perfil actualizado → role: super_admin`)
    } else {
      // Row might not exist yet (trigger creates it async), insert manually
      console.log('   Insertando perfil manualmente...')
      const insertRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${SERVICE_ROLE_KEY}`,
          'apikey':        SERVICE_ROLE_KEY,
          'Prefer':        'return=minimal',
        },
        body: JSON.stringify({
          id:         userId,
          email:      ADMIN_EMAIL,
          full_name:  ADMIN_FULL_NAME,
          role:       'super_admin',
          company_id: null,
          is_active:  true,
        }),
      })
      if (insertRes.ok || insertRes.status === 409) {
        console.log('✅ Perfil insertado')
      } else {
        const err = await insertRes.text()
        console.warn('⚠️  Insert:', err)
      }
    }
  } else {
    const err = await updateRes.text()
    console.warn('⚠️  Update users:', err)
  }

  console.log('\n🎉 ¡Super admin listo!')
  console.log(`   Email:    ${ADMIN_EMAIL}`)
  console.log(`   Password: ${ADMIN_PASSWORD}`)
  console.log(`   Role:     super_admin\n`)
}

main().catch(err => {
  console.error('❌', err.message)
  process.exit(1)
})
