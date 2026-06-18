/**
 * Despliega edge functions de Supabase vía CLI.
 * Requiere: npx supabase login (o SUPABASE_ACCESS_TOKEN en .env)
 *
 * Uso: node scripts/deploy-edge-functions.mjs
 */
import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PROJECT_REF = 'chegfmvgsohvofdmjslb'

const FUNCTIONS = [
  'send-alert-notification',
  'send-invitation-email',
  'send-payment-failed-email',
]

function loadEnv() {
  try {
    const raw = readFileSync(join(ROOT, '.env'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/)
      if (m) process.env[m[1]] = m[2].trim()
    }
  } catch { /* optional */ }
}

loadEnv()

const token = process.env.SUPABASE_ACCESS_TOKEN
if (token) process.env.SUPABASE_ACCESS_TOKEN = token

console.log(`Desplegando ${FUNCTIONS.length} funciones en ${PROJECT_REF}...\n`)

for (const fn of FUNCTIONS) {
  try {
    execSync(
      `npx supabase functions deploy ${fn} --project-ref ${PROJECT_REF}`,
      { cwd: ROOT, stdio: 'inherit', env: { ...process.env } }
    )
    console.log(`✅ ${fn}\n`)
  } catch {
    console.error(`❌ ${fn} — ejecuta: npx supabase login\n`)
    process.exit(1)
  }
}

console.log('Sincronizando secrets desde .env...')
try {
  execSync('node scripts/sync-edge-secrets.mjs', { cwd: ROOT, stdio: 'inherit', env: { ...process.env } })
} catch {
  console.log('Secrets no sincronizados — configura manualmente o ejecuta: node scripts/sync-edge-secrets.mjs')
}
