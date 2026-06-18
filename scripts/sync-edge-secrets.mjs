/**
 * Sincroniza secrets de edge functions desde .env raíz.
 * Uso: node scripts/sync-edge-secrets.mjs
 */
import { execSync } from 'child_process'
import { loadRootEnv, PROJECT_REF } from './lib/load-env.mjs'

loadRootEnv()

const SECRETS = [
  'RESEND_API_KEY',
  'RESEND_FROM_EMAIL',
  'RESEND_FROM_NOREPLY',
  'RESEND_FROM_BILLING',
  'WHATSAPP_TOKEN',
  'WHATSAPP_PHONE_ID',
  'FCM_SERVER_KEY',
]

const PLACEHOLDER = /^(your_|EAAa\.\.\.|AAAA\.\.\.|1234567890$|sk_test_|whsec_|re_\.\.\.)/i

function isRealValue(key, val) {
  if (!val || val.length < 8) return false
  if (PLACEHOLDER.test(val)) return false
  if (key === 'WHATSAPP_PHONE_ID' && val === '1234567890') return false
  return true
}

const toSet = SECRETS.filter(k => isRealValue(k, process.env[k]))

if (toSet.length === 0) {
  console.log('No hay secrets válidos en .env para sincronizar.')
  process.exit(0)
}

const args = toSet.map(k => `${k}=${process.env[k]}`).join(' ')
console.log(`Sincronizando ${toSet.length} secrets en ${PROJECT_REF}: ${toSet.join(', ')}`)

try {
  execSync(`npx supabase secrets set ${args} --project-ref ${PROJECT_REF}`, {
    stdio: 'inherit',
    env: { ...process.env },
  })
  console.log('Secrets actualizados.')
} catch {
  console.error('Error — ejecuta: npx supabase login')
  process.exit(1)
}
