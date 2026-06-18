/**
 * Aplica migración 023 — status demo en companies
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import pg from 'pg'
import { loadRootEnv } from './lib/load-env.mjs'
import { DB_HOST } from './lib/load-env.mjs'

loadRootEnv()

const __dirname = dirname(fileURLToPath(import.meta.url))
const sql = readFileSync(join(__dirname, '..', 'supabase', 'migrations', '023_company_demo_status.sql'), 'utf8')

const client = new pg.Client({
  host: DB_HOST,
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  ssl: { rejectUnauthorized: false },
})

await client.connect()
try {
  await client.query(sql)
  console.log('✅ Migración 023 aplicada (company_status demo)')
} catch (e) {
  console.error('Error:', e.message)
  process.exit(1)
} finally {
  await client.end()
}
