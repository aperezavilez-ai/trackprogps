/**
 * Aplica migración 018 (idle stats RPC + pg_cron).
 * Uso: node scripts/apply-migrations-018.mjs TU_DB_PASSWORD
 */
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const DB_PASSWORD = process.argv[2]

const MIGRATIONS = ['018_idle_stats_and_cron.sql']

const PROJECT_REF = 'chegfmvgsohvofdmjslb'
const DB_HOST = `db.${PROJECT_REF}.supabase.co`

async function main() {
  if (!DB_PASSWORD) {
    console.error('Uso: node scripts/apply-migrations-018.mjs TU_DB_PASSWORD')
    process.exit(1)
  }

  const pg = await import('pg')
  const Client = pg.default?.Client ?? pg.Client
  const client = new Client({
    host: DB_HOST,
    port: 5432,
    user: 'postgres',
    password: DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false },
  })

  console.log(`Conectando a ${DB_HOST}...`)
  await client.connect()

  for (const file of MIGRATIONS) {
    const sql = readFileSync(join(__dirname, '..', 'supabase', 'migrations', file), 'utf8')
    process.stdout.write(`${file} ... `)
    try {
      await client.query(sql)
      console.log('OK')
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        console.log('ya aplicada')
      } else {
        console.log(`ERROR: ${msg.slice(0, 300)}`)
      }
    }
  }

  await client.end()
  console.log('Listo.')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
