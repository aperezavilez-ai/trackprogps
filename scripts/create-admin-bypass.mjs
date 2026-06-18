/**
 * create-admin-bypass.mjs
 * Crea admin cambiando el trigger a NO-OP temporalmente
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
  // Make trigger a no-op
  console.log('⏸  Haciendo trigger no-op...')
  await client.query(`
    CREATE OR REPLACE FUNCTION handle_new_user()
    RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN RETURN NEW; END;
    $$
  `)
  console.log('✅ Trigger temporalmente desactivado')

  // Disable RLS too
  await client.query(`ALTER TABLE public.users DISABLE ROW LEVEL SECURITY`)

  // Create auth user
  console.log('\n👤 Creando usuario en auth...')
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
    console.error('Error auth:', JSON.stringify(data, null, 2))
    throw new Error('Auth API failed')
  }

  const userId = data.id
  console.log(`✅ Auth user: ${userId}`)

  // Create profile manually
  console.log('📝 Creando perfil en public.users...')
  await client.query(`
    INSERT INTO public.users (id, email, full_name, role, company_id, is_active)
    VALUES ($1, $2, $3, 'super_admin', NULL, true)
    ON CONFLICT (id) DO UPDATE SET role = 'super_admin', full_name = $3, company_id = NULL
  `, [userId, ADMIN_EMAIL, ADMIN_NAME])
  console.log('✅ Perfil creado')

} finally {
  // Restore real trigger
  console.log('\n🔧 Restaurando trigger real...')
  await client.query(`
    CREATE OR REPLACE FUNCTION handle_new_user()
    RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
    BEGIN
      INSERT INTO public.users (id, email, full_name, role, company_id, is_active)
      VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
        COALESCE((NEW.raw_user_meta_data->>'role')::user_role, 'operador'),
        NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid,
        true
      )
      ON CONFLICT (id) DO NOTHING;
      RETURN NEW;
    END;
    $$
  `)
  await client.query(`ALTER TABLE public.users ENABLE ROW LEVEL SECURITY`)
  await client.end()
  console.log('✅ Todo restaurado')
}

console.log('\n🎉 ¡Super admin creado!')
console.log(`   Email:    ${ADMIN_EMAIL}`)
console.log(`   Password: ${ADMIN_PASSWORD}`)
console.log(`   Role:     super_admin`)
console.log(`\n👉 https://trackprogps.mx/login`)
