/**
 * Aplica migración 024 (support tickets).
 * Uso: node scripts/apply-migrations-024.mjs [DB_PASSWORD]
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getDbPassword, createDbClient } from './lib/db.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const password = getDbPassword(process.argv[2])

const sql = readFileSync(join(__dirname, '..', 'supabase', 'migrations', '024_support_tickets.sql'), 'utf8')
const client = await createDbClient(password)

process.stdout.write('024_support_tickets.sql ... ')
try {
  await client.query(sql)
  console.log('OK')
} catch (err) {
  console.log(err instanceof Error ? err.message.slice(0, 300) : String(err))
}

await client.end()
console.log('Listo.')
