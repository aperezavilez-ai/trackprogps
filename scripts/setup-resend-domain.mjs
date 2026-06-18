/**
 * Configura trackprogps.mx en Resend e imprime registros DNS para Neubox.
 * Uso: node scripts/setup-resend-domain.mjs [--verify]
 */
import { loadRootEnv } from './lib/load-env.mjs'

loadRootEnv()

const key = process.env.RESEND_API_KEY
if (!key) {
  console.error('Falta RESEND_API_KEY en .env')
  process.exit(1)
}

const headers = { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }
const DOMAIN = 'trackprogps.mx'

async function listDomains() {
  const res = await fetch('https://api.resend.com/domains', { headers })
  const data = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(data))
  return data.data ?? []
}

async function addDomain() {
  const res = await fetch('https://api.resend.com/domains', {
    method: 'POST',
    headers,
    body: JSON.stringify({ name: DOMAIN, region: 'us-east-1' }),
  })
  const data = await res.json()
  if (!res.ok && res.status !== 409) throw new Error(JSON.stringify(data))
  return data
}

async function getDomain(id) {
  const res = await fetch(`https://api.resend.com/domains/${id}`, { headers })
  const data = await res.json()
  if (!res.ok) throw new Error(JSON.stringify(data))
  return data
}

async function verifyDomain(id) {
  const res = await fetch(`https://api.resend.com/domains/${id}/verify`, {
    method: 'POST',
    headers,
  })
  const data = await res.json()
  return { ok: res.ok, data }
}

function printDnsInstructions(domain) {
  console.log('\n=== Registros DNS en Neubox (trackprogps.mx) ===')
  console.log('Panel: clientes.neubox.com → Mis dominios → trackprogps.mx → Administrar DNS / Zona DNS\n')
  console.log('En Neubox el campo "Host" es solo el subdominio (sin .trackprogps.mx):\n')
  for (const r of domain.records ?? []) {
    const host = r.name === '@' ? '@ (raíz)' : r.name
    const fqdn = r.name === '@' ? DOMAIN : `${r.name}.${DOMAIN}`
    console.log(`Tipo: ${r.type}  |  Host: ${host}  |  FQDN: ${fqdn}`)
    console.log(`Valor: ${r.value}`)
    if (r.priority != null) console.log(`Prioridad: ${r.priority}`)
    console.log(`Estado Resend: ${r.status}\n`)
  }
  console.log('Opcional (recomendado) — DMARC:')
  console.log('  Tipo: TXT  |  Host: _dmarc  |  Valor: v=DMARC1; p=none; rua=mailto:alertas@trackprogps.mx\n')
  console.log('Nota: si los nameservers no son de Neubox, los cambios deben hacerse donde apunte el DNS.')
  console.log('Después de guardar, espera 5–30 min y ejecuta:')
  console.log('  npm run setup:resend -- --verify\n')
}

let domains = await listDomains()
let entry = domains.find(d => d.name === DOMAIN)

if (!entry) {
  console.log(`Añadiendo ${DOMAIN} en Resend...`)
  const added = await addDomain()
  entry = added.id ? added : domains.find(d => d.name === DOMAIN)
  if (!entry?.id) {
    domains = await listDomains()
    entry = domains.find(d => d.name === DOMAIN)
  }
}

if (!entry?.id) {
  console.error('No se pudo obtener el dominio en Resend.')
  process.exit(1)
}

const detail = await getDomain(entry.id)
console.log(`Dominio: ${detail.name}`)
console.log(`Estado: ${detail.status}`)

printDnsInstructions(detail)

if (process.argv.includes('--verify')) {
  console.log('Solicitando verificación en Resend...')
  const { ok, data } = await verifyDomain(entry.id)
  console.log(ok ? 'Verificación iniciada.' : 'Error:', JSON.stringify(data, null, 2))
  const updated = await getDomain(entry.id)
  console.log(`Estado actual: ${updated.status}`)
  if (updated.status === 'verified') {
    console.log('\n✓ Dominio verificado. Actualiza .env:')
    console.log('RESEND_FROM_EMAIL=alertas@trackprogps.mx')
    console.log('RESEND_FROM_NOREPLY=noreply@trackprogps.mx')
    console.log('RESEND_FROM_BILLING=facturacion@trackprogps.mx')
  }
}
