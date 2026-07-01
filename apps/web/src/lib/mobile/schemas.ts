import { z } from 'zod'

export const EmergencyContactSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(7).max(30),
  email: z.string().email().max(160).nullable().optional(),
  relationship: z.string().max(60).nullable().optional(),
  priority: z.number().int().min(1).max(5).optional(),
})

export const ResponsibleContactSchema = z.object({
  name: z.string().min(1).max(120),
  phone: z.string().min(7).max(30),
  email: z.string().email().max(160).nullable().optional(),
})

export const MobileRegisterSchema = z.object({
  device_uid: z.string().min(8).max(64),
  platform: z.enum(['android', 'ios']),
  brand: z.string().max(60).nullable().optional(),
  model: z.string().max(60).nullable().optional(),
  os_version: z.string().max(30).nullable().optional(),
  app_version: z.string().max(20).nullable().optional(),
  push_token: z.string().max(512).nullable().optional(),
  permissions: z.record(z.boolean()).optional(),
})

export const MobileTelemetryPointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  speed: z.number().min(0).max(400).default(0),
  heading: z.number().min(0).max(360).default(0),
  altitude: z.number().nullable().optional(),
  accuracy: z.number().min(0).max(5000).nullable().optional(),
  recorded_at: z.string().datetime(),
  battery_pct: z.number().min(0).max(100).nullable().optional(),
  battery_charging: z.boolean().nullable().optional(),
  connection_type: z.string().max(30).nullable().optional(),
  gps_enabled: z.boolean().nullable().optional(),
  internet_available: z.boolean().nullable().optional(),
  is_moving: z.boolean().nullable().optional(),
  activity: z.enum([
    'still', 'walking', 'running', 'cycling',
    'motorcycle', 'automotive', 'unknown',
  ]).nullable().optional(),
  mock_location: z.boolean().nullable().optional(),
})

export const MobileTelemetrySchema = z.object({
  device_id: z.string().uuid().optional(),
  device_uid: z.string().min(8).max(64).optional(),
  points: z.array(MobileTelemetryPointSchema).min(1).max(100),
}).refine(d => d.device_id || d.device_uid, {
  message: 'device_id or device_uid required',
})

export const MobileEventSchema = z.object({
  device_id: z.string().uuid().optional(),
  device_uid: z.string().min(8).max(64).optional(),
  event_type: z.enum([
    'sos', 'battery_low', 'gps_disabled', 'no_internet', 'app_closed',
    'permissions_revoked', 'mock_location', 'root_detected', 'jailbreak_detected',
    'geofence_enter', 'geofence_exit', 'movement_start', 'movement_stop',
    'check_in', 'check_out',
  ]),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  payload: z.record(z.unknown()).optional(),
}).refine(d => d.device_id || d.device_uid, {
  message: 'device_id or device_uid required',
})

export const MobileConfigSchema = z.object({
  tracking_enabled: z.boolean().optional(),
  tracking_interval_sec: z.number().int().min(5).max(3600).optional(),
})

export const MobileCheckInSchema = z.object({
  device_id: z.string().uuid().optional(),
  device_uid: z.string().min(8).max(64).optional(),
  action_type: z.enum(['check_in', 'check_out', 'note', 'photo', 'qr_scan', 'barcode_scan', 'signature']),
  lat: z.number().min(-90).max(90).nullable().optional(),
  lng: z.number().min(-180).max(180).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  media_url: z.string().url().max(500).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(d => d.device_id || d.device_uid, {
  message: 'device_id or device_uid required',
})

export const LocationShareSchema = z.object({
  device_id: z.string().uuid(),
  duration_minutes: z.union([
    z.literal(15), z.literal(30), z.literal(60), z.literal(360), z.literal(1440),
  ]),
})

export const AdminMobileRegisterSchema = z.object({
  assigned_user_id: z.string().uuid(),
  platform: z.enum(['android', 'ios']),
  label: z.string().min(1).max(40).optional(),
  tracking_interval_sec: z.number().int().min(5).max(3600).default(30),
  responsible_contact: ResponsibleContactSchema.optional(),
  emergency_contacts: z.array(EmergencyContactSchema).max(5).optional(),
})

export type MobileTelemetryPoint = z.infer<typeof MobileTelemetryPointSchema>
