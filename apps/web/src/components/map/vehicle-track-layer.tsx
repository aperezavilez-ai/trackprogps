'use client'

import { useEffect, useState } from 'react'
import { Polyline, useMap } from 'react-leaflet'
import L from 'leaflet'
import { filterMexicoPositions } from '@/lib/map/map-viewport'

interface Props {
  vehicleId: string | null
}

export function VehicleTrackLayer({ vehicleId }: Props) {
  const map = useMap()
  const [positions, setPositions] = useState<[number, number][]>([])

  useEffect(() => {
    if (!vehicleId) {
      setPositions([])
      return
    }

    let cancelled = false
    fetch(`/api/vehicles/${vehicleId}/track?hours=6`)
      .then(r => r.json())
      .then(json => {
        if (cancelled) return
        const track = json.data?.track ?? []
        const coords: [number, number][] = track.map((p: { lat: number; lng: number }) => [p.lat, p.lng])
        setPositions(coords)
        const inMexico = filterMexicoPositions(track)
        if (inMexico.length > 1) {
          map.fitBounds(
            L.latLngBounds(inMexico.map(p => [p.lat, p.lng] as [number, number])),
            { padding: [60, 60], maxZoom: 15 },
          )
        }
      })
      .catch(() => setPositions([]))

    return () => { cancelled = true }
  }, [vehicleId, map])

  if (positions.length < 2) return null

  return (
    <>
      <Polyline
        positions={positions}
        pathOptions={{
          color: '#F97316',
          weight: 4,
          opacity: 0.85,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      <Polyline
        positions={positions}
        pathOptions={{
          color: '#93C5FD',
          weight: 8,
          opacity: 0.25,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </>
  )
}
