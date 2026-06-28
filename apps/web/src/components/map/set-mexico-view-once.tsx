'use client'

import { useEffect } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import {
  MEXICO_LEAFLET_BOUNDS,
  getMexicoFitPadding,
  isMobileMapViewport,
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

interface Props {
  applyKey?: number
}

export function SetMexicoViewOnce({ applyKey = 0 }: Props) {
  const map = useMap()

  useEffect(() => {
    const run = () => {
      applyMexicoFleetViewLeaflet(map)
      map.invalidateSize()
    }
    run()
    const t = window.setTimeout(run, 400)
    return () => clearTimeout(t)
  }, [map, applyKey])

  return null
}
