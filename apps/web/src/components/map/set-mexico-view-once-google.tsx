'use client'

import { useCallback, useEffect } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import {
  MEXICO_BOUNDS,
  getMexicoFitPadding,
  isMobileMapViewport,
} from '@/lib/map/map-viewport'

const MEXICO_RESTRICTION = {
  latLngBounds: {
    north: MEXICO_BOUNDS.north + 1,
    south: MEXICO_BOUNDS.south - 2,
    west: MEXICO_BOUNDS.west - 2,
    east: MEXICO_BOUNDS.east + 2,
  },
  strictBounds: false,
} as const

/** Encuadra todo México según el tamaño del contenedor (fitBounds). */
export function applyMexicoFleetViewGoogle(map: google.maps.Map) {
  const padding = getMexicoFitPadding(isMobileMapViewport())
  const bounds = new google.maps.LatLngBounds(
    { lat: MEXICO_BOUNDS.south, lng: MEXICO_BOUNDS.west },
    { lat: MEXICO_BOUNDS.north, lng: MEXICO_BOUNDS.east },
  )
  map.fitBounds(bounds, padding)
  map.setOptions({ restriction: MEXICO_RESTRICTION })
}

interface Props {
  /** Incrementar para volver a la vista flota (p. ej. botón centrar). */
  applyKey?: number
}

export function SetMexicoViewOnceGoogle({ applyKey = 0 }: Props) {
  const map = useMap()

  const apply = useCallback(() => {
    if (!map) return
    applyMexicoFleetViewGoogle(map)
    google.maps.event.trigger(map, 'resize')
  }, [map])

  useEffect(() => {
    if (!map) return

    const idleListener = google.maps.event.addListenerOnce(map, 'idle', apply)
    const t1 = window.setTimeout(apply, 150)
    const t2 = window.setTimeout(apply, 500)

    return () => {
      google.maps.event.removeListener(idleListener)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [map, applyKey, apply])

  return null
}

export function resetGoogleMapToMexico(map: google.maps.Map) {
  applyMexicoFleetViewGoogle(map)
}
