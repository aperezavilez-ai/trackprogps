/**
 * Registra un dispositivo GPS de prueba vinculado a un vehículo (idempotente).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync, existsSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

const TEST_IMEI = '123456789012345'
const TEST_DEVICE_ID = 'd1000000-0000-4000-8000-000000000099'
const TEST_VEHICLE_ID = 'a1000000-0000-4000-8000-000000000099'

function loadEnv() {
  const envPath = join(ROOT, '.env')
  const out = {}
  if (!existsSync(envPath)) return out
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const idx = trimmed.indexOf('=')
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    let value = trimmed.slice(idx + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    out[key] = value
  }
  return out
}

async function main() {
  const env = loadEnv()
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Faltan variables Supabase en .env')

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data: user } = await supabase
    .from('users')
    .select('company_id, companies(name)')
    .eq('email', 'alfonsoavilery@icloud.com')
    .maybeSingle()

  let companyId = user?.company_id
  let companyName = user?.companies?.name

  if (!companyId) {
    const { data: company } = await supabase
      .from('companies')
      .select('id, name')
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()
    if (!company) throw new Error('No hay empresas en la base de datos')
    companyId = company.id
    companyName = company.name
  }

  console.log(`Empresa: ${companyName}`)

  const { error: devErr } = await supabase.from('gps_devices').upsert({
    id: TEST_DEVICE_ID,
    company_id: companyId,
    imei: TEST_IMEI,
    model: 'FMC920',
    status: 'unknown',
  }, { onConflict: 'imei' })

  if (devErr) throw new Error(`gps_devices: ${devErr.message}`)

  const { error: vehErr } = await supabase.from('vehicles').upsert({
    id: TEST_VEHICLE_ID,
    company_id: companyId,
    device_id: TEST_DEVICE_ID,
    economic_num: 'TEST-GPS',
    plates: 'GPS-TEST-1',
    brand: 'Teltonika',
    model: 'FMC920',
    year: 2024,
    type: 'van',
    color: 'Blanco',
    max_speed: 120,
  }, { onConflict: 'id' })

  if (vehErr) throw new Error(`vehicles: ${vehErr.message}`)

  console.log(`✓ Dispositivo de prueba listo — IMEI ${TEST_IMEI} → GPS-TEST-1`)
}

main().catch((err) => {
  console.error('❌', err.message)
  process.exit(1)
})
