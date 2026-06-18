/**
 * seed-demo.mjs
 * Siembra 20 empresas con vehículos, choferes, dispositivos GPS,
 * posiciones, alertas y registros de mantenimiento
 */
import { createDbClient } from './lib/db.mjs'
import { loadRootEnv } from './lib/load-env.mjs'

loadRootEnv()

const client = await createDbClient()

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

const COMPANIES = [
  { name: 'Transportes Rápido SA', rfc: 'TRA010101AAA', city: 'Tijuana' },
  { name: 'Flota Norte Express', rfc: 'FNE020202BBB', city: 'Mexicali' },
  { name: 'Logística del Pacífico', rfc: 'LDP030303CCC', city: 'La Paz' },
  { name: 'Carga Segura Méx', rfc: 'CSM040404DDD', city: 'Los Cabos' },
  { name: 'Distribuidora Azteca', rfc: 'DAZ050505EEE', city: 'Hermosillo' },
  { name: 'Trans Bajío SA', rfc: 'TBA060606FFF', city: 'Nogales' },
  { name: 'Mudanzas Premier', rfc: 'MPR070707GGG', city: 'Ciudad Obregón' },
  { name: 'Servicios Viales MX', rfc: 'SVM080808HHH', city: 'Guaymas' },
  { name: 'Grupo Logístico Sur', rfc: 'GLS090909III', city: 'Ensenada' },
  { name: 'Autotransportes Unión', rfc: 'AUN101010JJJ', city: 'Loreto' },
  { name: 'Carga Total Express', rfc: 'CTE111111KKK', city: 'Chihuahua' },
  { name: 'Fletes y Acarreos MX', rfc: 'FAM121212LLL', city: 'Juárez' },
  { name: 'Logística Integral SA', rfc: 'LIS131313MMM', city: 'Delicias' },
  { name: 'Trans Peninsular', rfc: 'TPN141414NNN', city: 'Parral' },
  { name: 'Servicios de Carga GT', rfc: 'SCG151515OOO', city: 'Culiacán' },
  { name: 'Movimiento Urbano SA', rfc: 'MUS161616PPP', city: 'Mazatlán' },
  { name: 'Distribución Nacional', rfc: 'DNM171717QQQ', city: 'Los Mochis' },
  { name: 'Carga Exprés del Norte', rfc: 'CEN181818RRR', city: 'Guasave' },
  { name: 'Trans Occidente MX', rfc: 'TOM191919SSS', city: 'Torreón' },
  { name: 'Logística Costa SA', rfc: 'LCS202020TTT', city: 'Saltillo' },
]

const VEHICLE_BRANDS = [
  { brand: 'Kenworth', models: ['T680', 'T880', 'W990'] },
  { brand: 'Freightliner', models: ['Cascadia', 'M2', 'Century'] },
  { brand: 'International', models: ['LT', 'ProStar', 'HX'] },
  { brand: 'Volvo', models: ['VNL', 'VNR', 'FH'] },
  { brand: 'Peterbilt', models: ['389', '579', '567'] },
  { brand: 'Mercedes-Benz', models: ['Actros', 'Axor', 'Atego'] },
  { brand: 'Scania', models: ['R500', 'S730', 'P360'] },
]

const VEHICLE_TYPES = ['truck', 'van', 'pickup', 'bus']
const COLORS = ['Blanco', 'Rojo', 'Azul', 'Negro', 'Gris', 'Verde', 'Amarillo']
const DRIVER_NAMES = [
  'Carlos García', 'Miguel Hernández', 'José López', 'Luis Martínez',
  'Roberto Sánchez', 'Ana Torres', 'María Rodríguez', 'Pedro Flores',
  'Jorge Díaz', 'Fernando Jiménez', 'Alejandro Morales', 'Ricardo Reyes',
  'Eduardo Vargas', 'Sergio Castro', 'Manuel Mendoza', 'Arturo Ruiz',
  'Daniel Ortega', 'Óscar Pérez', 'Raúl Guerrero', 'Gustavo Medina',
]

// Ciudades del noroeste de México (BCN, BCS, Sonora, Chihuahua, Sinaloa)
const CITY_COORDS = {
  'Tijuana':          { lat: 32.5149, lng: -117.0382 },
  'Mexicali':         { lat: 32.6245, lng: -115.4523 },
  'La Paz':           { lat: 24.1426, lng: -110.3128 },
  'Los Cabos':        { lat: 22.8905, lng: -109.9167 },
  'Hermosillo':       { lat: 29.0729, lng: -110.9559 },
  'Nogales':          { lat: 31.3260, lng: -110.9456 },
  'Ciudad Obregón':   { lat: 27.4824, lng: -109.9387 },
  'Chihuahua':        { lat: 28.6353, lng: -106.0889 },
  'Juárez':           { lat: 31.6904, lng: -106.4245 },
  'Delicias':         { lat: 28.1931, lng: -105.4717 },
  'Culiacán':         { lat: 24.7994, lng: -107.3879 },
  'Mazatlán':         { lat: 23.2494, lng: -106.4111 },
  'Los Mochis':       { lat: 25.7930, lng: -108.9937 },
  'Guaymas':          { lat: 27.9194, lng: -110.8978 },
  'Ensenada':         { lat: 31.8667, lng: -116.5960 },
  'Loreto':           { lat: 26.0104, lng: -111.3482 },
  'Parral':           { lat: 26.9333, lng: -105.6667 },
  'Guasave':          { lat: 25.5714, lng: -108.4686 },
  'Torreón':          { lat: 25.5428, lng: -103.4068 },
  'Saltillo':         { lat: 25.4232, lng: -100.9935 },
}

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)]
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min
const randFloat = (min, max) => (Math.random() * (max - min) + min)
const uuid = () => crypto.randomUUID()

async function main() {
  console.log('✅ Conectado\n')

  // Disable RLS temporarily for bulk insert
  await client.query(`ALTER TABLE public.users DISABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE public.companies DISABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE public.vehicles DISABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE public.drivers DISABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE public.gps_devices DISABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE public.vehicle_positions DISABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE public.alerts DISABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE public.subscriptions DISABLE ROW LEVEL SECURITY`)

  // Get plan IDs
  const plansRes = await client.query(`SELECT id, type FROM plans ORDER BY price_monthly`)
  const plans = plansRes.rows
  const planBasico = plans.find(p => p.type === 'basico')?.id
  const planPro    = plans.find(p => p.type === 'profesional')?.id
  const planEmp    = plans.find(p => p.type === 'empresarial')?.id
  console.log(`📋 Planes: básico=${planBasico?.slice(0,8)} pro=${planPro?.slice(0,8)}`)

  const companyIds = []

  for (let i = 0; i < COMPANIES.length; i++) {
    const co = COMPANIES[i]
    const planId = i < 8 ? planBasico : i < 16 ? planPro : planEmp
    const coords = CITY_COORDS[co.city] || CITY_COORDS['Hermosillo']

    process.stdout.write(`\n[${i+1}/20] ${co.name}... `)

    // 1. Create company
    const compRes = await client.query(`
      INSERT INTO companies (name, rfc, email, phone, address, plan_id, status, trial_ends_at)
      VALUES ($1, $2, $3, $4, $5, $6, 'active', NOW() + INTERVAL '30 days')
      RETURNING id
    `, [
      co.name, co.rfc,
      `admin@${co.name.toLowerCase().replace(/\s+/g,'')}.mx`,
      `+52 ${randInt(100,999)} ${randInt(100,999)} ${randInt(1000,9999)}`,
      `Blvd. Industrial #${randInt(100,999)}, ${co.city}, México`,
      planId,
    ])
    const companyId = compRes.rows[0].id
    companyIds.push(companyId)

    // 2. Create subscription
    await client.query(`
      INSERT INTO subscriptions (company_id, plan_id, status, current_period_end)
      VALUES ($1, $2, 'active', NOW() + INTERVAL '30 days')
    `, [companyId, planId])

    // 3. Create auth user for admin via API
    const adminEmail = `admin${i+1}@trackprodemo.mx`
    const adminRes = await fetch(`${SUPABASE_URL}/auth/v1/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_ROLE_KEY}`, 'apikey': SERVICE_ROLE_KEY },
      body: JSON.stringify({
        email: adminEmail, password: 'Demo1234!',
        email_confirm: true,
        user_metadata: { full_name: `Admin ${co.name}`, role: 'admin_empresa', company_id: companyId },
      }),
    })
    const adminData = await adminRes.json()
    if (adminRes.ok) {
      await client.query(`
        INSERT INTO public.users (id, company_id, email, full_name, role, is_active)
        VALUES ($1, $2, $3, $4, 'admin_empresa', true)
        ON CONFLICT (id) DO UPDATE SET company_id=$2, role='admin_empresa'
      `, [adminData.id, companyId, adminEmail, `Admin ${co.name}`])
    }

    // 4. Create 20 drivers
    const driverIds = []
    for (let d = 0; d < 20; d++) {
      const dName = DRIVER_NAMES[d] + ` ${i+1}`
      const drRes = await client.query(`
        INSERT INTO drivers (company_id, full_name, phone, email, license_num, license_exp, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, true)
        RETURNING id
      `, [
        companyId, dName,
        `+52 55 ${randInt(1000,9999)} ${randInt(1000,9999)}`,
        `${dName.toLowerCase().replace(/\s+/g,'.')}@demo.mx`,
        `MX-A-${randInt(100000,999999)}`,
        `${2025 + randInt(0,3)}-${String(randInt(1,12)).padStart(2,'0')}-${String(randInt(1,28)).padStart(2,'0')}`,
      ])
      driverIds.push(drRes.rows[0].id)
    }

    // 5. Create 20 vehicles + devices + positions
    for (let v = 0; v < 20; v++) {
      const brandData = rand(VEHICLE_BRANDS)
      const model = rand(brandData.models)
      const year = randInt(2018, 2024)
      const driverId = driverIds[v]
      const status = v < 16 ? 'active' : v < 18 ? 'maintenance' : 'inactive'

      // GPS Device
      const imei = `3527${randInt(10000000, 99999999)}${randInt(1000, 9999)}`
      const devRes = await client.query(`
        INSERT INTO gps_devices (company_id, imei, model, status, last_seen)
        VALUES ($1, $2, 'FMC920', 'online', NOW() - INTERVAL '${randInt(0,30)} minutes')
        RETURNING id
      `, [companyId, imei])
      const deviceId = devRes.rows[0].id

      // Vehicle
      const ecoNum = `ECO-${String(i+1).padStart(2,'0')}${String(v+1).padStart(2,'0')}`
      const plates = `${String.fromCharCode(65+randInt(0,25))}${String.fromCharCode(65+randInt(0,25))}${String.fromCharCode(65+randInt(0,25))}-${randInt(100,999)}-${String.fromCharCode(65+randInt(0,25))}`
      const odo = randInt(50000, 400000)

      const vehRes = await client.query(`
        INSERT INTO vehicles (company_id, device_id, driver_id, economic_num, plates, brand, model, year, color, type, status, odometer_offset)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0)
        RETURNING id
      `, [companyId, deviceId, driverId, ecoNum, plates, brandData.brand, model, year, rand(COLORS), rand(VEHICLE_TYPES), status])
      const vehicleId = vehRes.rows[0].id

      // Live position (small random offset from city center)
      if (status === 'active') {
        const isMoving = v < 12
        const speed = isMoving ? randFloat(40, 95) : 0
        const lat = coords.lat + randFloat(-0.35, 0.35)
        const lng = coords.lng + randFloat(-0.35, 0.35)

        await client.query(`
          INSERT INTO vehicle_positions (vehicle_id, company_id, device_id, lat, lng, speed, heading, ignition, odometer, gsm_signal, battery_lvl, recorded_at, server_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW() - INTERVAL '${randInt(0,5)} minutes', NOW())
          ON CONFLICT (vehicle_id) DO UPDATE SET lat=$4, lng=$5, speed=$6, ignition=$8, recorded_at=NOW() - INTERVAL '${randInt(0,5)} minutes'
        `, [vehicleId, companyId, deviceId, lat, lng, speed, randInt(0,360), isMoving, odo, randInt(1,5), randInt(60,100)])
      }
    }

    // 6. Create some alerts
    const alertTypes = ['speed_excess','geofence_exit','signal_loss','ignition_on','ignition_off']
    const severities = ['low','medium','high','critical']
    for (let a = 0; a < randInt(3, 8); a++) {
      const vehIds = await client.query(`SELECT id FROM vehicles WHERE company_id=$1 LIMIT 5`, [companyId])
      if (vehIds.rows.length === 0) continue
      const vId = rand(vehIds.rows).id
      const aType = rand(alertTypes)
      await client.query(`
        INSERT INTO alerts (company_id, vehicle_id, type, severity, title, message, lat, lng, speed, payload, channels_sent, acknowledged_at)
        VALUES ($1,$2,$3::alert_type,$4::alert_severity,$5,$6,$7,$8,$9,'{}',ARRAY[]::text[],null)
      `, [
        companyId, vId, aType, rand(severities),
        aType.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
        `Alerta detectada en vehículo de ${co.name}`,
        coords.lat + randFloat(-0.1,0.1), coords.lng + randFloat(-0.1,0.1),
        aType === 'speed_excess' ? randFloat(85,120) : null,
      ])
    }

    process.stdout.write(`✅`)
  }

  // Re-enable RLS
  console.log('\n\n🔒 Reactivando RLS...')
  await client.query(`ALTER TABLE public.users ENABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE public.vehicles ENABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE public.drivers ENABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE public.gps_devices ENABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE public.vehicle_positions ENABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY`)
  await client.query(`ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY`)

  await client.end()

  console.log('\n\n🎉 Seed completado:')
  console.log('   20 empresas creadas')
  console.log('   20 usuarios admin (admin1@trackprodemo.mx ... admin20@trackprodemo.mx)')
  console.log('   400 vehículos con dispositivos GPS')
  console.log('   400 choferes')
  console.log('   ~320 posiciones GPS activas')
  console.log('   ~100 alertas de prueba')
  console.log('\n   Password de todos los admins: Demo1234!')
}

main().catch(async e => {
  console.error('\n❌', e.message)
  try {
    await client.query(`ALTER TABLE public.users ENABLE ROW LEVEL SECURITY`)
    await client.query(`ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY`)
  } catch {}
  await client.end()
  process.exit(1)
})
