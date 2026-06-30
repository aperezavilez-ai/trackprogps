/**
 * Aplica migración 029 (webhooks + api request logs).
 * Uso: node scripts/apply-migrations-029.mjs [DB_PASSWORD]
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getDbPassword, createDbClient } from './lib/db.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const password = getDbPassword(process.argv[2])
const sql = readFileSync(join(__dirname, '..', 'supabase', 'migrations', '029_webhooks_api_logs.sql'), 'utf8')
const client = await createDbClient(password)

process.stdout.write('029_webhooks_api_logs.sql ... ')
try {
  await client.query(sql)
  console.log('OK')
} catch (err) {
  console.log(err instanceof Error ? err.message.slice(0, 400) : String(err))
}

await client.end()
console.log('Listo.')
