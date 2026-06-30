/**
 * Aplica migraciones 031 y 032 (catalogo multimarca + maquina de estados).
 * Uso: node scripts/apply-migrations-031-032.mjs [DB_PASSWORD]
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getDbPassword, createDbClient } from './lib/db.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const password = getDbPassword(process.argv[2])

const migrations = [
  '031_multibrand_protocol_catalog.sql',
  '032_device_event_state_indexes.sql',
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
  }
}

await client.end()
console.log('Listo.')
