import { createDbClient } from './lib/db.mjs'

const c = await createDbClient()

// All triggers on auth.users
const t = await c.query(`
  SELECT tgname, tgenabled, tgtype, p.proname
  FROM pg_trigger tr
  JOIN pg_class cl ON cl.oid = tr.tgrelid
  JOIN pg_namespace ns ON ns.oid = cl.relnamespace
  JOIN pg_proc p ON p.oid = tr.tgfoid
  WHERE cl.relname = 'users' AND ns.nspname = 'auth'
`)
console.log('Triggers on auth.users:')
t.rows.forEach(r => console.log(` - ${r.tgname} (${r.proname}) enabled=${r.tgenabled}`))

// Check who owns handle_new_user
const fn = await c.query(`
  SELECT proname, proowner::regrole AS owner, prosecdef
  FROM pg_proc WHERE proname = 'handle_new_user'
`)
console.log('\nhandle_new_user:', fn.rows[0])

// Check for any issues with the function body
const full = await c.query(`SELECT prosrc FROM pg_proc WHERE proname = 'handle_new_user'`)
console.log('\nFull function body:')
console.log(full.rows[0]?.prosrc)

// Check sync_user_email trigger
const t2 = await c.query(`
  SELECT tgname, tgenabled FROM pg_trigger WHERE tgname = 'on_auth_user_email_change'
`)
console.log('\non_auth_user_email_change:', t2.rows)

await c.end()
