/**
 * Lista usuarios y empresas en la BD
 */
import { createDbClient } from './lib/db.mjs'
import { loadRootEnv } from './lib/load-env.mjs'

loadRootEnv()

const client = await createDbClient()

const users = await client.query(`
  SELECT u.id, u.email, u.role, u.company_id, c.name AS company, c.status
  FROM public.users u
  LEFT JOIN companies c ON c.id = u.company_id
  ORDER BY u.email
`)
console.log('USERS:', users.rows.length)
for (const r of users.rows) {
  console.log(`  ${r.email} | ${r.role} | ${r.company ?? '-'} | ${r.status ?? ''}`)
}

const cos = await client.query(`SELECT id, name, email, status FROM companies ORDER BY name`)
console.log('\nCOMPANIES:', cos.rows.length)
for (const r of cos.rows) {
  console.log(`  ${r.name} | ${r.email} | ${r.status}`)
}

const auth = await client.query(`SELECT id, email FROM auth.users ORDER BY email`)
console.log('\nAUTH USERS:', auth.rows.length)
for (const r of auth.rows) {
  console.log(`  ${r.email}`)
}

await client.end()
