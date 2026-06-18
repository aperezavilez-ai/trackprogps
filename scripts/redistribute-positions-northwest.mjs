/**
 * Redistribuye vehicle_positions en el noroeste de México:
 * BCN, BCS, Sonora, Chihuahua y Sinaloa.
 *
 * Uso: node scripts/redistribute-positions-northwest.mjs
 */
import { Client } from 'pg'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

function loadEnv() {
  try {
    const raw = readFileSync(resolve(__dirname, '../.env'), 'utf8')
    for (const line of raw.split('\n')) {
      const m = line.match(/^([^#=]+)=(.*)$/)
      if (m) process.env[m[1].trim()] = m[2].trim()
    }
  } catch { /* ignore */ }
}

loadEnv()

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const host = SUPABASE_URL.replace('https://', '').replace('.supabase.co', '')

const client = new Client({
  host: `db.${host}.supabase.co`,
  port: 5432,
  user: 'postgres',
  password: process.env.SUPABASE_DB_PASSWORD,
  database: 'postgres',
  ssl: { rejectUnauthorized: false },
})

/** Ciudades repartidas en los 5 estados solicitados */
const ANCHORS = [
  // Baja California Norte
  { state: 'BCN', name: 'Tijuana',    lat: 32.5149, lng: -117.0382 },
  { state: 'BCN', name: 'Mexicali',   lat: 32.6245, lng: -115.4523 },
  { state: 'BCN', name: 'Ensenada',   lat: 31.8667, lng: -116.5960 },
  { state: 'BCN', name: 'Tecate',     lat: 32.5761, lng: -116.6258 },
  // Baja California Sur
  { state: 'BCS', name: 'La Paz',     lat: 24.1426, lng: -110.3128 },
  { state: 'BCS', name: 'Los Cabos',  lat: 22.8905, lng: -109.9167 },
  { state: 'BCS', name: 'Loreto',     lat: 26.0104, lng: -111.3482 },
  { state: 'BCS', name: 'Ciudad Constitución', lat: 25.0322, lng: -111.6663 },
  // Sonora
  { state: 'Sonora', name: 'Hermosillo',    lat: 29.0729, lng: -110.9559 },
  { state: 'Sonora', name: 'Nogales',       lat: 31.3260, lng: -110.9456 },
  { state: 'Sonora', name: 'Ciudad Obregón', lat: 27.4824, lng: -109.9387 },
  { state: 'Sonora', name: 'Guaymas',       lat: 27.9194, lng: -110.8978 },
  { state: 'Sonora', name: 'Navojoa',       lat: 27.0761, lng: -109.4431 },
  // Chihuahua
  { state: 'Chihuahua', name: 'Chihuahua',  lat: 28.6353, lng: -106.0889 },
  { state: 'Chihuahua', name: 'Juárez',     lat: 31.6904, lng: -106.4245 },
  { state: 'Chihuahua', name: 'Delicias',   lat: 28.1931, lng: -105.4717 },
  { state: 'Chihuahua', name: 'Parral',     lat: 26.9333, lng: -105.6667 },
  { state: 'Chihuahua', name: 'Cuauhtémoc', lat: 28.4078, lng: -106.8669 },
  // Sinaloa
  { state: 'Sinaloa', name: 'Culiacán',   lat: 24.7994, lng: -107.3879 },
  { state: 'Sinaloa', name: 'Mazatlán',   lat: 23.2494, lng: -106.4111 },
  { state: 'Sinaloa', name: 'Los Mochis', lat: 25.7930, lng: -108.9937 },
  { state: 'Sinaloa', name: 'Guasave',    lat: 25.5714, lng: -108.4686 },
  { state: 'Sinaloa', name: 'Guamúchil',  lat: 25.4608, lng: -108.0770 },
]

const randFloat = (min, max) => Math.random() * (max - min) + min
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

async function main() {
  await client.connect()
  console.log('✅ Conectado a Supabase\n')

  await client.query(`ALTER TABLE public.vehicle_positions DISABLE ROW LEVEL SECURITY`)

  const { rows } = await client.query(`
    SELECT vehicle_id FROM vehicle_positions ORDER BY vehicle_id
  `)

  console.log(`📍 Redistribuyendo ${rows.length} posiciones...\n`)

  let updated = 0
  const counts = {}

  for (let i = 0; i < rows.length; i++) {
    const anchor = ANCHORS[i % ANCHORS.length]
    counts[anchor.state] = (counts[anchor.state] ?? 0) + 1

    const lat = anchor.lat + randFloat(-0.35, 0.35)
    const lng = anchor.lng + randFloat(-0.35, 0.35)
    const speed = randInt(0, 1) ? randFloat(35, 90) : 0
    const heading = randInt(0, 359)
    const ignition = speed > 0

    await client.query(`
      UPDATE vehicle_positions
      SET lat = $1, lng = $2, speed = $3, heading = $4, ignition = $5,
          recorded_at = NOW() - ($6 || ' minutes')::interval
      WHERE vehicle_id = $7
    `, [lat, lng, speed, heading, ignition, String(randInt(0, 8)), rows[i].vehicle_id])

    updated++
    if (updated % 50 === 0) process.stdout.write(`  ${updated}/${rows.length}\r`)
  }

  await client.query(`ALTER TABLE public.vehicle_positions ENABLE ROW LEVEL SECURITY`)
  await client.end()

  console.log(`\n\n🎉 ${updated} posiciones actualizadas:\n`)
  for (const [state, n] of Object.entries(counts).sort()) {
    console.log(`   ${state}: ${n} unidades`)
  }
}

main().catch(async (e) => {
  console.error('\n❌', e.message)
  try { await client.end() } catch { /* ignore */ }
  process.exit(1)
})
