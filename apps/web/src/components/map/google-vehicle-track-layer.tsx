'use client'

import { useEffect, useState } from 'react'
import { Polyline, useMap } from '@vis.gl/react-google-maps'
import { filterMexicoPositions } from '@/lib/map/map-viewport'

interface Props {
  vehicleId: string | null
}

export function GoogleVehicleTrackLayer({ vehicleId }: Props) {
  const map = useMap()
  const [path, setPath] = useState<google.maps.LatLngLiteral[]>([])

  useEffect(() => {
    if (!vehicleId) {
      setPath([])
      return
    }

    let cancelled = false
    fetch(`/api/vehicles/${vehicleId}/track?hours=6`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return
        const track = json.data?.track ?? []
        const coords = track.map((p: { lat: number; lng: number }) => ({ lat: p.lat, lng: p.lng }))
        setPath(coords)
        const inMexico = filterMexicoPositions(track)
        if (inMexico.length > 1 && map) {
          const bounds = new google.maps.LatLngBounds()
          inMexico.forEach((c: { lat: number; lng: number }) => bounds.extend(c))
          map.fitBounds(bounds, { top: 80, bottom: 200, left: 40, right: 40 })
        }
      })
      .catch(() => setPath([]))

    return () => { cancelled = true }
  }, [vehicleId, map])

  if (path.length < 2) return null

  return (
    <>
      <Polyline
        path={path}
        strokeColor="#93C5FD"
        strokeWeight={10}
        strokeOpacity={0.35}
      />
      <Polyline
        path={path}
        strokeColor="#F97316"
        strokeWeight={4}
        strokeOpacity={0.9}
      />
    </>
  )
}
