import { createDbClient } from './lib/db.mjs'

const client = await createDbClient()

// Check trigger
const trig = await client.query(
  `SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'on_auth_user_created'`
)
console.log('Trigger state:', trig.rows)

// Check function
const fn = await client.query(
  `SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user'`
)
console.log('handle_new_user exists:', fn.rows.length > 0)
if (fn.rows.length > 0) console.log('Body:', fn.rows[0].prosrc.slice(0, 200))

// Check user_role enum
const enm = await client.query(
  `SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_type.oid = pg_enum.enumtypid WHERE pg_type.typname = 'user_role'`
)
console.log('user_role values:', enm.rows.map(r => r.enumlabel))

// Check if public.users table exists
const tbl = await client.query(
  `SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' ORDER BY ordinal_position`
)
console.log('public.users columns:', tbl.rows.map(r => r.column_name))

// Try to manually simulate what the trigger does
console.log('\nTesting insert into public.users...')
try {
  await client.query(`ALTER TABLE public.users DISABLE ROW LEVEL SECURITY`)
  await client.query(`
    INSERT INTO public.users (id, email, full_name, role, company_id, is_active)
    VALUES ('00000000-0000-0000-0000-000000000001', 'test@test.com', 'Test', 'super_admin', NULL, true)
    ON CONFLICT (id) DO NOTHING
  `)
  console.log('✅ Direct insert works')
  await client.query(`DELETE FROM public.users WHERE id = '00000000-0000-0000-0000-000000000001'`)
} catch (e) {
  console.log('❌ Insert failed:', e.message)
} finally {
  await client.query(`ALTER TABLE public.users ENABLE ROW LEVEL SECURITY`)
}

await client.end()
