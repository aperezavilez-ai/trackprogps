import { NextResponse, type NextRequest } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { sanitizeIlikeSearch } from '@/lib/security/sanitize-search'
import { firstOrNull } from '@/lib/supabase/normalize'
import { checkRateLimit, rateLimitResponse } from '@/lib/security/rate-limit'

// Ruteado via GafCore API Proxy directo a Claude (NO pool-cheap): este
// asistente usa tool-use nativo de Anthropic sobre datos de ubicacion en
// tiempo real y contactos personales (propietario, conductor, contactos de
// emergencia), asi que se queda en un proveedor confiable con acuerdos de
// manejo de datos mas claros que los tiers gratis. El proxy reenvia el
// formato nativo de Anthropic tal cual (sin traduccion) al pasarle
// baseURL apuntando a /v1/messages.
const anthropic = new Anthropic({
  apiKey: 'gafcore-proxy', // no se usa: el proxy autentica via headers
  baseURL: 'https://gafcore-api-proxy.vercel.app/api/proxy',
  defaultHeaders: {
    'x-project-key': process.env['GAFCORE_PROXY_PROJECT_KEY'] ?? '',
    'x-provider-id': '608200c4-280d-4c28-b058-7947cc4a0352', // claude
  },
})

const SYSTEM_PROMPT = `Eres el asistente inteligente de TrackPro GPS.
Responde siempre en espanol, breve, claro y con datos reales.
Tienes herramientas para consultar vehiculos GPS, dispositivos moviles, ubicacion, historial, viajes, alertas, mantenimiento, chip/SIM, propietario, contactos y comandos.

Reglas obligatorias:
- Distingue siempre entre VEHICULOS GPS/hardware y DISPOSITIVOS MOVILES/app. No mezcles ambos.
- Si el usuario pregunta por informacion operativa, usa herramientas antes de responder.
- No inventes datos. Si un dato no existe, di exactamente que no esta registrado o no esta disponible.
- Cuando hables de ubicaciones, incluye fecha/hora de ultima actualizacion si existe.
- Si el usuario pide ayuda para encontrar informacion, indica la seccion exacta de la plataforma y resume el dato encontrado.
- No digas que hiciste una accion real si solo puedes consultar datos.`

const GPS_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_fleet_overview',
    description: 'Resumen general separado de vehiculos GPS y dispositivos moviles, con estados, alertas y mantenimiento.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_vehicles_status',
    description: 'Estado actual solo de vehiculos GPS/hardware. Excluye dispositivos moviles.',
    input_schema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'online', 'offline', 'moving', 'stopped'],
          description: 'Filtro de estado de vehiculos',
        },
        limit: { type: 'number', description: 'Maximo de registros' },
      },
    },
  },
  {
    name: 'get_mobile_devices_status',
    description: 'Estado actual solo de dispositivos moviles/app, con propietario, contactos, plataforma, bateria y ultima ubicacion.',
    input_schema: {
      type: 'object',
      properties: {
        filter: {
          type: 'string',
          enum: ['all', 'online', 'offline', 'tracking_enabled', 'tracking_paused'],
        },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'get_device_detail',
    description: 'Detalle de un vehiculo o movil por economico, placas, IMEI, telefono, modelo, propietario o correo.',
    input_schema: {
      type: 'object',
      properties: {
        identifier: { type: 'string' },
        type: { type: 'string', enum: ['auto', 'vehicle', 'mobile'] },
      },
      required: ['identifier'],
    },
  },
  {
    name: 'get_asset_location',
    description: 'Ubicacion actual de un vehiculo o movil por economico, placas, IMEI, telefono, propietario o modelo.',
    input_schema: {
      type: 'object',
      properties: {
        identifier: { type: 'string' },
        type: { type: 'string', enum: ['auto', 'vehicle', 'mobile'] },
      },
      required: ['identifier'],
    },
  },
  {
    name: 'get_active_alerts',
    description: 'Alertas activas/no reconocidas de vehiculos GPS y moviles con contexto del dispositivo.',
    input_schema: {
      type: 'object',
      properties: {
        severity: { type: 'string', enum: ['all', 'critical', 'high', 'medium', 'low'] },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'get_trips_summary',
    description: 'Resumen de recorridos/viajes e historial reciente para vehiculos o moviles. Sirve para trayectoria, paradas, duracion y kilometros.',
    input_schema: {
      type: 'object',
      properties: {
        identifier: { type: 'string', description: 'Opcional: economico, placas, IMEI, telefono o propietario' },
        type: { type: 'string', enum: ['auto', 'vehicle', 'mobile'] },
        date_from: { type: 'string', description: 'ISO date opcional' },
        date_to: { type: 'string', description: 'ISO date opcional' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'get_maintenance_status',
    description: 'Mantenimiento proximo o reciente de vehiculos GPS/hardware.',
    input_schema: {
      type: 'object',
      properties: {
        days_ahead: { type: 'number' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'get_sim_recharge_status',
    description: 'Estado de recarga/saldo de chip SIM por dispositivo o listado general.',
    input_schema: {
      type: 'object',
      properties: {
        identifier: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'get_commands_status',
    description: 'Comandos recientes enviados a dispositivos GPS/hardware.',
    input_schema: {
      type: 'object',
      properties: {
        identifier: { type: 'string' },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'search_platform_data',
    description: 'Busca datos en vehiculos, moviles, IMEI, telefono, propietario, conductor, placas o economico.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string' },
        limit: { type: 'number' },
      },
      required: ['query'],
    },
  },
]

type ToolInput = {
  filter?: string
  severity?: string
  limit?: number
  identifier?: string
  type?: 'auto' | 'vehicle' | 'mobile'
  date_from?: string
  date_to?: string
  days_ahead?: number
  query?: string
}

type JsonRecord = Record<string, unknown>

type DeviceRow = {
  id: string
  imei: string
  model: string | null
  firmware_ver?: string | null
  sim_iccid?: string | null
  phone_num?: string | null
  status?: string | null
  last_seen?: string | null
  source_type?: string | null
  mobile_platform?: string | null
  mobile_metadata?: JsonRecord | null
  protocol_metadata?: JsonRecord | null
  tracking_enabled?: boolean | null
  tracking_interval_sec?: number | null
  vehicle?: unknown
  vehicles?: unknown
  assigned_user?: unknown
}

type VehicleRow = {
  id: string
  economic_num: string | null
  plates: string | null
  brand: string | null
  model: string | null
  type?: string | null
  owner_name?: string | null
  device_id?: string | null
  device?: unknown
  driver?: unknown
}

type PositionRow = {
  vehicle_id: string
  device_id?: string | null
  lat: number
  lng: number
  speed: number
  heading?: number | null
  ignition: boolean
  odometer?: number | null
  gsm_signal?: number | null
  battery_lvl?: number | null
  satellites?: number | null
  raw_io?: JsonRecord | null
  recorded_at: string
  vehicle?: unknown
}

function capLimit(value: number | undefined, fallback = 10, max = 50) {
  if (!value || Number.isNaN(value)) return fallback
  return Math.min(Math.max(Math.trunc(value), 1), max)
}

function isOnline(lastSeen?: string | null, minutes = 10) {
  if (!lastSeen) return false
  return Date.now() - new Date(lastSeen).getTime() < minutes * 60 * 1000
}

function one<T>(value: T | T[] | null | undefined): T | null {
  return firstOrNull(value as T | T[] | null | undefined)
}

function asObject(value: unknown): JsonRecord {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {}
}

function readPerson(value: unknown) {
  const obj = asObject(value)
  return {
    nombre: typeof obj.name === 'string' ? obj.name : null,
    telefono: typeof obj.phone === 'string' ? obj.phone : null,
    correo: typeof obj.email === 'string' ? obj.email : null,
    direccion: typeof obj.address === 'string' ? obj.address : null,
    parentesco: typeof obj.relationship === 'string' ? obj.relationship : null,
  }
}

function readMobileMetadata(device: DeviceRow) {
  const meta = asObject(device.mobile_metadata)
  const user = one(device.assigned_user as { full_name?: string | null; email?: string | null; phone?: string | null } | { full_name?: string | null; email?: string | null; phone?: string | null }[] | null)
  const owner = readPerson(meta.device_owner)
  return {
    propietario: owner.nombre ? owner : {
      nombre: user?.full_name ?? null,
      telefono: user?.phone ?? null,
      correo: user?.email ?? null,
      direccion: null,
      parentesco: null,
    },
    responsable: readPerson(meta.responsible_contact),
    contactos_emergencia: Array.isArray(meta.emergency_contacts)
      ? meta.emergency_contacts.slice(0, 5).map(readPerson)
      : [],
    marca: typeof meta.brand === 'string' ? meta.brand : null,
    modelo_movil: typeof meta.model === 'string' ? meta.model : null,
    sistema: typeof meta.os_version === 'string' ? meta.os_version : null,
    app_version: typeof meta.app_version === 'string' ? meta.app_version : null,
    notas: typeof meta.device_notes === 'string' ? meta.device_notes : null,
  }
}

function readHardwareMetadata(device: DeviceRow) {
  const meta = asObject(device.protocol_metadata)
  return {
    propietario: readPerson(meta.device_owner),
    responsable: readPerson(meta.responsible_contact),
    contactos_emergencia: Array.isArray(meta.emergency_contacts)
      ? meta.emergency_contacts.slice(0, 5).map(readPerson)
      : [],
  }
}

function readFuelPct(raw: unknown) {
  const obj = asObject(raw)
  const candidates = [
    obj.fuel_level_pct,
    obj.fuel_pct,
    obj.fuel_level,
    obj.fuel,
  ]
  for (const value of candidates) {
    if (typeof value === 'number') return value
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) return Number(value)
  }
  return null
}

function readBatteryPct(position: Pick<PositionRow, 'battery_lvl' | 'raw_io'> | null | undefined) {
  if (!position) return null
  const raw = asObject(position.raw_io)
  const candidates = [raw.battery_pct, raw.battery_level, raw.battery, position.battery_lvl]
  for (const value of candidates) {
    if (typeof value === 'number') return Math.max(0, Math.min(100, Math.round(value)))
    if (typeof value === 'string' && value.trim() && !Number.isNaN(Number(value))) {
      return Math.max(0, Math.min(100, Math.round(Number(value))))
    }
  }
  return null
}

function statusFromPosition(position: PositionRow | null | undefined) {
  if (!position) return 'sin posicion'
  const online = isOnline(position.recorded_at)
  if (!online) return 'sin senal'
  if (!position.ignition && position.speed <= 2) return 'apagado/detenido'
  if (position.speed > 2) return `en movimiento (${Math.round(position.speed)} km/h)`
  return 'detenido'
}

function vehicleLabel(vehicle: VehicleRow | null | undefined) {
  if (!vehicle) return 'Sin vehiculo'
  return [vehicle.economic_num, vehicle.plates ? `(${vehicle.plates})` : null].filter(Boolean).join(' ')
}

function normalizeDateRange(input: ToolInput) {
  const end = input.date_to ? new Date(input.date_to) : new Date()
  const start = input.date_from ? new Date(input.date_from) : new Date(end.getTime() - 24 * 60 * 60 * 1000)
  return {
    from: Number.isNaN(start.getTime()) ? new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() : start.toISOString(),
    to: Number.isNaN(end.getTime()) ? new Date().toISOString() : end.toISOString(),
  }
}

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile?.company_id) {
    return NextResponse.json({ error: 'No company associated' }, { status: 403 })
  }

  const rl = checkRateLimit(`ai:${user.id}`, 30, 60 * 60 * 1000)
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec)

  const { data: sub } = await supabase
    .from('subscriptions')
    .select('plan:plans(features)')
    .eq('company_id', profile.company_id)
    .single()

  const features = firstOrNull(sub?.plan as { features: { ai_assistant: boolean } } | { features: { ai_assistant: boolean } }[] | null | undefined)?.features
  if (!features?.ai_assistant && profile.role !== 'super_admin') {
    return NextResponse.json(
      { error: 'AI assistant is not available on your current plan' },
      { status: 402 }
    )
  }

  const { messages } = await request.json() as {
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
  }

  const companyId = profile.company_id

  async function getMobileDeviceIds() {
    const { data } = await supabase
      .from('gps_devices')
      .select('id')
      .eq('company_id', companyId)
      .eq('source_type', 'mobile')
    return new Set((data ?? []).map(d => d.id as string))
  }

  async function resolveAsset(identifier: string | undefined, type: ToolInput['type'] = 'auto') {
    const term = sanitizeIlikeSearch(identifier ?? '', 80)
    if (!term) return null

    if (type !== 'vehicle') {
      const { data: devices } = await supabase
        .from('gps_devices')
        .select(`
          id, imei, model, firmware_ver, sim_iccid, phone_num, status, last_seen,
          source_type, mobile_platform, mobile_metadata, protocol_metadata,
          tracking_enabled, tracking_interval_sec,
          assigned_user:users(full_name, email, phone),
          vehicle:vehicles(id, economic_num, plates, brand, model, type, owner_name, device_id)
        `)
        .eq('company_id', companyId)
        .eq('source_type', 'mobile')
        .or(`imei.ilike.%${term}%,model.ilike.%${term}%,phone_num.ilike.%${term}%,sim_iccid.ilike.%${term}%`)
        .limit(10)

      const found = (devices as DeviceRow[] | null | undefined)?.find(device => {
        const meta = readMobileMetadata(device)
        const haystack = JSON.stringify([
          device.imei,
          device.model,
          device.phone_num,
          device.sim_iccid,
          meta.propietario,
          meta.responsable,
          meta.contactos_emergencia,
        ]).toLowerCase()
        return haystack.includes(term.toLowerCase())
      }) ?? (devices as DeviceRow[] | null | undefined)?.[0]

      if (found) {
        return { kind: 'mobile' as const, device: found, vehicle: one(found.vehicle as VehicleRow | VehicleRow[] | null) }
      }

      const { data: allMobile } = await supabase
        .from('gps_devices')
        .select(`
          id, imei, model, firmware_ver, sim_iccid, phone_num, status, last_seen,
          source_type, mobile_platform, mobile_metadata, protocol_metadata,
          tracking_enabled, tracking_interval_sec,
          assigned_user:users(full_name, email, phone),
          vehicle:vehicles(id, economic_num, plates, brand, model, type, owner_name, device_id)
        `)
        .eq('company_id', companyId)
        .eq('source_type', 'mobile')
        .limit(50)

      const metadataMatch = (allMobile as DeviceRow[] | null | undefined)?.find(device => {
        const meta = readMobileMetadata(device)
        return JSON.stringify(meta).toLowerCase().includes(term.toLowerCase())
      })
      if (metadataMatch) {
        return { kind: 'mobile' as const, device: metadataMatch, vehicle: one(metadataMatch.vehicle as VehicleRow | VehicleRow[] | null) }
      }
    }

    if (type !== 'mobile') {
      const mobileIds = await getMobileDeviceIds()
      const { data: vehicles } = await supabase
        .from('vehicles')
        .select(`
          id, economic_num, plates, brand, model, type, owner_name, device_id,
          driver:drivers(full_name, phone, email),
          device:gps_devices(id, imei, model, firmware_ver, sim_iccid, phone_num, status, last_seen, source_type, protocol_metadata)
        `)
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .or(`economic_num.ilike.%${term}%,plates.ilike.%${term}%,brand.ilike.%${term}%,model.ilike.%${term}%,owner_name.ilike.%${term}%`)
        .limit(20)

      const vehicle = (vehicles as VehicleRow[] | null | undefined)?.find(v => {
        const device = one(v.device as DeviceRow | DeviceRow[] | null)
        return v.device_id == null || (!mobileIds.has(v.device_id) && device?.source_type !== 'mobile')
      })
      if (vehicle) {
        return { kind: 'vehicle' as const, vehicle, device: one(vehicle.device as DeviceRow | DeviceRow[] | null) }
      }

      const { data: hardware } = await supabase
        .from('gps_devices')
        .select(`
          id, imei, model, firmware_ver, sim_iccid, phone_num, status, last_seen,
          source_type, protocol_metadata,
          vehicle:vehicles(id, economic_num, plates, brand, model, type, owner_name, device_id, driver:drivers(full_name, phone, email))
        `)
        .eq('company_id', companyId)
        .eq('source_type', 'hardware')
        .or(`imei.ilike.%${term}%,model.ilike.%${term}%,phone_num.ilike.%${term}%,sim_iccid.ilike.%${term}%`)
        .limit(5)

      const device = (hardware as DeviceRow[] | null | undefined)?.[0]
      if (device) {
        return { kind: 'vehicle' as const, device, vehicle: one(device.vehicle as VehicleRow | VehicleRow[] | null) }
      }
    }

    return null
  }

  async function latestPosition(vehicleId: string) {
    const { data } = await supabase
      .from('vehicle_positions')
      .select('vehicle_id, device_id, lat, lng, speed, heading, ignition, odometer, gsm_signal, battery_lvl, satellites, raw_io, recorded_at')
      .eq('company_id', companyId)
      .eq('vehicle_id', vehicleId)
      .maybeSingle()
    return data as PositionRow | null
  }

  async function executeTool(name: string, input: ToolInput): Promise<string> {
    switch (name) {
      case 'get_fleet_overview': {
        const mobileIds = await getMobileDeviceIds()
        const [{ data: vehicles }, { data: mobileDevices }, { data: positions }, { data: alerts }, { data: maintenance }] = await Promise.all([
          supabase
            .from('vehicles')
            .select('id, device_id, device:gps_devices(source_type)')
            .eq('company_id', companyId)
            .is('deleted_at', null),
          supabase
            .from('gps_devices')
            .select('id, status, last_seen, tracking_enabled')
            .eq('company_id', companyId)
            .eq('source_type', 'mobile'),
          supabase
            .from('vehicle_positions')
            .select('vehicle_id, device_id, speed, ignition, recorded_at')
            .eq('company_id', companyId),
          supabase
            .from('alerts')
            .select('id, severity')
            .eq('company_id', companyId)
            .is('acknowledged_at', null),
          supabase
            .from('maintenance_records')
            .select('id, next_service_date')
            .eq('company_id', companyId)
            .gte('next_service_date', new Date().toISOString().slice(0, 10))
            .lte('next_service_date', new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10)),
        ])

        const hardwareVehicles = (vehicles as VehicleRow[] | null | undefined ?? []).filter(v => {
          const device = one(v.device as { source_type?: string } | { source_type?: string }[] | null)
          return v.device_id == null || (!mobileIds.has(v.device_id) && device?.source_type !== 'mobile')
        })
        const hardwareVehicleIds = new Set(hardwareVehicles.map(v => v.id))
        const hardwarePositions = (positions as PositionRow[] | null | undefined ?? []).filter(p => hardwareVehicleIds.has(p.vehicle_id))
        const mobilePositions = (positions as PositionRow[] | null | undefined ?? []).filter(p => p.device_id && mobileIds.has(p.device_id))

        return JSON.stringify({
          vehiculos_gps: {
            total: hardwareVehicles.length,
            en_linea: hardwarePositions.filter(p => isOnline(p.recorded_at)).length,
            en_movimiento: hardwarePositions.filter(p => isOnline(p.recorded_at) && p.speed > 2).length,
            detenidos: hardwarePositions.filter(p => isOnline(p.recorded_at) && p.speed <= 2).length,
          },
          dispositivos_moviles: {
            total: mobileDevices?.length ?? 0,
            rastreo_activo: (mobileDevices ?? []).filter(d => d.tracking_enabled !== false).length,
            en_linea: (mobileDevices ?? []).filter(d => isOnline(d.last_seen)).length,
            con_posicion: mobilePositions.length,
          },
          alertas_activas: alerts?.length ?? 0,
          mantenimiento_30_dias: maintenance?.length ?? 0,
        }, null, 2)
      }

      case 'get_vehicles_status': {
        const mobileIds = await getMobileDeviceIds()
        const limit = capLimit(input.limit, 15)
        const { data } = await supabase
          .from('vehicle_positions')
          .select(`
            vehicle_id, device_id, lat, lng, speed, heading, ignition, odometer,
            gsm_signal, battery_lvl, satellites, raw_io, recorded_at,
            vehicle:vehicles(
              id, economic_num, plates, brand, model, type, owner_name, device_id,
              driver:drivers(full_name, phone),
              device:gps_devices(id, imei, model, status, last_seen, source_type, phone_num, sim_iccid, protocol_metadata)
            )
          `)
          .eq('company_id', companyId)
          .order('recorded_at', { ascending: false })
          .limit(100)

        const rows = (data as PositionRow[] | null | undefined ?? [])
          .map(p => ({ p, v: one(p.vehicle as VehicleRow | VehicleRow[] | null) }))
          .filter(({ p, v }) => {
            const device = one(v?.device as DeviceRow | DeviceRow[] | null)
            const positionDeviceId = p.device_id ?? v?.device_id ?? null
            return Boolean(v) &&
              (v?.device_id == null || !mobileIds.has(v.device_id)) &&
              (positionDeviceId == null || !mobileIds.has(positionDeviceId)) &&
              device?.source_type !== 'mobile'
          })
          .map(({ p, v }) => {
            const device = one(v?.device as DeviceRow | DeviceRow[] | null)
            const state = statusFromPosition(p)
            return {
              tipo: 'vehiculo_gps',
              economico: v?.economic_num,
              placas: v?.plates,
              marca_modelo: [v?.brand, v?.model].filter(Boolean).join(' '),
              propietario: v?.owner_name ?? readHardwareMetadata(device ?? {} as DeviceRow).propietario.nombre ?? null,
              conductor: one(v?.driver as { full_name?: string | null } | { full_name?: string | null }[] | null)?.full_name ?? null,
              estado: state,
              velocidad_kmh: Math.round(p.speed ?? 0),
              combustible_pct: readFuelPct(p.raw_io),
              bateria_pct: readBatteryPct(p),
              lat: p.lat,
              lng: p.lng,
              ultima_actualizacion: p.recorded_at,
              imei: device?.imei ?? null,
            }
          })
          .filter(row => {
            if (!input.filter || input.filter === 'all') return true
            if (input.filter === 'online') return !['sin senal', 'sin posicion'].includes(row.estado)
            if (input.filter === 'offline') return row.estado === 'sin senal' || row.estado === 'sin posicion'
            if (input.filter === 'moving') return row.velocidad_kmh > 2
            if (input.filter === 'stopped') return row.velocidad_kmh <= 2
            return true
          })
          .slice(0, limit)

        return rows.length ? JSON.stringify(rows, null, 2) : 'No hay vehiculos GPS/hardware con ese filtro.'
      }

      case 'get_mobile_devices_status': {
        const limit = capLimit(input.limit, 15)
        const { data } = await supabase
          .from('gps_devices')
          .select(`
            id, imei, model, firmware_ver, sim_iccid, phone_num, status, last_seen,
            source_type, mobile_platform, mobile_metadata, tracking_enabled, tracking_interval_sec,
            assigned_user:users(full_name, email, phone),
            vehicle:vehicles(id, economic_num, plates, brand, model, owner_name, device_id, position:vehicle_positions(lat, lng, speed, heading, ignition, battery_lvl, raw_io, recorded_at))
          `)
          .eq('company_id', companyId)
          .eq('source_type', 'mobile')
          .order('last_seen', { ascending: false, nullsFirst: false })
          .limit(100)

        const rows = (data as DeviceRow[] | null | undefined ?? [])
          .map(device => {
            const vehicle = one(device.vehicle as (VehicleRow & { position?: unknown }) | (VehicleRow & { position?: unknown })[] | null)
            const pos = one(vehicle?.position as PositionRow | PositionRow[] | null)
            const meta = readMobileMetadata(device)
            return {
              tipo: 'dispositivo_movil',
              nombre: vehicleLabel(vehicle),
              plataforma: device.mobile_platform ?? null,
              imei: device.imei,
              telefono_sim: device.phone_num ?? null,
              iccid: device.sim_iccid ?? null,
              propietario: meta.propietario,
              responsable: meta.responsable,
              contactos_emergencia: meta.contactos_emergencia,
              rastreo_activo: device.tracking_enabled !== false,
              intervalo_reporte_seg: device.tracking_interval_sec ?? null,
              estado: device.tracking_enabled === false
                ? 'rastreo pausado'
                : isOnline(device.last_seen) ? 'en linea' : 'sin senal',
              bateria_pct: readBatteryPct(pos),
              lat: pos?.lat ?? null,
              lng: pos?.lng ?? null,
              ultima_actualizacion: pos?.recorded_at ?? device.last_seen ?? null,
              version_app: meta.app_version,
            }
          })
          .filter(row => {
            if (!input.filter || input.filter === 'all') return true
            if (input.filter === 'online') return row.estado === 'en linea'
            if (input.filter === 'offline') return row.estado === 'sin senal'
            if (input.filter === 'tracking_enabled') return row.rastreo_activo
            if (input.filter === 'tracking_paused') return !row.rastreo_activo
            return true
          })
          .slice(0, limit)

        return rows.length ? JSON.stringify(rows, null, 2) : 'No hay dispositivos moviles con ese filtro.'
      }

      case 'get_device_detail':
      case 'get_asset_location': {
        const asset = await resolveAsset(input.identifier, input.type ?? 'auto')
        if (!asset) return `No encontre un vehiculo o movil con: ${input.identifier}`
        const vehicle = asset.vehicle
        const device = asset.device
        const pos = vehicle?.id ? await latestPosition(vehicle.id) : null

        if (asset.kind === 'mobile') {
          if (!device) return `No encontre datos tecnicos del movil: ${input.identifier}`
          const meta = readMobileMetadata(device)
          return JSON.stringify({
            tipo: 'dispositivo_movil',
            nombre: vehicleLabel(vehicle),
            imei: device.imei,
            plataforma: device.mobile_platform,
            modelo: device.model,
            telefono_sim: device.phone_num,
            iccid: device.sim_iccid,
            firmware: device.firmware_ver,
            propietario: meta.propietario,
            responsable: meta.responsable,
            contactos_emergencia: meta.contactos_emergencia,
            rastreo_activo: device.tracking_enabled !== false,
            intervalo_reporte_seg: device.tracking_interval_sec,
            estado: device.tracking_enabled === false ? 'rastreo pausado' : isOnline(device.last_seen) ? 'en linea' : 'sin senal',
            bateria_pct: readBatteryPct(pos),
            ubicacion: pos ? {
              lat: pos.lat,
              lng: pos.lng,
              velocidad_kmh: Math.round(pos.speed ?? 0),
              ultima_actualizacion: pos.recorded_at,
            } : null,
            version_app: meta.app_version,
          }, null, 2)
        }

        const metadata = readHardwareMetadata(device ?? {} as DeviceRow)
        return JSON.stringify({
          tipo: 'vehiculo_gps',
          economico: vehicle?.economic_num,
          placas: vehicle?.plates,
          marca_modelo: [vehicle?.brand, vehicle?.model].filter(Boolean).join(' '),
          propietario: vehicle?.owner_name ?? metadata.propietario.nombre,
          conductor: one(vehicle?.driver as { full_name?: string | null; phone?: string | null } | { full_name?: string | null; phone?: string | null }[] | null),
          imei: device?.imei ?? null,
          modelo_gps: device?.model ?? null,
          telefono_sim: device?.phone_num ?? null,
          iccid: device?.sim_iccid ?? null,
          firmware: device?.firmware_ver ?? null,
          estado: statusFromPosition(pos),
          combustible_pct: readFuelPct(pos?.raw_io),
          bateria_pct: readBatteryPct(pos),
          ubicacion: pos ? {
            lat: pos.lat,
            lng: pos.lng,
            velocidad_kmh: Math.round(pos.speed ?? 0),
            ignicion: pos.ignition,
            ultima_actualizacion: pos.recorded_at,
          } : null,
        }, null, 2)
      }

      case 'get_active_alerts': {
        const limit = capLimit(input.limit, 10)
        let query = supabase
          .from('alerts')
          .select(`
            type, severity, title, message, lat, lng, speed, created_at, device_id, vehicle_id,
            vehicle:vehicles(economic_num, plates, brand, model, device:gps_devices(source_type, mobile_platform, imei, mobile_metadata))
          `)
          .eq('company_id', companyId)
          .is('acknowledged_at', null)
          .order('created_at', { ascending: false })
          .limit(limit)

        if (input.severity && input.severity !== 'all') query = query.eq('severity', input.severity)
        const { data } = await query
        if (!data?.length) return 'No hay alertas activas en este momento.'
        const rows = data.map(alert => {
          const vehicle = one(alert.vehicle as VehicleRow | VehicleRow[] | null)
          const device = one(vehicle?.device as DeviceRow | DeviceRow[] | null)
          return {
            tipo_dispositivo: device?.source_type === 'mobile' ? 'movil' : 'vehiculo_gps',
            unidad: vehicleLabel(vehicle),
            alerta: alert.title,
            severidad: alert.severity,
            mensaje: alert.message,
            lat: alert.lat,
            lng: alert.lng,
            velocidad_kmh: alert.speed,
            creada: alert.created_at,
          }
        })
        return JSON.stringify(rows, null, 2)
      }

      case 'get_trips_summary': {
        const limit = capLimit(input.limit, 10)
        const range = normalizeDateRange(input)
        const asset = input.identifier ? await resolveAsset(input.identifier, input.type ?? 'auto') : null
        let vehicleId = asset?.vehicle?.id ?? null
        let query = supabase
          .from('trips')
          .select(`
            id, vehicle_id, started_at, ended_at, start_address, end_address,
            distance_km, duration_min, avg_speed, max_speed, is_complete,
            vehicle:vehicles(economic_num, plates, brand, model, device:gps_devices(source_type, mobile_metadata))
          `)
          .eq('company_id', companyId)
          .gte('started_at', range.from)
          .lte('started_at', range.to)
          .order('started_at', { ascending: false })
          .limit(limit)

        if (vehicleId) query = query.eq('vehicle_id', vehicleId)
        const { data } = await query

        if (data?.length) {
          return JSON.stringify(data.map(t => {
            const vehicle = one(t.vehicle as VehicleRow | VehicleRow[] | null)
            const device = one(vehicle?.device as DeviceRow | DeviceRow[] | null)
            return {
              tipo: device?.source_type === 'mobile' ? 'dispositivo_movil' : 'vehiculo_gps',
              unidad: vehicleLabel(vehicle),
              inicio: t.started_at,
              fin: t.ended_at,
              origen: t.start_address,
              destino: t.end_address,
              distancia_km: t.distance_km,
              duracion_min: t.duration_min,
              velocidad_max_kmh: t.max_speed,
              completo: t.is_complete,
            }
          }), null, 2)
        }

        if (!vehicleId) return 'No encontre viajes en el rango consultado.'

        const { data: points } = await supabase
          .from('position_history')
          .select('lat, lng, speed, ignition, odometer, recorded_at')
          .eq('company_id', companyId)
          .eq('vehicle_id', vehicleId)
          .gte('recorded_at', range.from)
          .lte('recorded_at', range.to)
          .order('recorded_at', { ascending: true })
          .limit(500)

        if (!points?.length) return 'No hay recorridos/historial para ese dispositivo en el rango consultado.'
        const first = points[0]
        const last = points[points.length - 1]
        const distanceKm = first && last && last.odometer > 0 && first.odometer > 0
          ? Math.round((last.odometer - first.odometer) * 10) / 10
          : null
        const stops = points.filter(p => p.speed <= 2 || p.ignition === false).length
        return JSON.stringify({
          unidad: asset?.kind === 'mobile' ? 'dispositivo_movil' : 'vehiculo_gps',
          puntos: points.length,
          inicio: first?.recorded_at,
          fin: last?.recorded_at,
          distancia_km: distanceKm,
          puntos_detenidos: stops,
          primera_ubicacion: first ? { lat: first.lat, lng: first.lng } : null,
          ultima_ubicacion: last ? { lat: last.lat, lng: last.lng } : null,
        }, null, 2)
      }

      case 'get_maintenance_status': {
        const limit = capLimit(input.limit, 10)
        const days = Math.min(Math.max(input.days_ahead ?? 30, 1), 365)
        const today = new Date().toISOString().slice(0, 10)
        const to = new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)
        const { data } = await supabase
          .from('maintenance_records')
          .select('type, description, cost, currency, odometer_at, next_odometer, service_date, next_service_date, workshop, notes, vehicle:vehicles(economic_num, plates, brand, model, device:gps_devices(source_type))')
          .eq('company_id', companyId)
          .gte('next_service_date', today)
          .lte('next_service_date', to)
          .order('next_service_date', { ascending: true })
          .limit(limit)
        const rows = (data ?? []).filter(item => {
          const vehicle = one(item.vehicle as VehicleRow | VehicleRow[] | null)
          const device = one(vehicle?.device as DeviceRow | DeviceRow[] | null)
          return device?.source_type !== 'mobile'
        })
        return rows.length ? JSON.stringify(rows.map(item => {
          const vehicle = one(item.vehicle as VehicleRow | VehicleRow[] | null)
          return {
            unidad: vehicleLabel(vehicle),
            tipo: item.type,
            descripcion: item.description,
            fecha_servicio: item.service_date,
            proximo_servicio: item.next_service_date,
            proximo_odometro: item.next_odometer,
            taller: item.workshop,
            notas: item.notes,
          }
        }), null, 2) : 'No hay mantenimientos proximos registrados para vehiculos GPS.'
      }

      case 'get_sim_recharge_status': {
        const limit = capLimit(input.limit, 10)
        const asset = input.identifier ? await resolveAsset(input.identifier, input.type ?? 'auto') : null
        let query = supabase
          .from('device_sim_recharges')
          .select('carrier, phone_num, amount, currency, recharge_date, validity_days, next_recharge_date, alert_days_before, notes, device:gps_devices(imei, model, source_type, phone_num, sim_iccid, vehicle:vehicles(economic_num, plates))')
          .eq('company_id', companyId)
          .order('recharge_date', { ascending: false })
          .limit(limit)
        if (asset?.device?.id) query = query.eq('device_id', asset.device.id)
        const { data } = await query
        if (!data?.length) return 'No hay recargas de chip/SIM registradas para esa consulta.'
        const today = new Date()
        return JSON.stringify(data.map(row => {
          const device = one(row.device as DeviceRow | DeviceRow[] | null)
          const vehicle = one(device?.vehicle as VehicleRow | VehicleRow[] | null)
          const next = row.next_recharge_date ? new Date(`${row.next_recharge_date}T00:00:00`) : null
          const daysLeft = next ? Math.ceil((next.getTime() - today.getTime()) / 86_400_000) : null
          return {
            tipo: device?.source_type === 'mobile' ? 'dispositivo_movil' : 'vehiculo_gps',
            unidad: vehicleLabel(vehicle),
            imei: device?.imei,
            telefono_sim: row.phone_num ?? device?.phone_num ?? null,
            iccid: device?.sim_iccid ?? null,
            compania: row.carrier,
            monto: row.amount,
            moneda: row.currency,
            fecha_recarga: row.recharge_date,
            vence: row.next_recharge_date,
            dias_restantes: daysLeft,
            alerta_dias_antes: row.alert_days_before,
          }
        }), null, 2)
      }

      case 'get_commands_status': {
        const limit = capLimit(input.limit, 10)
        const asset = input.identifier ? await resolveAsset(input.identifier, 'vehicle') : null
        let query = supabase
          .from('device_commands')
          .select('command_type, command_text, status, sent_at, confirmed_at, error_msg, created_at, device:gps_devices(imei, model, source_type, vehicle:vehicles(economic_num, plates))')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .limit(limit)
        if (asset?.device?.id) query = query.eq('device_id', asset.device.id)
        const { data } = await query
        const rows = (data ?? []).filter(row => {
          const device = one(row.device as DeviceRow | DeviceRow[] | null)
          return device?.source_type !== 'mobile'
        })
        return rows.length ? JSON.stringify(rows.map(row => {
          const device = one(row.device as DeviceRow | DeviceRow[] | null)
          const vehicle = one(device?.vehicle as VehicleRow | VehicleRow[] | null)
          return {
            unidad: vehicleLabel(vehicle),
            imei: device?.imei,
            comando: row.command_type,
            texto_comando: row.command_text,
            estado: row.status,
            creado: row.created_at,
            enviado: row.sent_at,
            confirmado: row.confirmed_at,
            error: row.error_msg,
          }
        }), null, 2) : 'No hay comandos recientes registrados para dispositivos GPS vehiculares.'
      }

      case 'search_platform_data': {
        const term = sanitizeIlikeSearch(input.query ?? '', 80)
        if (!term) return 'Busqueda invalida.'
        const limit = capLimit(input.limit, 10)
        const [vehiclesResult, mobileResult] = await Promise.all([
          supabase
            .from('vehicles')
            .select('id, economic_num, plates, brand, model, owner_name, device_id, driver:drivers(full_name, phone), device:gps_devices(source_type, imei, model, phone_num)')
            .eq('company_id', companyId)
            .is('deleted_at', null)
            .or(`economic_num.ilike.%${term}%,plates.ilike.%${term}%,brand.ilike.%${term}%,model.ilike.%${term}%,owner_name.ilike.%${term}%`)
            .limit(limit),
          supabase
            .from('gps_devices')
            .select('id, imei, model, phone_num, sim_iccid, source_type, mobile_platform, mobile_metadata, assigned_user:users(full_name, email, phone), vehicle:vehicles(economic_num, plates)')
            .eq('company_id', companyId)
            .eq('source_type', 'mobile')
            .or(`imei.ilike.%${term}%,model.ilike.%${term}%,phone_num.ilike.%${term}%,sim_iccid.ilike.%${term}%`)
            .limit(limit),
        ])
        const mobileIds = await getMobileDeviceIds()
        const vehicleRows = (vehiclesResult.data as VehicleRow[] | null | undefined ?? [])
          .filter(v => {
            const device = one(v.device as DeviceRow | DeviceRow[] | null)
            return v.device_id == null || (!mobileIds.has(v.device_id) && device?.source_type !== 'mobile')
          })
          .map(v => ({
            tipo: 'vehiculo_gps',
            unidad: vehicleLabel(v),
            marca_modelo: [v.brand, v.model].filter(Boolean).join(' '),
            propietario: v.owner_name,
            conductor: one(v.driver as { full_name?: string | null; phone?: string | null } | { full_name?: string | null; phone?: string | null }[] | null),
            imei: one(v.device as DeviceRow | DeviceRow[] | null)?.imei ?? null,
          }))
        const mobileRows = (mobileResult.data as DeviceRow[] | null | undefined ?? [])
          .map(device => {
            const meta = readMobileMetadata(device)
            return {
              tipo: 'dispositivo_movil',
              unidad: vehicleLabel(one(device.vehicle as VehicleRow | VehicleRow[] | null)),
              imei: device.imei,
              telefono_sim: device.phone_num,
              plataforma: device.mobile_platform,
              propietario: meta.propietario,
            }
          })
        const rows = [...vehicleRows, ...mobileRows].slice(0, limit)
        return rows.length ? JSON.stringify(rows, null, 2) : `No encontre resultados para: ${input.query}`
      }

      default:
        return 'Herramienta no reconocida'
    }
  }

  const anthropicMessages: Anthropic.MessageParam[] = messages.map(m => ({
    role: m.role,
    content: m.content,
  }))

  let response = await anthropic.messages.create({
    model: 'claude-sonnet-5',
    max_tokens: 1400,
    system: SYSTEM_PROMPT,
    tools: GPS_TOOLS,
    messages: anthropicMessages,
  })

  let toolRounds = 0
  while (response.stop_reason === 'tool_use' && toolRounds < 5) {
    toolRounds += 1
    const toolUseBlocks = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    if (!toolUseBlocks.length) break

    const toolResults = await Promise.all(toolUseBlocks.map(async block => ({
      type: 'tool_result' as const,
      tool_use_id: block.id,
      content: await executeTool(block.name, block.input as ToolInput),
    })))

    anthropicMessages.push(
      { role: 'assistant', content: response.content },
      { role: 'user', content: toolResults }
    )

    response = await anthropic.messages.create({
      model: 'claude-sonnet-5',
      max_tokens: 1400,
      system: SYSTEM_PROMPT,
      tools: GPS_TOOLS,
      messages: anthropicMessages,
    })
  }

  const textBlock = response.content.find(b => b.type === 'text') as Anthropic.TextBlock | undefined

  return NextResponse.json({
    message: textBlock?.text ?? 'No pude generar una respuesta.',
  })
}
