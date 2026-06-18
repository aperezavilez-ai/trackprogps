'use client'

import { useEffect, useCallback } from 'react'
import { useMap, Circle, Polygon, Polyline, AdvancedMarker } from '@vis.gl/react-google-maps'
import { MapPin } from 'lucide-react'

export type DrawType = 'circular' | 'polygon'

interface GeofenceDrawLayerProps {
  enabled: boolean
  drawType: DrawType
  color: string
  radiusM: number
  center: google.maps.LatLngLiteral | null
  polygonPoints: google.maps.LatLngLiteral[]
  onMapClick: (pos: google.maps.LatLngLiteral) => void
}

export function GeofenceDrawLayer({
  enabled,
  drawType,
  color,
  radiusM,
  center,
  polygonPoints,
  onMapClick,
}: GeofenceDrawLayerProps) {
  const map = useMap()

  const handleClick = useCallback(
    (pos: google.maps.LatLngLiteral) => onMapClick(pos),
    [onMapClick]
  )

  useEffect(() => {
    if (!map || !enabled) return
    const listener = map.addListener('click', (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return
      handleClick({ lat: e.latLng.lat(), lng: e.latLng.lng() })
    })
    return () => { google.maps.event.removeListener(listener) }
  }, [map, enabled, handleClick])

  useEffect(() => {
    if (!map) return
    map.setOptions({ draggableCursor: enabled ? 'crosshair' : undefined })
    return () => { map.setOptions({ draggableCursor: undefined }) }
  }, [map, enabled])

  if (!enabled) return null

  const closedPolygon =
    polygonPoints.length >= 3
      ? [...polygonPoints, polygonPoints[0]!]
      : polygonPoints

  return (
    <>
      {drawType === 'circular' && center && (
        <>
          <AdvancedMarker position={center} zIndex={1000}>
            <div className="flex flex-col items-center -translate-y-1">
              <MapPin className="w-8 h-8 drop-shadow-lg" style={{ color }} fill={color} stroke="white" strokeWidth={1.5} />
            </div>
          </AdvancedMarker>
          <Circle
            center={center}
            radius={radiusM}
            fillColor={color}
            fillOpacity={0.25}
            strokeColor={color}
            strokeWeight={2.5}
            strokeOpacity={0.9}
          />
        </>
      )}

      {drawType === 'polygon' && polygonPoints.map((pt, i) => (
        <AdvancedMarker key={`${pt.lat}-${pt.lng}-${i}`} position={pt} zIndex={1000 + i}>
          <div
            className="w-6 h-6 rounded-full border-2 border-white shadow-lg flex items-center justify-center text-[10px] font-bold text-white"
            style={{ backgroundColor: color }}
          >
            {i + 1}
          </div>
        </AdvancedMarker>
      ))}

      {drawType === 'polygon' && polygonPoints.length >= 2 && polygonPoints.length < 3 && (
        <Polyline
          path={polygonPoints}
          strokeColor={color}
          strokeWeight={3}
          strokeOpacity={0.9}
        />
      )}

      {drawType === 'polygon' && closedPolygon.length >= 4 && (
        <Polygon
          paths={closedPolygon}
          fillColor={color}
          fillOpacity={0.25}
          strokeColor={color}
          strokeWeight={2.5}
          strokeOpacity={0.9}
        />
      )}
    </>
  )
}

export function buildPolygonGeometry(points: google.maps.LatLngLiteral[]) {
  if (points.length < 3) return null
  const ring = points.map(p => [p.lng, p.lat])
  ring.push([points[0]!.lng, points[0]!.lat])
  return { type: 'Polygon' as const, coordinates: [ring] }
}
