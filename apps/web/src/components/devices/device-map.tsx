'use client'

import { useEffect, useState } from 'react'
import { MapContainer, Marker, useMap } from 'react-leaflet'
import { ProTrackTiles } from '@/components/map/protrack-tiles'
import { MapStyleSwitcher } from '@/components/map/map-style-switcher'
import { createDevicePinIcon } from '@/lib/map/vehicle-marker'
import type { MapStyle } from '@/lib/map/tiles'
import 'leaflet/dist/leaflet.css'

interface Props {
  lat: number
  lng: number
  label: string
  deviceSource?: 'mobile' | 'hardware'
}

export function DeviceMap({ lat, lng, label, deviceSource = 'hardware' }: Props) {
  const [mapStyle, setMapStyle] = useState<MapStyle>('hybrid')

  return (
    <div className="relative">
      <MapContainer
        center={[lat, lng]}
        zoom={17}
        className="w-full h-[40vh] min-h-[220px] sm:h-64"
        scrollWheelZoom
      >
        <ProTrackTiles style={mapStyle} />
        <SyncMapView lat={lat} lng={lng} />
        <Marker position={[lat, lng]} icon={createDevicePinIcon(null, deviceSource)} />
      </MapContainer>
      <div className="absolute top-3 left-3 bg-black/60 backdrop-blur text-white text-xs font-medium px-2.5 py-1 rounded-lg z-[1000] pointer-events-none">
        {label}
      </div>
      <div className="absolute bottom-3 right-3 z-[1000] scale-90 origin-bottom-right">
        <MapStyleSwitcher style={mapStyle} onChange={setMapStyle} />
      </div>
    </div>
  )
}

function SyncMapView({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap()

  useEffect(() => {
    const center: [number, number] = [lat, lng]
    map.setView(center, Math.max(map.getZoom(), 17), { animate: false })
    const timers = [
      window.setTimeout(() => map.invalidateSize({ animate: false }), 50),
      window.setTimeout(() => map.invalidateSize({ animate: false }), 350),
    ]
    return () => timers.forEach(timer => window.clearTimeout(timer))
  }, [lat, lng, map])

  return null
}
