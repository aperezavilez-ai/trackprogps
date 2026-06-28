/**
 * Aplica migraciones 025 (fuel efficiency) y 026 (partition cron).
 * Uso: node scripts/apply-migrations-025-026.mjs [DB_PASSWORD]
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getDbPassword, createDbClient } from './lib/db.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const password = getDbPassword(process.argv[2])
const client = await createDbClient(password)

const files = ['025_fuel_efficiency.sql', '026_partition_cron.sql']

for (const file of files) {
  const sql = readFileSync(join(__dirname, '..', 'supabase', 'migrations', file), 'utf8')
  process.stdout.write(`${file} ... `)
  try {
    await client.query(sql)
    console.log('OK')
  } catch (err) {
    console.log(err instanceof Error ? err.message.slice(0, 300) : String(err))
  }
}

await client.end()
console.log('Listo.')
