'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  APIProvider,
  Map,
  AdvancedMarker,
  Pin,
  InfoWindow,
  useMap,
} from '@vis.gl/react-google-maps'
import { useMapStore } from '@/lib/stores/app-store'
import { useRealtimeVehicles } from '@/lib/hooks/use-realtime'
import type { LiveVehicle } from '@gps-saas/types'

interface RealtimeMapProps {
  companyId: string
  initialVehicles: LiveVehicle[]
}

export function RealtimeMap({ companyId, initialVehicles }: RealtimeMapProps) {
  const apiKey = process.env['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY']!

  return (
    <APIProvider apiKey={apiKey}>
      <MapContent companyId={companyId} initialVehicles={initialVehicles} />
    </APIProvider>
  )
}

function MapContent({ companyId, initialVehicles }: RealtimeMapProps) {
  const map = useMap()
  const {
    vehicles,
    selectedVehicleId,
    mapCenter,
    mapZoom,
    filter,
    setSelectedVehicle,
    updateVehicle,
  } = useMapStore()

  // Initialize with server-side data
  useEffect(() => {
    initialVehicles.forEach((v) => {
      updateVehicle(v.vehicle_id, {
        lat:        v.lat,
        lng:        v.lng,
        speed:      v.speed,
        heading:    v.heading,
        ignition:   v.ignition,
        lastUpdate: v.last_update,
        economicNum: v.economic_num,
        plates:     v.plates,
      })
    })
  }, [initialVehicles, updateVehicle])

  // Subscribe to realtime updates
  useRealtimeVehicles(companyId)

  // Filter vehicles
  const filteredVehicles = useMemo(() => {
    const all = [...vehicles.values()]
    switch (filter) {
      case 'online':  return all.filter(v => v.ignition)
      case 'offline': return all.filter(v => !v.ignition)
      case 'moving':  return all.filter(v => v.speed > 2)
      case 'stopped': return all.filter(v => v.speed <= 2 && v.ignition)
      default:        return all
    }
  }, [vehicles, filter])

  // Auto-fit bounds when vehicles change
  useEffect(() => {
    if (!map || filteredVehicles.length === 0) return

    const bounds = new google.maps.LatLngBounds()
    filteredVehicles.forEach(v => bounds.extend({ lat: v.lat, lng: v.lng }))
    map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 })
  }, [map, filteredVehicles])

  const selectedVehicle = selectedVehicleId
    ? vehicles.get(selectedVehicleId)
    : null

  return (
    <div className="relative w-full h-full">
      <Map
        defaultCenter={mapCenter}
        defaultZoom={mapZoom}
        mapId="gps-saas-main-map"
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapTypeControl
        mapTypeControlOptions={{
          position: google.maps.ControlPosition.TOP_RIGHT,
          mapTypeIds: ['roadmap', 'satellite', 'hybrid'],
        }}
        onClick={() => setSelectedVehicle(null)}
      >
        {filteredVehicles.map((vehicle) => (
          <VehicleMarker
            key={vehicle.vehicleId}
            vehicle={vehicle}
            isSelected={vehicle.vehicleId === selectedVehicleId}
            onClick={() => setSelectedVehicle(
              vehicle.vehicleId === selectedVehicleId ? null : vehicle.vehicleId
            )}
          />
        ))}

        {selectedVehicle && (
          <InfoWindow
            position={{ lat: selectedVehicle.lat, lng: selectedVehicle.lng }}
            onCloseClick={() => setSelectedVehicle(null)}
          >
            <VehicleInfoWindow vehicle={selectedVehicle} />
          </InfoWindow>
        )}
      </Map>

      {/* Vehicle count overlay */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md px-4 py-2 text-sm">
        <span className="font-medium">{filteredVehicles.length}</span>
        <span className="text-gray-500 ml-1">vehículos</span>
      </div>
    </div>
  )
}

interface VehicleData {
  vehicleId: string
  lat: number
  lng: number
  speed: number
  heading: number
  ignition: boolean
  lastUpdate: string
  economicNum?: string
  plates?: string
}

function VehicleMarker({
  vehicle,
  isSelected,
  onClick,
}: {
  vehicle: VehicleData
  isSelected: boolean
  onClick: () => void
}) {
  const getStatus = () => {
    if (!vehicle.ignition) return 'off'
    if (vehicle.speed > 2)  return 'moving'
    return 'stopped'
  }

  const statusColors = {
    moving:  { bg: '#22C55E', border: '#16A34A', glyph: '#fff' },
    stopped: { bg: '#EAB308', border: '#CA8A04', glyph: '#fff' },
    off:     { bg: '#6B7280', border: '#4B5563', glyph: '#fff' },
  }

  const status = getStatus()
  const colors = statusColors[status]

  // Rotate arrow marker based on heading
  const markerStyle: React.CSSProperties = {
    transform: `rotate(${vehicle.heading}deg)`,
    transformOrigin: 'center',
    transition: 'transform 0.5s ease',
  }

  return (
    <AdvancedMarker
      position={{ lat: vehicle.lat, lng: vehicle.lng }}
      onClick={onClick}
      zIndex={isSelected ? 1000 : undefined}
    >
      <div className={`relative cursor-pointer ${isSelected ? 'scale-125' : 'hover:scale-110'} transition-transform`}>
        {/* Vehicle icon with heading arrow */}
        <div
          className="w-8 h-8 rounded-full border-2 flex items-center justify-center shadow-lg"
          style={{
            backgroundColor: colors.bg,
            borderColor:     colors.border,
          }}
        >
          <div style={markerStyle}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill={colors.glyph}>
              <path d="M8 1 L12 14 L8 11 L4 14 Z" />
            </svg>
          </div>
        </div>

        {/* Economic number label */}
        {vehicle.economicNum && (
          <div
            className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-xs bg-white border border-gray-200 rounded px-1 whitespace-nowrap shadow-sm"
            style={{ fontSize: '10px' }}
          >
            {vehicle.economicNum}
          </div>
        )}

        {/* Speed badge when moving */}
        {vehicle.speed > 2 && (
          <div className="absolute -top-4 -right-1 text-xs bg-green-500 text-white rounded px-1">
            {Math.round(vehicle.speed)}
          </div>
        )}
      </div>
    </AdvancedMarker>
  )
}

function VehicleInfoWindow({ vehicle }: { vehicle: VehicleData }) {
  const secondsAgo = Math.floor(
    (Date.now() - new Date(vehicle.lastUpdate).getTime()) / 1000
  )

  const timeLabel = secondsAgo < 60
    ? `Hace ${secondsAgo}s`
    : secondsAgo < 3600
    ? `Hace ${Math.floor(secondsAgo / 60)}min`
    : `Hace ${Math.floor(secondsAgo / 3600)}h`

  return (
    <div className="min-w-[200px] text-sm">
      <div className="font-semibold text-gray-900 mb-2">
        {vehicle.economicNum ?? 'Vehículo'} — {vehicle.plates ?? ''}
      </div>

      <div className="space-y-1 text-gray-600">
        <div className="flex justify-between">
          <span>Estado</span>
          <span className={`font-medium ${vehicle.ignition ? 'text-green-600' : 'text-gray-400'}`}>
            {vehicle.ignition ? 'Encendido' : 'Apagado'}
          </span>
        </div>

        <div className="flex justify-between">
          <span>Velocidad</span>
          <span className="font-medium">{Math.round(vehicle.speed)} km/h</span>
        </div>

        <div className="flex justify-between">
          <span>Rumbo</span>
          <span className="font-medium">{vehicle.heading}°</span>
        </div>

        <div className="flex justify-between">
          <span>Última actualización</span>
          <span className="text-gray-400">{timeLabel}</span>
        </div>
      </div>

      <div className="mt-3 pt-2 border-t border-gray-100 flex gap-2">
        <button
          className="flex-1 text-xs bg-blue-50 text-blue-600 rounded py-1 hover:bg-blue-100"
          onClick={() => {/* navigate to history */}}
        >
          Ver historial
        </button>
        <button
          className="flex-1 text-xs bg-gray-50 text-gray-600 rounded py-1 hover:bg-gray-100"
          onClick={() => window.open(
            `https://www.google.com/maps?q=${vehicle.lat},${vehicle.lng}`,
            '_blank'
          )}
        >
          Abrir en Maps
        </button>
      </div>
    </div>
  )
}
