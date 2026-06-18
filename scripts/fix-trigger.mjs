/**
 * fix-trigger.mjs
 * Repara el trigger y crea el admin directamente
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

// Check postgres role attributes
const roleCheck = await client.query(
  `SELECT rolbypassrls, rolsuper FROM pg_roles WHERE rolname = 'postgres'`
)
console.log('postgres role:', roleCheck.rows[0])

// Fix: Update trigger function to use SET LOCAL row_security = OFF
console.log('\n🔧 Actualizando trigger handle_new_user...')
await client.query(`
  CREATE OR REPLACE FUNCTION handle_new_user()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
  BEGIN
    SET LOCAL row_security = off;
    INSERT INTO public.users (id, email, full_name, role, company_id, is_active)
    VALUES (
      NEW.id,
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
      COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'operador'),
      NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid,
      true
    );
    RETURN NEW;
  END;
  $$;
`)
console.log('✅ Trigger actualizado con SET LOCAL row_security = off')

// Create auth user
console.log('\n👤 Creando usuario admin...')
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
  if (JSON.stringify(data).includes('already')) {
    console.log('⚠️  Ya existe, obteniendo ID...')
    const list = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=50`,
      { headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY } }
    )
    const listData = await list.json()
    const found = listData.users?.find(u => u.email === ADMIN_EMAIL)
    if (!found) throw new Error('Usuario no encontrado: ' + JSON.stringify(listData).slice(0,200))
    userId = found.id
    // Update profile
    await client.query(`
      UPDATE public.users SET role = 'super_admin', full_name = $2, company_id = NULL
      WHERE id = $1
    `, [userId, ADMIN_NAME])
    console.log('✅ Perfil actualizado a super_admin')
  } else {
    throw new Error('Auth error: ' + JSON.stringify(data))
  }
} else {
  userId = data.id
  console.log(`✅ Usuario creado: ${userId}`)
  // Ensure profile has super_admin role
  await client.query(`
    UPDATE public.users SET role = 'super_admin', company_id = NULL
    WHERE id = $1
  `, [userId])
  console.log('✅ Rol actualizado a super_admin')
}

await client.end()

console.log('\n🎉 Admin listo!')
console.log(`   Email:    ${ADMIN_EMAIL}`)
console.log(`   Password: ${ADMIN_PASSWORD}`)
console.log(`   Role:     super_admin`)
