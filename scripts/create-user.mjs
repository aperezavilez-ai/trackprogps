import { createDbClient } from './lib/db.mjs'
import { loadRootEnv } from './lib/load-env.mjs'

loadRootEnv()

const EMAIL    = process.env.CREATE_USER_EMAIL ?? 'monitor@gmail.com'
const PASSWORD = process.env.CREATE_USER_PASSWORD ?? 'monitor1234'
const NAME     = process.env.CREATE_USER_NAME ?? 'Monitor'
const ROLE     = process.env.CREATE_USER_ROLE ?? 'super_admin'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const client = await createDbClient()
await client.query(`ALTER TABLE public.users DISABLE ROW LEVEL SECURITY`)
await client.query(`CREATE OR REPLACE FUNCTION handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$ BEGIN RETURN NEW; END; $$`)

const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD, email_confirm: true, user_metadata: { full_name: NAME, role: ROLE } }),
})
const data = await res.json()

if (!res.ok) throw new Error(JSON.stringify(data))

await client.query(`
  INSERT INTO public.users (id, email, full_name, role, company_id, is_active)
  VALUES ($1, $2, $3, $4, NULL, true)
  ON CONFLICT (id) DO UPDATE SET role = $4, full_name = $3
`, [data.id, EMAIL, NAME, ROLE])

// Restore real trigger
await client.query(`
  CREATE OR REPLACE FUNCTION handle_new_user()
  RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
  BEGIN
    INSERT INTO public.users (id, email, full_name, role, company_id, is_active)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email,'@',1)),
      COALESCE((NEW.raw_user_meta_data->>'role')::user_role,'operador'),
      NULLIF(NEW.raw_user_meta_data->>'company_id','')::uuid, true)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END; $$
`)
await client.query(`ALTER TABLE public.users ENABLE ROW LEVEL SECURITY`)
await client.end()

console.log(`✅ Usuario creado: ${EMAIL} / ${PASSWORD} (${ROLE})`)
