/** Centro del noroeste de México — vista del dashboard con flota regional */
export const MEXICO_GEO_CENTER = { lat: 27.2, lng: -109.5 }
export const MEXICO_DEFAULT_CENTER = { lat: 19.4326, lng: -99.1332 }
export const MEXICO_DEFAULT_ZOOM = 6

/** Límites territoriales de México (sin sur de EE.UU.) */
export const MEXICO_BOUNDS = {
  south: 14.5,
  north: 32.72,
  west: -118.4,
  east: -86.7,
}

/** Excluye coordenadas típicas de EE.UU. que caen en el rectángulo fronterizo */
export function isInMexico(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false
  if (lat === 0 && lng === 0) return false
  if (lng > -86.7 || lng < -118.4) return false
  if (lat < 14.5 || lat > 32.72) return false

  // Sur de EE.UU. dentro del rectángulo (Texas, Nuevo México, Arizona, California)
  if (lat >= 31.0 && lng >= -117.2 && lng <= -106.0) {
    // Frontera MX: aproximación — al sur de la frontera es México
    if (lat >= 32.5) return false
    if (lng >= -115.0 && lat >= 32.0) return false // California/Arizona
    if (lng >= -106.5 && lat >= 31.8) return false // Texas occidental
  }
  if (lat >= 25.8 && lng >= -97.5 && lng <= -93.0) return false // Texas sur/Golfo US

  return true
}

export function filterMexicoPositions(
  positions: Array<{ lat: number; lng: number }>
): Array<{ lat: number; lng: number }> {
  return positions.filter(p => isInMexico(p.lat, p.lng))
}

export function getMexicoFleetCenter(
  positions: Array<{ lat: number; lng: number }>
): { lat: number; lng: number } {
  const inMx = filterMexicoPositions(positions)
  if (inMx.length === 0) return MEXICO_GEO_CENTER

  const lat = inMx.reduce((s, p) => s + p.lat, 0) / inMx.length
  const lng = inMx.reduce((s, p) => s + p.lng, 0) / inMx.length
  return { lat, lng }
}

export const MEXICO_LEAFLET_BOUNDS: [[number, number], [number, number]] = [
  [MEXICO_BOUNDS.south, MEXICO_BOUNDS.west],
  [MEXICO_BOUNDS.north, MEXICO_BOUNDS.east],
]
