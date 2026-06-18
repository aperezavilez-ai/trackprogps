/**
 * Elimina empresas de prueba y usuarios excepto el super_admin (ADMIN_EMAIL).
 *
 * Uso: node scripts/purge-test-accounts.mjs
 *      node scripts/purge-test-accounts.mjs --dry-run
 */
import { createDbClient } from './lib/db.mjs'
import { loadRootEnv } from './lib/load-env.mjs'

loadRootEnv()

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'alfonsoavilery@icloud.com').toLowerCase()
const dryRun = process.argv.includes('--dry-run')

const client = await createDbClient()

try {
  const admin = await client.query(
    `SELECT id, email, role, company_id FROM public.users WHERE lower(email) = $1`,
    [ADMIN_EMAIL],
  )
  if (!admin.rows.length) {
    console.error(`❌ No existe el admin ${ADMIN_EMAIL}. Ejecuta create-admin-final.mjs primero.`)
    process.exit(1)
  }
  const adminId = admin.rows[0].id
  console.log(`✓ Admin a conservar: ${ADMIN_EMAIL} (${adminId})`)

  const before = await client.query(`SELECT count(*)::int AS n FROM companies`)
  const authBefore = await client.query(`SELECT email FROM auth.users ORDER BY email`)
  const usersBefore = await client.query(`SELECT email, role FROM public.users ORDER BY email`)

  console.log(`\nAntes: ${before.rows[0].n} empresas, ${authBefore.rows.length} auth users, ${usersBefore.rows.length} perfiles`)

  if (dryRun) {
    console.log('\n[DRY RUN] Se eliminarían:')
    const cos = await client.query(`SELECT name, email, status FROM companies ORDER BY name`)
    for (const c of cos.rows) console.log(`  - Empresa: ${c.name} (${c.status})`)
    const others = usersBefore.rows.filter(u => u.email.toLowerCase() !== ADMIN_EMAIL)
    for (const u of others) console.log(`  - Usuario: ${u.email} (${u.role})`)
    const authOthers = authBefore.rows.filter(u => u.email.toLowerCase() !== ADMIN_EMAIL)
    for (const u of authOthers) console.log(`  - Auth: ${u.email}`)
    process.exit(0)
  }

  await client.query('BEGIN')

  // Tablas sin CASCADE completo hacia companies
  await client.query(`DELETE FROM audit_logs WHERE company_id IS NOT NULL`)
  await client.query(`DELETE FROM vehicle_driver_history`)
  await client.query(`DELETE FROM alerts`)

  const deletedCos = await client.query(`DELETE FROM companies RETURNING id, name`)
  console.log(`\n✓ Empresas eliminadas: ${deletedCos.rowCount}`)

  // Perfiles huérfanos (no debería quedar ninguno excepto admin)
  const deletedUsers = await client.query(
    `DELETE FROM public.users WHERE lower(email) <> $1 RETURNING email`,
    [ADMIN_EMAIL],
  )
  if (deletedUsers.rowCount) {
    console.log(`✓ Perfiles eliminados: ${deletedUsers.rowCount}`)
    for (const r of deletedUsers.rows) console.log(`    ${r.email}`)
  }

  // Auth users excepto admin
  const deletedAuth = await client.query(
    `DELETE FROM auth.users WHERE lower(email) <> $1 RETURNING email`,
    [ADMIN_EMAIL],
  )
  if (deletedAuth.rowCount) {
    console.log(`✓ Auth eliminados: ${deletedAuth.rowCount}`)
    for (const r of deletedAuth.rows) console.log(`    ${r.email}`)
  }

  // Asegurar admin limpio
  await client.query(
    `UPDATE public.users
     SET role = 'super_admin', company_id = NULL, is_active = true, full_name = COALESCE(full_name, $2)
     WHERE id = $1`,
    [adminId, process.env.ADMIN_NAME ?? 'Alfonso Avilery'],
  )

  await client.query('COMMIT')

  const after = await client.query(`SELECT count(*)::int AS n FROM companies`)
  const authAfter = await client.query(`SELECT email FROM auth.users`)
  const usersAfter = await client.query(`SELECT email, role FROM public.users`)

  console.log(`\nDespués: ${after.rows[0].n} empresas, ${authAfter.rows.length} auth users`)
  for (const u of usersAfter.rows) console.log(`  ${u.email} | ${u.role}`)

  console.log('\n✅ Limpieza completada. Solo queda el administrador.')
} catch (err) {
  await client.query('ROLLBACK').catch(() => {})
  console.error('❌ Error:', err.message)
  process.exit(1)
} finally {
  await client.end()
}
