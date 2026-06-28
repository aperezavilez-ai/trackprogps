import type { VehicleType } from '@gps-saas/types'

/** Teltonika / GPS IO comunes para nivel de combustible */
const FUEL_LEVEL_KEYS = ['48', '89', '179', 'fuel_level', 'Fuel Level', 'fuelLevel']

/** km/L por tipo cuando no hay dato manual (promedios México) */
const DEFAULT_KM_PER_L: Record<VehicleType, number> = {
  motorcycle: 35,
  sedan: 14,
  suv: 11,
  pickup: 10,
  van: 9,
  truck: 6,
  bus: 4,
  other: 10,
}

export interface FuelVehicleContext {
  type?: VehicleType | string | null
  year?: number | null
  fuel_efficiency_km_per_l?: number | null
}

export function parseFuelFromRawIo(rawIo: Record<string, unknown> | null | undefined): {
  levelPct: number | null
} {
  if (!rawIo || typeof rawIo !== 'object') return { levelPct: null }

  for (const key of FUEL_LEVEL_KEYS) {
    const v = rawIo[key]
    if (v === undefined || v === null) continue
    const n = Number(v)
    if (!Number.isFinite(n)) continue
    if (n >= 0 && n <= 100) return { levelPct: Math.round(n) }
    if (n > 100 && n <= 10000) return { levelPct: Math.min(100, Math.round(n / 100)) }
  }
  return { levelPct: null }
}

/** Factor por antigüedad: vehículos >3 años pierden rendimiento gradualmente */
export function yearEfficiencyFactor(year: number | null | undefined): number {
  if (!year || year < 1990) return 1
  const age = new Date().getFullYear() - year
  if (age <= 3) return 1
  return Math.max(0.72, 1 - (age - 3) * 0.015)
}

export function defaultKmPerL(type: VehicleType | string | null | undefined): number {
  const key = (type ?? 'other') as VehicleType
  return DEFAULT_KM_PER_L[key in DEFAULT_KM_PER_L ? key : 'other']
}

/** Cascada: manual → tipo+año → default 10 km/L equivalente */
export function resolveKmPerL(ctx: FuelVehicleContext | null | undefined): number {
  const manual = ctx?.fuel_efficiency_km_per_l
  if (manual != null && manual > 0) return manual

  const base = defaultKmPerL(ctx?.type)
  return Math.round(base * yearEfficiencyFactor(ctx?.year) * 100) / 100
}

export function estimateFuelLiters(
  distanceKm: number,
  ctx?: FuelVehicleContext | null,
): number {
  if (distanceKm <= 0) return 0
  const kmPerL = resolveKmPerL(ctx)
  const liters = (distanceKm * 100) / (kmPerL * 100)
  return Math.round(liters * 10) / 10
}

/** Para UI: texto de origen del cálculo */
export function fuelEstimateSourceLabel(ctx: FuelVehicleContext | null | undefined): string {
  if (ctx?.fuel_efficiency_km_per_l != null && ctx.fuel_efficiency_km_per_l > 0) {
    return `Rendimiento declarado (${ctx.fuel_efficiency_km_per_l} km/L)`
  }
  const kmPerL = resolveKmPerL(ctx)
  return `Estimado por tipo/año (~${kmPerL} km/L)`
}
