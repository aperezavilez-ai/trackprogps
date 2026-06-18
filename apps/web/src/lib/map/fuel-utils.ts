/** Teltonika / GPS IO comunes para nivel de combustible */
const FUEL_LEVEL_KEYS = ['48', '89', '179', 'fuel_level', 'Fuel Level', 'fuelLevel']

const AVG_LITERS_PER_100KM = 10

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

export function estimateFuelLiters(distanceKm: number): number {
  return Math.round((distanceKm * AVG_LITERS_PER_100KM) / 100 * 10) / 10
}
