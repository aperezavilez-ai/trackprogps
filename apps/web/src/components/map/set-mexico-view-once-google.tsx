'use client'

import { useEffect, useRef } from 'react'
import { useMap } from '@vis.gl/react-google-maps'
import {
  MEXICO_BOUNDS,
  getMexicoFitPadding,
  isMobileMapViewport,
  isInMexico,
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

export function applyGoogleFleetView(
  map: google.maps.Map,
  positions: Array<{ lat: number; lng: number }>,
) {
  const valid = positions.filter((point) => isInMexico(point.lat, point.lng))
  map.setOptions({ restriction: MEXICO_RESTRICTION })

  if (valid.length === 0) {
    applyMexicoFleetViewGoogle(map)
    return
  }

  if (valid.length === 1) {
    map.setCenter(valid[0]!)
    map.setZoom(isMobileMapViewport() ? 14 : 12)
    return
  }

  const bounds = new google.maps.LatLngBounds()
  valid.forEach((point) => bounds.extend(point))
  const padding = isMobileMapViewport()
    ? { top: 64, bottom: 96, left: 36, right: 36 }
    : { top: 72, bottom: 112, left: 72, right: 88 }
  map.fitBounds(bounds, padding)
  google.maps.event.addListenerOnce(map, 'idle', () => {
    const zoom = map.getZoom()
    if (zoom && zoom > 14) map.setZoom(14)
  })
}

interface Props {
  /** Incrementar para volver a la vista flota (p. ej. botón centrar). */
  applyKey?: number
  positions?: Array<{ lat: number; lng: number }>
}

export function SetMexicoViewOnceGoogle({ applyKey = 0, positions = [] }: Props) {
  const map = useMap()
  const lastApplyKeyRef = useRef<number | null>(null)
  const appliedWithPositionsRef = useRef(false)

  useEffect(() => {
    if (!map) return
    const shouldApply =
      lastApplyKeyRef.current !== applyKey ||
      (!appliedWithPositionsRef.current && positions.length > 0)
    if (!shouldApply) return

    lastApplyKeyRef.current = applyKey
    if (positions.length > 0) appliedWithPositionsRef.current = true

    const apply = () => {
      applyGoogleFleetView(map, positions)
      google.maps.event.trigger(map, 'resize')
    }

    const idleListener = google.maps.event.addListenerOnce(map, 'idle', apply)
    const t1 = window.setTimeout(apply, 150)
    const t2 = window.setTimeout(apply, 500)

    return () => {
      google.maps.event.removeListener(idleListener)
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [map, applyKey, positions])

  return null
}

export function resetGoogleMapToMexico(map: google.maps.Map) {
  applyMexicoFleetViewGoogle(map)
}
