/**
 * Backfill notification emails for existing companies.
 * Sets notification_email + notification_email_secondary from company/admin emails.
 *
 * Uso: node scripts/backfill-notification-emails.mjs
 */
import { createDbClient } from './lib/db.mjs'

const client = await createDbClient()

const { rows: companies } = await client.query(`
  SELECT c.id, c.email AS company_email, c.settings
  FROM companies c
`)

let updated = 0

for (const company of companies) {
  const { rows: admins } = await client.query(
    `SELECT email FROM users
     WHERE company_id = $1 AND role IN ('admin_empresa', 'super_admin') AND is_active IS NOT FALSE
     ORDER BY created_at ASC
     LIMIT 1`,
    [company.id],
  )

  const adminEmail = admins[0]?.email?.trim().toLowerCase() ?? null
  const companyEmail = company.company_email?.trim().toLowerCase() ?? null
  const settings = company.settings ?? {}

  const next = { ...settings }
  let changed = false

  if (!next.notification_email && companyEmail) {
    next.notification_email = companyEmail
    changed = true
  }

  const primary = (next.notification_email ?? companyEmail)?.toLowerCase()
  if (adminEmail && adminEmail !== primary && !next.notification_email_secondary) {
    next.notification_email_secondary = adminEmail
    changed = true
  }

  if (changed) {
    await client.query(
      `UPDATE companies SET settings = $1::jsonb WHERE id = $2`,
      [JSON.stringify(next), company.id],
    )
    updated++
    console.log(`✓ ${company.id} → ${next.notification_email}${next.notification_email_secondary ? ` + ${next.notification_email_secondary}` : ''}`)
  }
}

await client.end()
console.log(`\nListo: ${updated} empresas actualizadas de ${companies.length}`)
