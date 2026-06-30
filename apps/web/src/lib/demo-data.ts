import type { DashboardStats, LiveVehicle, Alert } from '@gps-saas/types'

export type DemoAlert = Alert & {
  vehicle?: { economic_num: string; plates: string } | null
}

export type DemoVehicleRow = {
  id: string
  company_id: string
  economic_num: string
  plates: string
  brand: string
  model: string
  year: number
  type: string
  color: string | null
  status: string
  max_speed: number
  owner_name?: string | null
  group?: { id: string; name: string; color: string } | null
  created_at: string
  deleted_at: string | null
  device: { id: string; imei: string; model: string; status: string; last_seen: string | null } | null
  driver: { id: string; full_name: string; phone: string | null } | null
  position: { lat: number; lng: number; speed: number; ignition: boolean; recorded_at: string } | null
}

export const DEMO_MODE = process.env['NEXT_PUBLIC_DEMO_MODE'] === 'true'

export function isDemoTourActive(company: {
  status?: string | null
  settings?: Record<string, unknown> | null
} | null | undefined): boolean {
  if (DEMO_MODE) return true
  if (!company) return false
  if (company.status === 'demo') return true
  return company.settings?.['demo_tour'] === true
}

export const DEMO_PROFILE = {
  id: 'demo-user-id',
  email: 'demo@trackprogps.mx',
  full_name: 'Carlos Administrador',
  role: 'admin_empresa' as const,
  company_id: 'demo-company-id',
  avatar_url: null,
  company: {
    name: 'Transportes Demo S.A.',
    logo_url: null,
    status: 'active',
    plan: {
      name: 'Pro',
      type: 'pro',
      features: {
        ai_assistant: true,
        advanced_reports: true,
        geofences: true,
        maintenance: true,
        whatsapp_alerts: true,
      } as Record<string, boolean>,
    },
  },
}

export const DEMO_VEHICLES: LiveVehicle[] = [
  {
    vehicle_id: 'v1', company_id: 'demo-company-id',
    economic_num: 'ECO-001', plates: 'ABC-123-D', brand: 'Kenworth', model: 'T680', vehicle_type: 'truck',
    group_id: null, group_name: null, owner_name: null,
    driver_name: 'Miguel Ángel Ramírez',
    device_status: 'online', lat: 19.4326, lng: -99.1332,
    speed: 72, heading: 45, ignition: true, odometer: 154320, last_update: new Date().toISOString(),
  },
  {
    vehicle_id: 'v2', company_id: 'demo-company-id',
    economic_num: 'ECO-002', plates: 'XYZ-789-B', brand: 'Freightliner', model: 'Cascadia', vehicle_type: 'truck',
    group_id: null, group_name: null, owner_name: null,
    driver_name: 'José Luis Hernández',
    device_status: 'online', lat: 19.4200, lng: -99.1500,
    speed: 0, heading: 180, ignition: true, odometer: 98750, last_update: new Date().toISOString(),
  },
  {
    vehicle_id: 'v3', company_id: 'demo-company-id',
    economic_num: 'ECO-003', plates: 'DEF-456-C', brand: 'International', model: 'ProStar', vehicle_type: 'truck',
    group_id: null, group_name: null, owner_name: null,
    driver_name: 'Ana Sofía Torres',
    device_status: 'online', lat: 19.4400, lng: -99.1700,
    speed: 55, heading: 270, ignition: true, odometer: 210980, last_update: new Date().toISOString(),
  },
  {
    vehicle_id: 'v4', company_id: 'demo-company-id',
    economic_num: 'ECO-004', plates: 'GHI-321-A', brand: 'Peterbilt', model: '389', vehicle_type: 'pickup',
    group_id: null, group_name: null, owner_name: null,
    driver_name: null,
    device_status: 'offline', lat: 19.3900, lng: -99.0900,
    speed: 0, heading: 0, ignition: false, odometer: 67400, last_update: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    vehicle_id: 'v5', company_id: 'demo-company-id',
    economic_num: 'ECO-005', plates: 'JKL-654-E', brand: 'Volvo', model: 'FH', vehicle_type: 'truck',
    group_id: null, group_name: null, owner_name: null,
    driver_name: 'Roberto Sandoval',
    device_status: 'online', lat: 19.4600, lng: -99.1200,
    speed: 90, heading: 90, ignition: true, odometer: 320150, last_update: new Date().toISOString(),
  },
  {
    vehicle_id: 'v6', company_id: 'demo-company-id',
    economic_num: 'ECO-006', plates: 'MNO-987-F', brand: 'Mercedes-Benz', model: 'Actros', vehicle_type: 'truck',
    group_id: null, group_name: null, owner_name: null,
    driver_name: 'Luis Fernando Gómez',
    device_status: 'no_signal', lat: 19.3500, lng: -99.2100,
    speed: 0, heading: 0, ignition: false, odometer: 445600, last_update: new Date(Date.now() - 7200000).toISOString(),
  },
]

export const DEMO_STATS: DashboardStats = {
  total_vehicles: 6,
  vehicles_online: 4,
  vehicles_stopped: 1,
  vehicles_offline: 1,
  vehicles_no_signal: 1,
  active_alerts: 3,
  km_today: 1842,
  km_month: 48320,
  productivity_today: 67,
  productivity_month: 72,
}

export const DEMO_ALERTS: DemoAlert[] = [
  {
    id: 'a1', company_id: 'demo-company-id', vehicle_id: 'v5',
    device_id: null, geofence_id: null,
    type: 'speed_excess',
    title: 'Exceso de velocidad',
    message: 'ECO-005 circulando a 90 km/h en zona de velocidad máx. 80',
    severity: 'high', lat: 19.46, lng: -99.12, speed: 90,
    payload: {}, channels_sent: ['platform'] as never,
    acknowledged_by: null, acknowledged_at: null,
    created_at: new Date(Date.now() - 300000).toISOString(),
    vehicle: { economic_num: 'ECO-005', plates: 'JKL-654-E' } as never,
  },
  {
    id: 'a2', company_id: 'demo-company-id', vehicle_id: 'v1',
    device_id: null, geofence_id: 'gf1',
    type: 'geofence_exit',
    title: 'Salida de geocerca',
    message: 'ECO-001 salió de zona autorizada "CDMX Norte"',
    severity: 'medium', lat: 19.4326, lng: -99.1332, speed: null,
    payload: {}, channels_sent: ['platform'] as never,
    acknowledged_by: null, acknowledged_at: null,
    created_at: new Date(Date.now() - 900000).toISOString(),
    vehicle: { economic_num: 'ECO-001', plates: 'ABC-123-D' } as never,
  },
  {
    id: 'a3', company_id: 'demo-company-id', vehicle_id: 'v6',
    device_id: null, geofence_id: null,
    type: 'signal_loss',
    title: 'Sin señal GPS',
    message: 'ECO-006 sin señal GPS por más de 2 horas',
    severity: 'low', lat: 19.35, lng: -99.21, speed: null,
    payload: {}, channels_sent: ['platform'] as never,
    acknowledged_by: null, acknowledged_at: null,
    created_at: new Date(Date.now() - 7200000).toISOString(),
    vehicle: { economic_num: 'ECO-006', plates: 'MNO-987-F' } as never,
  },
]

export const DEMO_VEHICLES_TABLE: DemoVehicleRow[] = [
  {
    id: 'v1', company_id: 'demo-company-id', economic_num: 'ECO-001',
    plates: 'ABC-123-D', brand: 'Kenworth', model: 'T680', year: 2022,
    type: 'truck', color: 'Blanco', status: 'active', max_speed: 80, owner_name: null, group: null,
    created_at: '2024-01-15T10:00:00Z', deleted_at: null,
    device: { id: 'd1', imei: '352748082345678', model: 'FMC920', status: 'active', last_seen: new Date().toISOString() } as never,
    driver: { id: 'dr1', full_name: 'Miguel Ángel Ramírez', phone: '+52 55 1234 5678' } as never,
    position: { lat: 19.4326, lng: -99.1332, speed: 72, ignition: true, recorded_at: new Date().toISOString() },
  },
  {
    id: 'v2', company_id: 'demo-company-id', economic_num: 'ECO-002',
    plates: 'XYZ-789-B', brand: 'Freightliner', model: 'Cascadia', year: 2021,
    type: 'truck', color: 'Rojo', status: 'active', max_speed: 80, owner_name: null, group: null,
    created_at: '2024-02-01T08:00:00Z', deleted_at: null,
    device: { id: 'd2', imei: '352748082345679', model: 'FMC920', status: 'active', last_seen: new Date().toISOString() } as never,
    driver: { id: 'dr2', full_name: 'José Luis Hernández', phone: '+52 55 8765 4321' } as never,
    position: { lat: 19.42, lng: -99.15, speed: 0, ignition: true, recorded_at: new Date().toISOString() },
  },
  {
    id: 'v3', company_id: 'demo-company-id', economic_num: 'ECO-003',
    plates: 'DEF-456-C', brand: 'International', model: 'ProStar', year: 2020,
    type: 'truck', color: 'Azul', status: 'active', max_speed: 80, owner_name: null, group: null,
    created_at: '2024-03-10T09:00:00Z', deleted_at: null,
    device: { id: 'd3', imei: '352748082345680', model: 'FMC920', status: 'active', last_seen: new Date().toISOString() } as never,
    driver: { id: 'dr3', full_name: 'Ana Sofía Torres', phone: '+52 55 2222 3333' } as never,
    position: { lat: 19.44, lng: -99.17, speed: 55, ignition: true, recorded_at: new Date().toISOString() },
  },
  {
    id: 'v4', company_id: 'demo-company-id', economic_num: 'ECO-004',
    plates: 'GHI-321-A', brand: 'Peterbilt', model: '389', year: 2023,
    type: 'truck', color: 'Negro', status: 'maintenance', max_speed: 80, owner_name: null, group: null,
    created_at: '2024-04-05T11:00:00Z', deleted_at: null,
    device: null as never,
    driver: null as never,
    position: null,
  },
  {
    id: 'v5', company_id: 'demo-company-id', economic_num: 'ECO-005',
    plates: 'JKL-654-E', brand: 'Volvo', model: 'FH', year: 2019,
    type: 'truck', color: 'Blanco', status: 'active', max_speed: 80, owner_name: null, group: null,
    created_at: '2024-01-20T07:00:00Z', deleted_at: null,
    device: { id: 'd5', imei: '352748082345682', model: 'FMC920', status: 'active', last_seen: new Date().toISOString() } as never,
    driver: { id: 'dr5', full_name: 'Roberto Sandoval', phone: '+52 55 4444 5555' } as never,
    position: { lat: 19.46, lng: -99.12, speed: 90, ignition: true, recorded_at: new Date().toISOString() },
  },
  {
    id: 'v6', company_id: 'demo-company-id', economic_num: 'ECO-006',
    plates: 'MNO-987-F', brand: 'Mercedes-Benz', model: 'Actros', year: 2018,
    type: 'truck', color: 'Gris', status: 'active', max_speed: 80, owner_name: null, group: null,
    created_at: '2023-11-01T12:00:00Z', deleted_at: null,
    device: { id: 'd6', imei: '352748082345683', model: 'FMB920', status: 'no_signal', last_seen: new Date(Date.now() - 7200000).toISOString() } as never,
    driver: { id: 'dr6', full_name: 'Luis Fernando Gómez', phone: '+52 55 6666 7777' } as never,
    position: null,
  },
]
