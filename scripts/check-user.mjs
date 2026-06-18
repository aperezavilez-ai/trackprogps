import { createDbClient } from './lib/db.mjs'

const client = await createDbClient()

// Check if user exists in public.users
const u = await client.query(`
  SELECT id, email, role, company_id, is_active
  FROM public.users
  WHERE email = 'alfonsoavilery@icloud.com'
`)
console.log('public.users:', u.rows)

// Check auth.users
const a = await client.query(`
  SELECT id, email, confirmed_at
  FROM auth.users
  WHERE email = 'alfonsoavilery@icloud.com'
`)
console.log('auth.users:', a.rows)

// Check if RLS is enabled on users
const rls = await client.query(`
  SELECT relname, relrowsecurity FROM pg_class
  WHERE relname = 'users' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
`)
console.log('RLS on users:', rls.rows)

// Test the exact query that dashboard layout runs
const q = await client.query(`
  SELECT u.*, 
    row_to_json(c.*) as company
  FROM users u
  LEFT JOIN companies c ON c.id = u.company_id
  WHERE u.id = (SELECT id FROM auth.users WHERE email = 'alfonsoavilery@icloud.com')
`)
console.log('Dashboard query result:', JSON.stringify(q.rows[0], null, 2))

await client.end()
