/**
 * Comprueba dominios Resend y sugiere RESEND_FROM_EMAIL.
 * Uso: node scripts/check-resend-domain.mjs
 */
import { loadRootEnv } from './lib/load-env.mjs'

loadRootEnv()

const key = process.env.RESEND_API_KEY
if (!key) {
  console.error('Falta RESEND_API_KEY en .env')
  process.exit(1)
}

const res = await fetch('https://api.resend.com/domains', {
  headers: { Authorization: `Bearer ${key}` },
})
const data = await res.json()

if (!res.ok) {
  console.error('Error Resend:', data)
  process.exit(1)
}

const verified = (data.data ?? []).filter(d => d.status === 'verified')
console.log('Dominios verificados:')
for (const d of verified) {
  console.log(`  - ${d.name}`)
}

if (verified.length === 0) {
  const pending = (data.data ?? []).filter(d => d.status !== 'verified')
  console.log('\nSin dominios verificados.')
  if (pending.length > 0) {
    console.log('Pendientes — agrega DNS y ejecuta: node scripts/setup-resend-domain.mjs --verify')
    for (const d of pending) console.log(`  - ${d.name} (${d.status})`)
  } else {
    console.log('Ejecuta: node scripts/setup-resend-domain.mjs')
  }
  process.exit(1)
}

const domain = verified[0].name
console.log('\nRecomendado en .env:')
console.log(`RESEND_FROM_EMAIL=alertas@${domain}`)
console.log(`RESEND_FROM_NOREPLY=noreply@${domain}`)
console.log(`RESEND_FROM_BILLING=facturacion@${domain}`)
