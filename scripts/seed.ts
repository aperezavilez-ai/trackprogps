#!/usr/bin/env tsx
// ============================================================
// GPS SaaS — Seed Script (TypeScript)
// Crea datos de demo usando el cliente de Supabase
// Uso: npx tsx scripts/seed.ts
// ============================================================

import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'

config({ path: '.env.local' })

const supabase = createClient(
  process.env['NEXT_PUBLIC_SUPABASE_URL']!,
  process.env['SUPABASE_SERVICE_ROLE_KEY']!,
  { auth: { persistSession: false } }
)

// -----------------------------------------------
// VEHICLE positions simulator
// Generates realistic GPS tracks around CDMX
// -----------------------------------------------
const CDMX_CENTER = { lat: 19.4326, lng: -99.1332 }

function randomOffset(range = 0.05) {
  return (Math.random() - 0.5) * range * 2
}

function randomSpeed(driving: boolean) {
  if (!driving) return 0
  return Math.floor(Math.random() * 80) + 20 // 20-100 km/h
}

async function seedPositions(vehicleIds: string[], companyId: string) {
  console.log('📍 Seeding vehicle positions...')

  for (const vehicleId of vehicleIds) {
    const ignition = Math.random() > 0.3 // 70% chance of being on
    const driving  = ignition && Math.random() > 0.4

    const position = {
      vehicle_id:  vehicleId,
      company_id:  companyId,
      lat:         CDMX_CENTER.lat  + randomOffset(),
      lng:         CDMX_CENTER.lng  + randomOffset(),
      speed:       randomSpeed(driving),
      heading:     Math.floor(Math.random() * 360),
      altitude:    2240 + Math.floor(Math.random() * 100),
      ignition,
      odometer:    Math.floor(Math.random() * 300_000),
      gsm_signal:  Math.floor(Math.random() * 5),
      battery_lvl: Math.floor(Math.random() * 100),
      satellites:  Math.floor(Math.random() * 8) + 4,
      recorded_at: new Date().toISOString(),
    }

    const { error } = await supabase
      .from('vehicle_positions')
      .upsert(position, { onConflict: 'vehicle_id' })

    if (error) console.error(`  ❌ Error for vehicle ${vehicleId}:`, error.message)
  }

  console.log(`  ✅ Seeded ${vehicleIds.length} positions`)
}

async function seedHistoryPoints(vehicleId: string, companyId: string, hours = 8) {
  console.log(`📊 Seeding history for ${vehicleId}...`)

  const points = []
  const now    = Date.now()
  const start  = now - hours * 60 * 60 * 1000
  let   lat    = CDMX_CENTER.lat + randomOffset(0.02)
  let   lng    = CDMX_CENTER.lng + randomOffset(0.02)
  let   odo    = 240_000

  // Generate a point every 30 seconds
  const INTERVAL = 30 * 1000
  for (let t = start; t <= now; t += INTERVAL) {
    const ignition = t - start > 1000 * 60 * 10 // off for first 10 min
    const speed    = ignition ? randomSpeed(true) : 0

    // Move vehicle
    if (speed > 0) {
      lat += randomOffset(0.001)
      lng += randomOffset(0.001)
      odo += speed * (INTERVAL / 3_600_000) // km
    }

    points.push({
      vehicle_id:  vehicleId,
      company_id:  companyId,
      lat, lng,
      speed,
      heading:     Math.floor(Math.random() * 360),
      ignition,
      odometer:    Math.round(odo * 10) / 10,
      gsm_signal:  4,
      battery_lvl: 95,
      recorded_at: new Date(t).toISOString(),
    })
  }

  // Insert in batches of 500
  for (let i = 0; i < points.length; i += 500) {
    const batch = points.slice(i, i + 500)
    const { error } = await supabase.from('position_history').insert(batch)
    if (error) console.error('  ❌ History batch error:', error.message)
    else process.stdout.write('.')
  }

  console.log(`\n  ✅ Seeded ${points.length} history points`)
}

// -----------------------------------------------
// MAIN
// -----------------------------------------------
async function main() {
  console.log('🌱 TrackPro GPS — Starting seed...\n')

  // Get demo company
  const { data: company } = await supabase
    .from('companies')
    .select('id')
    .eq('email', 'admin@transportesdemo.mx')
    .single()

  if (!company) {
    console.log('⚠️  Demo company not found. Run SQL migrations first.')
    console.log('   supabase db push && supabase db execute --file supabase/seed/01_demo_data.sql')
    process.exit(1)
  }

  // Get vehicle IDs
  const { data: vehicles } = await supabase
    .from('vehicles')
    .select('id')
    .eq('company_id', company.id)

  const vehicleIds = (vehicles ?? []).map(v => v.id)
  console.log(`Found ${vehicleIds.length} vehicles for company ${company.id}`)

  // Seed real-time positions
  await seedPositions(vehicleIds, company.id)

  // Seed history for first vehicle (resource-intensive)
  if (vehicleIds[0]) {
    await seedHistoryPoints(vehicleIds[0], company.id, 8)
  }

  console.log('\n✅ Seed completado!')
  console.log('   Accede a la plataforma: http://localhost:3000')
}

main().catch(err => {
  console.error('❌ Seed error:', err)
  process.exit(1)
})
