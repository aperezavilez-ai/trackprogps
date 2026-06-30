/**
 * Aplica migración 030 (modelo híbrido mobile / hardware).
 * Uso: node scripts/apply-migrations-030.mjs [DB_PASSWORD]
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { getDbPassword, createDbClient } from './lib/db.mjs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const password = getDbPassword(process.argv[2])

async function run() {
  const client = await createDbClient(password)

  process.stdout.write('030 enum values ... ')
  try {
    await client.query(`ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'personal_mobile'`)
    await client.query(`ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'familia_mobile'`)
    console.log('OK')
  } catch (err) {
    console.log(err instanceof Error ? err.message.slice(0, 300) : String(err))
  }

  await client.end()

  const client2 = await createDbClient(password)
  const body = readFileSync(join(__dirname, '..', 'supabase', 'migrations', '030_hybrid_mobile_plans.sql'), 'utf8')
  const sqlBody = body
    .replace(/ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'personal_mobile';\s*/g, '')
    .replace(/ALTER TYPE plan_type ADD VALUE IF NOT EXISTS 'familia_mobile';\s*/g, '')

  process.stdout.write('030_hybrid_mobile_plans.sql ... ')
  try {
    await client2.query(sqlBody)
    console.log('OK')
  } catch (err) {
    console.log(err instanceof Error ? err.message.slice(0, 500) : String(err))
  }

  await client2.end()
  console.log('Listo.')
}

run()
