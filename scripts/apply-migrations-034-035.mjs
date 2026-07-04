/**
 * Aplica migraciones 034-035 (saldo chip y alertas de recarga SIM).
 * Uso: node scripts/apply-migrations-034-035.mjs [DB_PASSWORD]
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getDbPassword, createDbClient } from './lib/db.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const password = getDbPassword(process.argv[2])

const migrations = [
  '034_device_sim_recharges.sql',
  '035_device_sim_recharges.sql',
]

const client = await createDbClient(password)

for (const migration of migrations) {
  const sql = readFileSync(join(__dirname, '..', 'supabase', 'migrations', migration), 'utf8')
  process.stdout.write(`${migration} ... `)
  try {
    await client.query(sql)
    console.log('OK')
  } catch (err) {
    console.log(err instanceof Error ? err.message.slice(0, 700) : String(err))
    await client.end()
    process.exitCode = 1
    process.exit()
  }
}

await client.end()
console.log('Listo.')
