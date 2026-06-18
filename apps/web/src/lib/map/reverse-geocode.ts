const geocodeCache = new Map<string, string>()

function toKey(lat: number, lng: number) {
  return `${lat.toFixed(4)},${lng.toFixed(4)}`
}

export async function reverseGeocodeLatLng(lat: number, lng: number): Promise<string | null> {
  const key = toKey(lat, lng)
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null

  try {
    const url = new URL('https://nominatim.openstreetmap.org/reverse')
    url.searchParams.set('format', 'jsonv2')
    url.searchParams.set('lat', String(lat))
    url.searchParams.set('lon', String(lng))
    url.searchParams.set('zoom', '17')
    url.searchParams.set('addressdetails', '0')
    url.searchParams.set('accept-language', 'es')

    const res = await fetch(url.toString())
    if (!res.ok) return null
    const data = (await res.json()) as { display_name?: string }
    const value = data.display_name?.trim() ?? null
    if (!value) return null
    geocodeCache.set(key, value)
    return value
  } catch {
    return null
  }
}
