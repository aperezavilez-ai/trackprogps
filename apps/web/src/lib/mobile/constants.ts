/** Intervalos de rastreo permitidos (segundos) */
export const MOBILE_TRACKING_INTERVALS = [5, 10, 30, 60, 300] as const

export const MOBILE_SHARE_DURATIONS_MIN = [15, 30, 60, 360, 1440] as const

export function mobileImeiFromUid(deviceUid: string): string {
  const clean = deviceUid.replace(/[^a-zA-Z0-9-]/g, '').slice(0, 56)
  return `MOB-${clean}`
}

export function isMobileImei(imei: string): boolean {
  return imei.startsWith('MOB-')
}
