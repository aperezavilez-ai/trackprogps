/**
 * Catálogo de modelos GPS compatibles con TrackProGps.
 * Protocolo nativo del servidor: Teltonika Codec 8/16 (TCP).
 * Queclink / Concox: registro e inventario; integración de protocolo según modelo.
 */

export interface DeviceModelGroup {
  label: string
  hint?: string
  models: string[]
}

export const DEVICE_MODEL_GROUPS: DeviceModelGroup[] = [
  {
    label: 'Teltonika — Básicos (2G/4G, uso personal y motos)',
    models: [
      'FMB001', 'FMB010', 'FMB020', 'FMB120', 'FMB122', 'FMB125',
      'FMB920', 'FMB962', 'FMB964',
      'TAT100', 'TAT140',
      'MTB100',
    ],
  },
  {
    label: 'Teltonika — Comerciales (flotilla, camioneta, van)',
    models: [
      'FMB130', 'FMB140', 'FMB240', 'FMB640',
      'FMC125', 'FMC130', 'FMC150', 'FMC920', 'FMC003',
      'FMM125', 'FMM130', 'FMM920', 'FMM640',
      'FTS100', 'FTS100H',
    ],
  },
  {
    label: 'Teltonika — Avanzados (CAN, combustible, remolque, wearable)',
    models: [
      'FMC640', 'FMC650', 'FMC800', 'FMC880',
      'FMB640', 'FMB964',
      'FMM640', 'FMM880',
      'TAT240', 'TFT100',
      'GH5200',
    ],
  },
  {
    label: 'Queclink — Básicos y comerciales',
    models: [
      'GV20', 'GV55', 'GV55W', 'GV55 Lite',
      'GV75', 'GV75P',
      'GL300', 'GL300W', 'GL320', 'GL500', 'GL520',
      'GMT100',
    ],
  },
  {
    label: 'Queclink — Avanzados (flotilla pesada, ELD)',
    models: [
      'GV500', 'GV500MAP', 'GV600', 'GV600W',
      'GV800', 'GV800W',
      'GV350M', 'GV500MA',
    ],
  },
  {
    label: 'Concox / Jimi — Económicos',
    models: [
      'GT06', 'GT06N', 'GT06E', 'GT710', 'GT710L',
      'GV20', 'GV40', 'JM-VL01', 'JM-VL03',
      'WeTrack2',
    ],
  },
  {
    label: 'Concox / Jimi — Comerciales',
    models: [
      'GT800', 'GT800L', 'GV50', 'GV75',
      'AT4', 'AT6', 'LL301',
    ],
  },
  {
    label: 'Otros protocolos comunes (registro)',
    hint: 'Requieren verificar compatibilidad con el servidor',
    models: [
      'Coban TK103', 'Coban TK303',
      'Sinotrack ST-901', 'Sinotrack ST-906',
      'Ruptela FM-Eco4', 'Ruptela FM-Pro4',
      'CalAmp LMU-3030',
      'Otro',
    ],
  },
  {
    label: 'TrackProGPS Mobile — Teléfonos',
    hint: 'Rastreo vía app oficial Android / iPhone (HTTPS)',
    models: ['TrackProGPS Android', 'TrackProGPS iPhone'],
  },
]

export const DEFAULT_DEVICE_MODEL = 'FMC920'

export const ALL_DEVICE_MODELS = DEVICE_MODEL_GROUPS.flatMap(g => g.models)
