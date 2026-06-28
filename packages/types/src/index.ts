// ============================================================
// GPS SaaS - Tipos compartidos
// ============================================================

// ------------------------------------------------------------
// ENUMS
// ------------------------------------------------------------

export type UserRole =
  | 'super_admin'
  | 'admin_empresa'
  | 'supervisor'
  | 'operador'
  | 'cliente_consulta'
  | 'miembro_familiar'

export type CompanyStatus = 'active' | 'suspended' | 'trial' | 'cancelled' | 'demo'

export type PlanType = 'basico' | 'profesional' | 'empresarial'

export type AccountType = 'personal' | 'family' | 'business'

export type VehicleStatus = 'active' | 'inactive' | 'maintenance'

export type VehicleType =
  | 'sedan'
  | 'suv'
  | 'pickup'
  | 'van'
  | 'truck'
  | 'bus'
  | 'motorcycle'
  | 'other'

export type DeviceStatus = 'online' | 'offline' | 'no_signal' | 'unknown'

export type DeviceSourceType = 'hardware' | 'mobile'

export type MobilePlatform = 'android' | 'ios'

export type MobileEventType =
  | 'sos'
  | 'battery_low'
  | 'gps_disabled'
  | 'no_internet'
  | 'app_closed'
  | 'permissions_revoked'
  | 'mock_location'
  | 'root_detected'
  | 'jailbreak_detected'
  | 'geofence_enter'
  | 'geofence_exit'
  | 'movement_start'
  | 'movement_stop'
  | 'check_in'
  | 'check_out'

export type MobileActivityType =
  | 'still'
  | 'walking'
  | 'running'
  | 'cycling'
  | 'motorcycle'
  | 'automotive'
  | 'unknown'

export type MapAssetFilter = 'all' | 'vehicles' | 'mobile' | 'personnel'

export type GeofenceType = 'circular' | 'polygon'

export type AlertType =
  | 'speed_excess'
  | 'gps_disconnect'
  | 'signal_loss'
  | 'power_cut'
  | 'unauthorized_movement'
  | 'geofence_enter'
  | 'geofence_exit'
  | 'geofence_dwell'
  | 'sos'
  | 'maintenance_due'
  | 'ignition_on'
  | 'ignition_off'
  | 'battery_low'

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical'

export type NotificationChannel = 'platform' | 'email' | 'whatsapp' | 'push'

export type MaintenanceType =
  | 'oil_change'
  | 'tire_rotation'
  | 'brake_service'
  | 'tune_up'
  | 'insurance'
  | 'verification'
  | 'other'

// ------------------------------------------------------------
// COMPANY
// ------------------------------------------------------------

export interface Company {
  id: string
  name: string
  rfc: string | null
  phone: string | null
  email: string
  address: string | null
  logo_url: string | null
  plan_id: string
  status: CompanyStatus
  account_type: AccountType
  trial_ends_at: string | null
  created_at: string
  updated_at: string
}

export interface Plan {
  id: string
  name: string
  type: PlanType
  max_vehicles: number
  max_users: number
  price_monthly: number
  price_yearly: number
  features: PlanFeatures
  is_active: boolean
  created_at: string
}

export interface PlanFeatures {
  realtime_map: boolean
  route_history_days: number
  alerts: boolean
  geofences: boolean
  reports: boolean
  maintenance: boolean
  mobile_app: boolean
  ai_assistant: boolean
  api_access: boolean
  white_label: boolean
}

// ------------------------------------------------------------
// USER
// ------------------------------------------------------------

export interface User {
  id: string
  company_id: string
  email: string
  full_name: string
  role: UserRole
  phone: string | null
  avatar_url: string | null
  is_active: boolean
  last_sign_in_at: string | null
  created_at: string
  updated_at: string
}

// ------------------------------------------------------------
// VEHICLE
// ------------------------------------------------------------

export interface VehicleGroup {
  id: string
  company_id: string
  name: string
  color: string
  sort_order: number
  is_default: boolean
  created_at: string
  updated_at: string
}

export interface Vehicle {
  id: string
  company_id: string
  device_id: string | null
  driver_id: string | null
  group_id: string | null
  owner_name: string | null
  economic_num: string
  plates: string
  brand: string
  model: string
  year: number
  vin: string | null
  type: VehicleType
  color: string | null
  status: VehicleStatus
  max_speed: number
  /** km/L declarado; null = estimar por tipo y año */
  fuel_efficiency_km_per_l: number | null
  odometer_offset: number
  notes: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export interface VehicleWithRelations extends Vehicle {
  device: GpsDevice | null
  driver: Driver | null
  group: VehicleGroup | null
  current_position: VehiclePosition | null
}

// ------------------------------------------------------------
// DRIVER
// ------------------------------------------------------------

export interface Driver {
  id: string
  company_id: string
  full_name: string
  phone: string | null
  email: string | null
  license_num: string
  license_exp: string
  photo_url: string | null
  is_active: boolean
  created_at: string
  updated_at: string
  deleted_at: string | null
}

// ------------------------------------------------------------
// GPS DEVICE
// ------------------------------------------------------------

export interface GpsDevice {
  id: string
  company_id: string
  imei: string
  model: string
  firmware_ver: string | null
  sim_iccid: string | null
  phone_num: string | null
  last_seen: string | null
  status: DeviceStatus
  source_type: DeviceSourceType
  mobile_platform: MobilePlatform | null
  assigned_user_id: string | null
  mobile_device_uid: string | null
  tracking_interval_sec: number
  tracking_enabled: boolean
  mobile_metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ------------------------------------------------------------
// POSITION
// ------------------------------------------------------------

export interface VehiclePosition {
  id: string
  vehicle_id: string
  company_id: string
  device_id: string
  lat: number
  lng: number
  speed: number
  heading: number
  altitude: number | null
  ignition: boolean
  odometer: number
  gsm_signal: number
  battery_lvl: number
  satellites: number | null
  raw_io: Record<string, unknown> | null
  recorded_at: string
  server_at: string
}

export interface PositionHistory extends VehiclePosition {
  trip_id: string | null
}

// Live vehicle state for map
export interface LiveVehicle {
  vehicle_id: string
  company_id: string
  device_id?: string | null
  economic_num: string
  plates: string
  brand: string
  model: string
  vehicle_type: VehicleType
  group_id: string | null
  group_name: string | null
  owner_name: string | null
  driver_name: string | null
  device_status: DeviceStatus
  device_source?: DeviceSourceType
  mobile_platform?: MobilePlatform | null
  battery_pct?: number | null
  lat: number
  lng: number
  speed: number
  heading: number
  ignition: boolean
  odometer: number
  last_update: string
}

export interface MobileTelemetryPoint {
  lat: number
  lng: number
  speed: number
  heading: number
  altitude?: number | null
  accuracy?: number | null
  recorded_at: string
  battery_pct?: number | null
  battery_charging?: boolean | null
  connection_type?: string | null
  gps_enabled?: boolean | null
  internet_available?: boolean | null
  is_moving?: boolean | null
  activity?: MobileActivityType | null
  mock_location?: boolean | null
}

export interface MobileDeviceRegistration {
  device_uid: string
  platform: MobilePlatform
  brand?: string | null
  model?: string | null
  os_version?: string | null
  app_version?: string | null
  push_token?: string | null
  permissions?: Record<string, boolean>
}

// ------------------------------------------------------------
// GEOFENCE
// ------------------------------------------------------------

export interface Geofence {
  id: string
  company_id: string
  name: string
  type: GeofenceType
  // For circular: { lat, lng }
  // For polygon: { coordinates: [lng, lat][] } (GeoJSON)
  geometry: GeofenceGeometry
  radius_m: number | null
  color: string
  alert_on_enter: boolean
  alert_on_exit: boolean
  alert_on_dwell: boolean
  dwell_minutes: number | null
  schedule: GeofenceSchedule | null
  vehicle_ids: string[] | null // null = all vehicles
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface GeofenceGeometry {
  type: 'Point' | 'Polygon'
  coordinates: number[] | number[][][]
}

export interface GeofenceSchedule {
  days: number[] // 0=Sun, 1=Mon, ..., 6=Sat
  start_time: string // "HH:MM"
  end_time: string // "HH:MM"
  timezone: string
}

// ------------------------------------------------------------
// ALERT
// ------------------------------------------------------------

export interface Alert {
  id: string
  company_id: string
  vehicle_id: string
  device_id: string | null
  geofence_id: string | null
  type: AlertType
  severity: AlertSeverity
  title: string
  message: string
  lat: number | null
  lng: number | null
  speed: number | null
  payload: Record<string, unknown>
  channels_sent: NotificationChannel[]
  acknowledged_by: string | null
  acknowledged_at: string | null
  created_at: string
}

export interface AlertRule {
  id: string
  company_id: string
  type: AlertType
  name: string
  is_active: boolean
  config: AlertRuleConfig
  vehicle_ids: string[] | null // null = all
  channels: NotificationChannel[]
  created_at: string
  updated_at: string
}

export interface AlertRuleConfig {
  speed_limit?: number
  dwell_minutes?: number
  geofence_id?: string
  time_schedule?: GeofenceSchedule
}

// ------------------------------------------------------------
// MAINTENANCE
// ------------------------------------------------------------

export interface MaintenanceRecord {
  id: string
  company_id: string
  vehicle_id: string
  type: MaintenanceType
  description: string
  cost: number | null
  currency: string
  odometer_at: number | null
  next_odometer: number | null
  service_date: string
  next_service_date: string | null
  workshop: string | null
  notes: string | null
  attachments: string[]
  created_by: string
  created_at: string
}

// ------------------------------------------------------------
// SUBSCRIPTION
// ------------------------------------------------------------

export interface Subscription {
  id: string
  company_id: string
  plan_id: string
  status: 'active' | 'past_due' | 'cancelled' | 'trialing'
  current_period_start: string
  current_period_end: string
  stripe_subscription_id: string | null
  stripe_customer_id: string | null
  cancel_at_period_end: boolean
  created_at: string
  updated_at: string
}

// ------------------------------------------------------------
// API RESPONSES
// ------------------------------------------------------------

export interface ApiResponse<T> {
  data: T | null
  error: string | null
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  per_page: number
  total_pages: number
}

export interface PaginationParams {
  page?: number
  per_page?: number
  search?: string
  order_by?: string
  order?: 'asc' | 'desc'
}

// ------------------------------------------------------------
// GPS TELTONIKA TYPES
// ------------------------------------------------------------

export interface TeltonikaPacket {
  imei: string
  codec: 8 | 8 | 16
  records: TeltonikaRecord[]
  raw: Buffer
}

export interface TeltonikaRecord {
  timestamp: Date
  priority: 0 | 1 | 2 // Low, High, Panic
  lat: number
  lng: number
  altitude: number
  heading: number
  satellites: number
  speed: number
  io_elements: TeltonikaIOElements
}

export interface TeltonikaIOElements {
  event_io_id: number
  total_io: number
  // Standard I/O
  ignition?: boolean           // IO 239
  movement?: boolean           // IO 240
  gsm_signal?: number          // IO 21
  speed?: number               // IO 24
  battery_voltage?: number     // IO 67
  external_voltage?: number    // IO 66
  odometer?: number            // IO 16
  total_odometer?: number      // IO 199
  gnss_status?: number         // IO 69
  gnss_pdop?: number           // IO 181
  gnss_hdop?: number           // IO 182
  sleep_mode?: number          // IO 200
  // Raw values for other IOs
  [key: string]: unknown
}

// ------------------------------------------------------------
// DASHBOARD
// ------------------------------------------------------------

export interface DashboardStats {
  total_vehicles: number
  vehicles_online: number
  vehicles_stopped: number
  vehicles_offline: number
  vehicles_no_signal: number
  active_alerts: number
  km_today: number
  km_month: number
  productivity_today: number  // %
  productivity_month: number  // %
}

// ------------------------------------------------------------
// REPORTS
// ------------------------------------------------------------

export interface ReportFilter {
  vehicle_ids?: string[]
  driver_ids?: string[]
  date_from: string
  date_to: string
  group_by?: 'day' | 'week' | 'month'
}

export interface KilometrageReport {
  vehicle_id: string
  economic_num: string
  plates: string
  driver_name: string | null
  total_km: number
  trips: number
  avg_speed: number
  max_speed: number
  driving_time_minutes: number
  stopped_time_minutes: number
}

export interface TripReport {
  id: string
  vehicle_id: string
  started_at: string
  ended_at: string
  start_address: string | null
  end_address: string | null
  distance_km: number
  duration_minutes: number
  avg_speed: number
  max_speed: number
  points: Array<{ lat: number; lng: number; speed: number; ts: string }>
}
