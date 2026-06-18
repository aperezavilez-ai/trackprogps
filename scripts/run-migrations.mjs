/**
 * run-migrations.mjs
 * Ejecuta todas las migraciones SQL en Supabase
 * Uso: node scripts/run-migrations.mjs [DB_PASSWORD]
 */
import { readFileSync } from 'fs'
import { createConnection } from 'net'
import https from 'https'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const DB_PASSWORD = process.argv[2]
if (!DB_PASSWORD) {
  console.error('❌  Uso: node scripts/run-migrations.mjs TU_DB_PASSWORD')
  console.error('   Obtén el password en: Supabase → Project Settings → Database')
  process.exit(1)
}

const PROJECT_REF = 'chegfmvgsohvofdmjslb'
const DB_HOST     = `db.${PROJECT_REF}.supabase.co`
const DB_USER     = 'postgres'
const DB_NAME     = 'postgres'
const DB_PORT     = 5432

const migrations = [
  '006b_007b_fixed.sql',
  '008_performance.sql',
  '008b_indexes_fixed.sql',
]

async function main() {
  // Dynamic import of pg (install if needed)
  let Client
  try {
    const pg = await import('pg')
    Client = pg.default.Client ?? pg.Client
  } catch {
    console.log('📦 Instalando pg...')
    const { execSync } = await import('child_process')
    execSync('npm install pg', { cwd: join(__dirname, '..'), stdio: 'inherit' })
    const pg = await import('pg')
    Client = pg.default.Client ?? pg.Client
  }

  const client = new Client({
    host:     DB_HOST,
    port:     DB_PORT,
    user:     DB_USER,
    password: DB_PASSWORD,
    database: DB_NAME,
    ssl:      { rejectUnauthorized: false },
  })

  console.log(`\n🔗 Conectando a ${DB_HOST}...`)
  await client.connect()
  console.log('✅ Conectado\n')

  for (const file of migrations) {
    const sqlPath = join(__dirname, '..', 'supabase', 'migrations', file)
    const sql     = readFileSync(sqlPath, 'utf8')
    process.stdout.write(`▶  ${file} ... `)
    try {
      await client.query(sql)
      console.log('✅')
    } catch (err) {
      const msg = err.message ?? String(err)
      if (msg.includes('already exists') || msg.includes('duplicate')) {
        console.log('⏭  (ya existe)')
      } else {
        console.log(`⚠️  ${msg.slice(0, 120)}`)
      }
    }
  }

  console.log('\n✅ Migraciones completadas')
  await client.end()
}

main().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
