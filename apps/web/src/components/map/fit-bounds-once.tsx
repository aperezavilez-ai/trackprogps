'use client'

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  filterMexicoPositions,
  MEXICO_DEFAULT_CENTER,
  MEXICO_DEFAULT_ZOOM,
} from '@/lib/map/map-viewport'

/** Ajusta el mapa una vez al cargar — solo unidades en México */
export function FitBoundsOnce({ positions }: { positions: [number, number][] }) {
  const map = useMap()
  const doneRef = useRef(false)

  useEffect(() => {
    if (doneRef.current) return

    const asObjects = positions.map(([lat, lng]) => ({ lat, lng }))
    const inMexico = filterMexicoPositions(asObjects)

    if (inMexico.length === 0) {
      map.setView([MEXICO_DEFAULT_CENTER.lat, MEXICO_DEFAULT_CENTER.lng], MEXICO_DEFAULT_ZOOM)
      doneRef.current = true
      return
    }

    if (inMexico.length === 1) {
      const p = inMexico[0]!
      map.setView([p.lat, p.lng], 12)
      doneRef.current = true
      return
    }

    const bounds = L.latLngBounds(inMexico.map(p => [p.lat, p.lng] as [number, number]))
    map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 })
    doneRef.current = true
  }, [map, positions])

  return null
}
