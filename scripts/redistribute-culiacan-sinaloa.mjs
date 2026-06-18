import { createDbClient } from './lib/db.mjs'

const client = await createDbClient()

const CULIACAN_ZONES = [
  { lat: 24.809, lng: -107.394 },
  { lat: 24.793, lng: -107.410 },
  { lat: 24.840, lng: -107.360 },
  { lat: 24.760, lng: -107.430 },
  { lat: 24.820, lng: -107.450 },
]

const randFloat = (min, max) => Math.random() * (max - min) + min
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min

async function main() {
  const { rows } = await client.query(
    'SELECT vehicle_id FROM public.vehicle_positions ORDER BY recorded_at DESC LIMIT 80'
  )

  let i = 0
  for (const row of rows) {
    const zone = CULIACAN_ZONES[i % CULIACAN_ZONES.length]
    const lat = zone.lat + randFloat(-0.09, 0.09)
    const lng = zone.lng + randFloat(-0.09, 0.09)
    const speed = Math.random() > 0.45 ? randFloat(25, 85) : 0
    const heading = randInt(0, 359)
    const ignition = speed > 0

    await client.query(
      `UPDATE public.vehicle_positions
       SET lat = $1, lng = $2, speed = $3, heading = $4, ignition = $5, recorded_at = NOW()
       WHERE vehicle_id = $6`,
      [lat, lng, speed, heading, ignition, row.vehicle_id]
    )
    i++
  }

  await client.end()
  console.log(`updated ${i} vehicles around Culiacan, Sinaloa`)
}

main().catch(async (err) => {
  console.error(err)
  try { await client.end() } catch {}
  process.exit(1)
})
