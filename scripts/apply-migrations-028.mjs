/**
 * Aplica migración 028 (batch positions RPC).
 * Uso: node scripts/apply-migrations-028.mjs [DB_PASSWORD]
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getDbPassword, createDbClient } from './lib/db.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const password = getDbPassword(process.argv[2])
const sql = readFileSync(join(__dirname, '..', 'supabase', 'migrations', '028_batch_positions_rpc.sql'), 'utf8')
const client = await createDbClient(password)

process.stdout.write('028_batch_positions_rpc.sql ... ')
try {
  await client.query(sql)
  console.log('OK')
} catch (err) {
  console.log(err instanceof Error ? err.message.slice(0, 400) : String(err))
}

await client.end()
console.log('Listo.')
