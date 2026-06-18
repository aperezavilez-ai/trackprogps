'use client'

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import { MEXICO_GEO_CENTER, MEXICO_DEFAULT_ZOOM, MEXICO_LEAFLET_BOUNDS } from '@/lib/map/map-viewport'

/** Vista fija en México al cargar — sin fitBounds global */
export function SetMexicoViewOnce() {
  const map = useMap()
  const doneRef = useRef(false)

  useEffect(() => {
    if (doneRef.current) return
    map.setView([MEXICO_GEO_CENTER.lat, MEXICO_GEO_CENTER.lng], MEXICO_DEFAULT_ZOOM)
    map.setMaxBounds(L.latLngBounds(MEXICO_LEAFLET_BOUNDS).pad(0.02))
    doneRef.current = true
  }, [map])

  return null
}
