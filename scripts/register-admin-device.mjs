/**
 * Registra dispositivo del admin (hardware o móvil) en empresa sandbox.
 * Uso: node scripts/register-admin-device.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import { loadRootEnv } from './lib/load-env.mjs'

loadRootEnv()

const email = 'alfonsoavilery@icloud.com'
const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!url || !key) {
  console.error('Faltan SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env')
  process.exit(1)
}

const service = createClient(url, key, { auth: { persistSession: false } })

const DEVICE = {
  imei: '358349581752703',
  sim_iccid: '8952020520522361572',
  phone_num: '6674912221',
  firmware_ver: '4.51.04',
  model: 'TrackProGPS iPhone',
  source_type: 'mobile',
  platform: 'ios',
}

const { data: authList } = await service.auth.admin.listUsers({ page: 1, perPage: 500 })
const authUser = authList?.users.find(u => u.email?.toLowerCase() === email)
if (!authUser) {
  console.error('Usuario no encontrado:', email)
  process.exit(1)
}

const { data: userRow } = await service
  .from('users')
  .select('id, email, role, company_id')
  .eq('id', authUser.id)
  .single()

let companyId = userRow?.company_id
if (!companyId) {
  const { data: internal } = await service
    .from('companies')
    .select('id')
    .eq('email', 'interno@trackprogps.mx')
    .single()
  companyId = internal?.id
  if (companyId) {
    await service.from('users').update({ company_id: companyId }).eq('id', authUser.id)
  }
}

if (!companyId) {
  console.error('No hay empresa sandbox')
  process.exit(1)
}

// ¿Ya existe por IMEI?
const { data: existing } = await service
  .from('gps_devices')
  .select('id, imei, source_type, company_id')
  .eq('imei', DEVICE.imei)
  .maybeSingle()

if (existing) {
  await service
    .from('gps_devices')
    .update({
      company_id: companyId,
      model: DEVICE.model,
      firmware_ver: DEVICE.firmware_ver,
      sim_iccid: DEVICE.sim_iccid,
      phone_num: DEVICE.phone_num,
      source_type: DEVICE.source_type,
      mobile_platform: DEVICE.platform,
      assigned_user_id: authUser.id,
      tracking_enabled: true,
      updated_at: new Date().toISOString(),
    })
    .eq('id', existing.id)

  console.log('Dispositivo actualizado:', existing.id)
} else {
  const deviceUid = `ADM-${randomBytes(12).toString('hex')}`
  const { data: device, error } = await service
    .from('gps_devices')
    .insert({
      company_id: companyId,
      imei: DEVICE.imei,
      model: DEVICE.model,
      firmware_ver: DEVICE.firmware_ver,
      sim_iccid: DEVICE.sim_iccid,
      phone_num: DEVICE.phone_num,
      source_type: DEVICE.source_type,
      mobile_platform: DEVICE.platform,
      mobile_device_uid: deviceUid,
      assigned_user_id: authUser.id,
      tracking_enabled: true,
      tracking_interval_sec: 30,
      status: 'unknown',
    })
    .select('id')
    .single()

  if (error) {
    console.error('Error insertando:', error.message)
    process.exit(1)
  }

  const suffix = device.id.replace(/-/g, '').slice(0, 6).toUpperCase()
  const { data: defaultGroup } = await service
    .from('vehicle_groups')
    .select('id')
    .eq('company_id', companyId)
    .eq('is_default', true)
    .maybeSingle()

  const { data: vehicle, error: vErr } = await service
    .from('vehicles')
    .insert({
      company_id: companyId,
      device_id: device.id,
      economic_num: `iPhone-${suffix}`.slice(0, 20),
      plates: `M-${suffix}`.slice(0, 15),
      brand: 'Apple',
      model: 'iPhone',
      year: new Date().getFullYear(),
      type: 'other',
      group_id: defaultGroup?.id ?? null,
      notes: 'Unidad móvil — prueba admin',
    })
    .select('id, economic_num, plates')
    .single()

  if (vErr) {
    console.error('Error creando vehículo:', vErr.message)
    process.exit(1)
  }

  await service.from('mobile_sessions').insert({
    device_id: device.id,
    user_id: authUser.id,
  })

  console.log('Dispositivo registrado:', device.id)
  console.log('Vehículo:', vehicle.economic_num, vehicle.plates)
}

const { data: final } = await service
  .from('gps_devices')
  .select('id, imei, model, source_type, company_id, tracking_enabled, vehicles(economic_num, plates)')
  .eq('imei', DEVICE.imei)
  .single()

console.log('')
console.log('Listo — datos en plataforma:')
console.log(JSON.stringify(final, null, 2))
console.log('')
console.log('Refresca https://trackprogps.mx/devices o /map para verlo.')
console.log('Para enviar ubicación en vivo, abre la app móvil con tu cuenta.')
