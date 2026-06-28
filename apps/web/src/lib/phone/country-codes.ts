export interface CountryDialCode {
  iso: string
  name: string
  dial: string
  flag: string
}

/** Países frecuentes en TrackPro (México primero) */
export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
  { iso: 'MX', name: 'México', dial: '+52', flag: '🇲🇽' },
  { iso: 'US', name: 'Estados Unidos', dial: '+1', flag: '🇺🇸' },
  { iso: 'CA', name: 'Canadá', dial: '+1', flag: '🇨🇦' },
  { iso: 'GT', name: 'Guatemala', dial: '+502', flag: '🇬🇹' },
  { iso: 'HN', name: 'Honduras', dial: '+504', flag: '🇭🇳' },
  { iso: 'SV', name: 'El Salvador', dial: '+503', flag: '🇸🇻' },
  { iso: 'NI', name: 'Nicaragua', dial: '+505', flag: '🇳🇮' },
  { iso: 'CR', name: 'Costa Rica', dial: '+506', flag: '🇨🇷' },
  { iso: 'PA', name: 'Panamá', dial: '+507', flag: '🇵🇦' },
  { iso: 'CO', name: 'Colombia', dial: '+57', flag: '🇨🇴' },
  { iso: 'VE', name: 'Venezuela', dial: '+58', flag: '🇻🇪' },
  { iso: 'EC', name: 'Ecuador', dial: '+593', flag: '🇪🇨' },
  { iso: 'PE', name: 'Perú', dial: '+51', flag: '🇵🇪' },
  { iso: 'CL', name: 'Chile', dial: '+56', flag: '🇨🇱' },
  { iso: 'AR', name: 'Argentina', dial: '+54', flag: '🇦🇷' },
  { iso: 'BO', name: 'Bolivia', dial: '+591', flag: '🇧🇴' },
  { iso: 'PY', name: 'Paraguay', dial: '+595', flag: '🇵🇾' },
  { iso: 'UY', name: 'Uruguay', dial: '+598', flag: '🇺🇾' },
  { iso: 'BR', name: 'Brasil', dial: '+55', flag: '🇧🇷' },
  { iso: 'ES', name: 'España', dial: '+34', flag: '🇪🇸' },
]

const TZ_TO_COUNTRY: Record<string, string> = {
  'America/Mexico_City': 'MX',
  'America/Tijuana': 'MX',
  'America/Hermosillo': 'MX',
  'America/Mazatlan': 'MX',
  'America/Chihuahua': 'MX',
  'America/Monterrey': 'MX',
  'America/Cancun': 'MX',
  'America/Merida': 'MX',
  'America/New_York': 'US',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Los_Angeles': 'US',
  'America/Toronto': 'CA',
  'America/Guatemala': 'GT',
  'America/Tegucigalpa': 'HN',
  'America/El_Salvador': 'SV',
  'America/Managua': 'NI',
  'America/Costa_Rica': 'CR',
  'America/Panama': 'PA',
  'America/Bogota': 'CO',
  'America/Caracas': 'VE',
  'America/Guayaquil': 'EC',
  'America/Lima': 'PE',
  'America/Santiago': 'CL',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Sao_Paulo': 'BR',
  'Europe/Madrid': 'ES',
}

export function getCountryByIso(iso: string): CountryDialCode {
  return COUNTRY_DIAL_CODES.find(c => c.iso === iso) ?? COUNTRY_DIAL_CODES[0]!
}

export function detectDefaultCountryIso(): string {
  if (typeof window === 'undefined') return 'MX'

  const langs = [...(navigator.languages ?? []), navigator.language].filter(Boolean)
  for (const lang of langs) {
    const part = lang.split('-')[1]?.toUpperCase()
    if (part && COUNTRY_DIAL_CODES.some(c => c.iso === part)) return part
  }

  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone
    if (tz && TZ_TO_COUNTRY[tz]) return TZ_TO_COUNTRY[tz]
  } catch { /* ignore */ }

  return 'MX'
}

export function formatPhoneE164(dial: string, national: string): string {
  const code = dial.replace(/\D/g, '')
  const digits = national.replace(/\D/g, '')
  return `+${code}${digits}`
}

export function formatPhoneDisplay(e164: string): string {
  const digits = e164.replace(/\D/g, '')
  if (digits.length <= 10) return e164
  const country = COUNTRY_DIAL_CODES.find(c => digits.startsWith(c.dial.replace('+', '')))
  if (!country) return `+${digits}`
  const national = digits.slice(country.dial.replace('+', '').length)
  return `${country.dial} ${national}`
}

export function nationalDigitsOnly(value: string): string {
  return value.replace(/\D/g, '').slice(0, 15)
}
