/**
 * fix-rls-and-admin.mjs
 * 1. Corrige política users_insert para que el trigger pueda operar
 * 2. Crea el super admin
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

// Step 1: Fix users_insert policy to allow triggers
console.log('🔧 Corrigiendo políticas RLS...')

await client.query(`DROP POLICY IF EXISTS "users_insert" ON public.users`)
await client.query(`
  CREATE POLICY "users_insert" ON public.users
    FOR INSERT WITH CHECK (
      -- Allow trigger (supabase_auth_admin or postgres runs it)
      current_user IN ('postgres', 'supabase_auth_admin', 'supabase_admin') OR
      public.is_super_admin() OR
      (
        company_id = public.get_company_id() AND
        public.get_user_role() IN ('admin_empresa', 'supervisor')
      )
    )
`)
console.log('✅ Política users_insert corregida')

// Also fix handle_new_user trigger (restore clean version)
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
  $$;
`)
console.log('✅ Trigger handle_new_user actualizado')

// Step 2: Create admin user
console.log('\n👤 Creando super admin...')
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
  if (JSON.stringify(data).toLowerCase().includes('already')) {
    console.log('   Usuario ya existía, actualizando perfil...')
    const list = await fetch(
      `${SUPABASE_URL}/auth/v1/admin/users?page=1&per_page=100`,
      { headers: { 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY } }
    )
    const listData = await list.json()
    const found = listData.users?.find(u => u.email === ADMIN_EMAIL)
    if (!found) throw new Error('No se encontró el usuario')
    userId = found.id
  } else {
    throw new Error('Auth error: ' + JSON.stringify(data))
  }
} else {
  userId = data.id
  console.log(`✅ Usuario creado en auth: ${userId}`)
}

// Step 3: Ensure super_admin role in profile
console.log('📝 Actualizando rol a super_admin...')
const upd = await client.query(`
  INSERT INTO public.users (id, email, full_name, role, company_id, is_active)
  VALUES ($1, $2, $3, 'super_admin', NULL, true)
  ON CONFLICT (id) DO UPDATE SET role = 'super_admin', company_id = NULL, full_name = $3
`, [userId, ADMIN_EMAIL, ADMIN_NAME])
console.log('✅ Perfil super_admin listo')

await client.end()

console.log(`\n🎉 ¡Todo listo!\n`)
console.log(`   Email:    ${ADMIN_EMAIL}`)
console.log(`   Password: ${ADMIN_PASSWORD}`)
console.log(`   Role:     super_admin`)
console.log(`\n👉 Login: https://trackprogps.mx/login\n`)
