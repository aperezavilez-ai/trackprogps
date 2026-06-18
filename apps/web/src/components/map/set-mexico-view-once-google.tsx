'use client'

import { useEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import { MEXICO_GEO_CENTER, MEXICO_DEFAULT_ZOOM } from '@/lib/map/map-viewport'

/** Vista fija en México al cargar — sin fitBounds global */
export function SetMexicoViewOnceGoogle() {
  const map = useMap()
  const doneRef = useRef(false)

  useEffect(() => {
    if (!map || doneRef.current) return
    map.setCenter(MEXICO_GEO_CENTER)
    map.setZoom(MEXICO_DEFAULT_ZOOM)
    map.setOptions({
      restriction: {
        latLngBounds: {
          north: 33.5,
          south: 14.0,
          west: -119.0,
          east: -86.0,
        },
        strictBounds: false,
      },
    })
    doneRef.current = true
  }, [map])

  return null
}
