/**
 * Aplica migracion 033 (estado inicial de moviles).
 * Uso: node scripts/apply-migrations-033.mjs [DB_PASSWORD]
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getDbPassword, createDbClient } from './lib/db.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const password = getDbPassword(process.argv[2])

const migration = '033_mobile_initial_status.sql'
const sql = readFileSync(join(__dirname, '..', 'supabase', 'migrations', migration), 'utf8')
const client = await createDbClient(password)

process.stdout.write(`${migration} ... `)
try {
  await client.query(sql)
  console.log('OK')
} catch (err) {
  console.log(err instanceof Error ? err.message.slice(0, 700) : String(err))
}

await client.end()
console.log('Listo.')
