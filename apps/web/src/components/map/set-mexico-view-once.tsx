'use client'

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  MEXICO_LEAFLET_BOUNDS,
  getMexicoFitPadding,
  isMobileMapViewport,
  isInMexico,
} from '@/lib/map/map-viewport'

export function applyMexicoFleetViewLeaflet(map: L.Map) {
  const padding = getMexicoFitPadding(isMobileMapViewport())
  map.fitBounds(MEXICO_LEAFLET_BOUNDS, {
    paddingTopLeft: L.point(padding.left, padding.top),
    paddingBottomRight: L.point(padding.right, padding.bottom),
    maxZoom: isMobileMapViewport() ? 5 : 6,
  })
  map.setMaxBounds(L.latLngBounds(MEXICO_LEAFLET_BOUNDS).pad(0.02))
}

export function applyLeafletFleetView(
  map: L.Map,
  positions: Array<{ lat: number; lng: number }>,
) {
  const valid = positions.filter((point) => isInMexico(point.lat, point.lng))
  map.setMaxBounds(L.latLngBounds(MEXICO_LEAFLET_BOUNDS).pad(0.02))

  if (valid.length === 0) {
    applyMexicoFleetViewLeaflet(map)
    return
  }

  if (valid.length === 1) {
    const point = valid[0]!
    map.setView([point.lat, point.lng], isMobileMapViewport() ? 14 : 12)
    return
  }

  const padding = isMobileMapViewport()
    ? { top: 64, bottom: 96, left: 36, right: 36 }
    : { top: 72, bottom: 112, left: 72, right: 88 }
  map.fitBounds(valid.map((point) => [point.lat, point.lng]), {
    paddingTopLeft: L.point(padding.left, padding.top),
    paddingBottomRight: L.point(padding.right, padding.bottom),
    maxZoom: 14,
  })
}

interface Props {
  applyKey?: number
  positions?: Array<{ lat: number; lng: number }>
}

export function SetMexicoViewOnce({ applyKey = 0, positions = [] }: Props) {
  const map = useMap()
  const lastApplyKeyRef = useRef<number | null>(null)
  const appliedWithPositionsRef = useRef(false)

  useEffect(() => {
    const shouldApply =
      lastApplyKeyRef.current !== applyKey ||
      (!appliedWithPositionsRef.current && positions.length > 0)
    if (!shouldApply) return

    lastApplyKeyRef.current = applyKey
    if (positions.length > 0) appliedWithPositionsRef.current = true

    const run = () => {
      applyLeafletFleetView(map, positions)
      map.invalidateSize()
    }
    run()
    const t = window.setTimeout(run, 400)
    return () => clearTimeout(t)
  }, [map, applyKey, positions])

  return null
}
