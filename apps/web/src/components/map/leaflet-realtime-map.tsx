'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, useMap } from 'react-leaflet'
import type { Map as LeafletMap } from 'leaflet'
import Link from 'next/link'
import { useMapStore } from '@/lib/stores/app-store'
import { useRealtimeVehicles } from '@/lib/hooks/use-realtime'
import { ProTrackTiles } from '@/components/map/protrack-tiles'
import { VehicleMarkerCluster } from '@/components/map/vehicle-marker-cluster'
import { SetMexicoViewOnce } from '@/components/map/set-mexico-view-once'
import { VehicleTrackLayer } from '@/components/map/vehicle-track-layer'
import { VehicleMapPanel } from '@/components/map/vehicle-map-panel'
import { ChevronUp, Clock3, Gauge, Power, X } from 'lucide-react'
import { reverseGeocodeLatLng } from '@/lib/map/reverse-geocode'
import { MobileMapControls } from '@/components/map/mobile-map-controls'
import type { LiveVehicle } from '@gps-saas/types'
import {
  isInMexico,
  MEXICO_GEO_CENTER,
  MEXICO_DEFAULT_ZOOM,
} from '@/lib/map/map-viewport'

import 'leaflet/dist/leaflet.css'

interface LeafletRealtimeMapProps {
  companyId: string
  initialVehicles: LiveVehicle[]
}

export function LeafletRealtimeMap({ companyId, initialVehicles }: LeafletRealtimeMapProps) {
  const {
    vehicles,
    selectedVehicleId,
    filter,
    groupFilter,
    mapStyle,
    setSelectedVehicle,
    setMapStyle,
    updateVehicle,
  } = useMapStore()

  const initializedRef = useRef(false)
  const mapRef = useRef<LeafletMap | null>(null)
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
  const [addressLoading, setAddressLoading] = useState(false)

  useEffect(() => {
    if (initializedRef.current) return
    initialVehicles.forEach((v) => {
      updateVehicle(v.vehicle_id, {
        lat:         v.lat,
        lng:         v.lng,
        speed:       v.speed,
        heading:     v.heading,
        ignition:    v.ignition,
        lastUpdate:  v.last_update,
        deviceId:    v.device_id ?? null,
        economicNum: v.economic_num,
        plates:      v.plates,
        vehicleType: v.vehicle_type,
        groupId:     v.group_id ?? null,
        groupName:   v.group_name ?? null,
        ownerName:   v.owner_name ?? null,
        driverName:  v.driver_name ?? null,
      })
    })
    initializedRef.current = true
  }, [initialVehicles, updateVehicle])

  useRealtimeVehicles(companyId)

  const filteredVehicles = useMemo(() => {
    const all = [...vehicles.values()].filter(v => v.lat && v.lng && isInMexico(v.lat, v.lng))
    const byGroup = groupFilter === 'all'
      ? all
      : all.filter(v => v.groupId === groupFilter)
    switch (filter) {
      case 'online':  return byGroup.filter(v => v.ignition)
      case 'offline': return byGroup.filter(v => !v.ignition)
      case 'moving':  return byGroup.filter(v => v.speed > 2)
      case 'stopped': return byGroup.filter(v => v.speed <= 2 && v.ignition)
      default:        return byGroup
    }
  }, [vehicles, filter, groupFilter])

  const selectedVehicle = selectedVehicleId ? vehicles.get(selectedVehicleId) : null

  useEffect(() => {
    setShowDetailPanel(false)
  }, [selectedVehicleId])

  useEffect(() => {
    if (!selectedVehicle) {
      setSelectedAddress(null)
      setAddressLoading(false)
      return
    }
    let cancelled = false
    setAddressLoading(true)
    reverseGeocodeLatLng(selectedVehicle.lat, selectedVehicle.lng)
      .then((address) => {
        if (!cancelled) setSelectedAddress(address)
      })
      .finally(() => {
        if (!cancelled) setAddressLoading(false)
      })
    return () => { cancelled = true }
  }, [selectedVehicle?.vehicleId, selectedVehicle?.lat, selectedVehicle?.lng, selectedVehicle])

  return (
    <div className="relative w-full h-full min-h-[calc(100dvh-12rem)] sm:min-h-[380px] z-0">
      <MapContainer
        center={[MEXICO_GEO_CENTER.lat, MEXICO_GEO_CENTER.lng]}
        zoom={MEXICO_DEFAULT_ZOOM}
        className="w-full h-full min-h-[380px] rounded-xl"
        scrollWheelZoom
      >
        <ProTrackTiles style={mapStyle} />
        <SetMexicoViewOnce />
        <BindLeafletMap onMap={(map) => { mapRef.current = map }} />
        <VehicleTrackLayer vehicleId={selectedVehicleId} />
        <VehicleMarkerCluster
          vehicles={filteredVehicles}
          selectedVehicleId={selectedVehicleId}
          onSelect={setSelectedVehicle}
        />
      </MapContainer>

      <div className="absolute top-14 lg:top-4 left-4 bg-black/60 backdrop-blur text-white rounded-lg shadow-lg px-3 py-1.5 text-xs sm:text-sm z-[1000] pointer-events-none hidden sm:block">
        <span className="font-semibold">{filteredVehicles.length}</span>
        <span className="text-white/70 ml-1">vehículos</span>
      </div>

      {selectedVehicle && showDetailPanel && (
        <div className="fixed inset-x-0 bottom-16 lg:absolute lg:inset-x-auto lg:bottom-4 lg:right-4 z-[1000] px-3 lg:px-0 flex justify-center lg:justify-end">
          <VehicleMapPanel
            vehicle={{
              vehicleId:   selectedVehicle.vehicleId,
              lat:         selectedVehicle.lat,
              lng:         selectedVehicle.lng,
              speed:       selectedVehicle.speed,
              heading:     selectedVehicle.heading,
              ignition:    selectedVehicle.ignition,
              lastUpdate:  selectedVehicle.lastUpdate,
              economicNum: selectedVehicle.economicNum,
              plates:      selectedVehicle.plates,
              driverName:  selectedVehicle.driverName,
              ownerName:   selectedVehicle.ownerName,
              groupName:   selectedVehicle.groupName,
              deviceId:    selectedVehicle.deviceId,
            }}
            onClose={() => setSelectedVehicle(null)}
          />
        </div>
      )}

      {selectedVehicle && !showDetailPanel && (
        <div className="fixed inset-x-0 bottom-16 lg:absolute lg:inset-x-auto lg:bottom-4 lg:right-4 z-[1000] px-3 lg:px-0 flex justify-center lg:justify-end pointer-events-auto">
          <div className="w-full sm:w-[320px] rounded-2xl border border-white/25 bg-slate-900/90 backdrop-blur-xl shadow-2xl text-white overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-white/10">
              <div className="min-w-0">
                <p className="text-xs text-orange-300 uppercase tracking-wide">Unidad seleccionada</p>
                <p className="font-semibold truncate">{selectedVehicle.economicNum ?? selectedVehicle.vehicleId}</p>
                <p className="text-xs text-white/70 truncate">{selectedVehicle.plates ?? 'Sin placas'}</p>
              </div>
              <button
                type="button"
                className="p-1.5 rounded-md hover:bg-white/10 text-white/70"
                aria-label="Cerrar selección"
                onClick={() => setSelectedVehicle(null)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-4 py-3 text-xs grid grid-cols-2 gap-2">
              <span className="flex items-center gap-1.5 text-white/80"><Gauge className="w-3.5 h-3.5" /> {Math.round(selectedVehicle.speed)} km/h</span>
              <span className={`flex items-center gap-1.5 ${selectedVehicle.ignition ? 'text-green-400' : 'text-white/70'}`}>
                <Power className="w-3.5 h-3.5" /> {selectedVehicle.ignition ? 'Motor ON' : 'Motor OFF'}
              </span>
            </div>
            <div className="px-4 pb-2 text-[11px] text-white/65 truncate">
              {addressLoading ? 'Buscando dirección...' : (selectedAddress ?? `${selectedVehicle.lat.toFixed(5)}, ${selectedVehicle.lng.toFixed(5)}`)}
            </div>
            <div className="px-4 pb-3 flex items-center justify-between gap-2">
              <Link
                href={`/history?vehicle_id=${selectedVehicle.vehicleId}&lat=${selectedVehicle.lat}&lng=${selectedVehicle.lng}`}
                className="text-xs text-orange-300 hover:text-orange-200"
              >
                Ver historial
              </Link>
              <button
                type="button"
                onClick={() => setShowDetailPanel(true)}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-500 text-white font-medium"
              >
                <ChevronUp className="w-3.5 h-3.5" />
                Ver detalle
              </button>
            </div>
          </div>
        </div>
      )}

      <MobileMapControls
        mapStyle={mapStyle}
        onChangeStyle={setMapStyle}
        onCenterSelected={selectedVehicle ? () => {
          if (!mapRef.current || !selectedVehicle) return
          mapRef.current.setView([selectedVehicle.lat, selectedVehicle.lng], Math.max(mapRef.current.getZoom(), 15))
        } : undefined}
        onCenterFleet={() => {
          if (!mapRef.current) return
          if (filteredVehicles.length === 0) {
            mapRef.current.setView([MEXICO_GEO_CENTER.lat, MEXICO_GEO_CENTER.lng], MEXICO_DEFAULT_ZOOM)
            return
          }
          const avg = filteredVehicles.reduce(
            (acc, v) => ({ lat: acc.lat + v.lat, lng: acc.lng + v.lng }),
            { lat: 0, lng: 0 },
          )
          mapRef.current.setView([avg.lat / filteredVehicles.length, avg.lng / filteredVehicles.length], 7)
        }}
        onZoomIn={() => mapRef.current?.zoomIn()}
        onZoomOut={() => mapRef.current?.zoomOut()}
      />

      {selectedVehicle && (
        <div className="absolute left-2 right-2 bottom-2 lg:left-4 lg:right-auto lg:bottom-4 z-[1000] pointer-events-none">
          <div className="inline-flex max-w-full items-center gap-3 bg-slate-900/85 text-white rounded-xl px-3 py-2 text-xs shadow-lg backdrop-blur">
            <span className="font-semibold truncate">{selectedVehicle.economicNum ?? selectedVehicle.vehicleId}</span>
            <span className="flex items-center gap-1 text-white/80"><Gauge className="w-3 h-3" />{Math.round(selectedVehicle.speed)} km/h</span>
            <span className={`flex items-center gap-1 ${selectedVehicle.ignition ? 'text-green-400' : 'text-white/70'}`}>
              <Power className="w-3 h-3" />{selectedVehicle.ignition ? 'ON' : 'OFF'}
            </span>
            <span className="hidden sm:flex items-center gap-1 text-white/70">
              <Clock3 className="w-3 h-3" />
              {formatTimeAgo(selectedVehicle.lastUpdate)}
            </span>
            <span className="hidden lg:block text-white/65 max-w-[300px] truncate">
              {addressLoading ? 'Buscando dirección...' : (selectedAddress ?? '')}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}

function formatTimeAgo(iso: string) {
  const diff = Math.max(0, Date.now() - new Date(iso).getTime())
  const sec = Math.floor(diff / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} h`
  return new Date(iso).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })
}

function BindLeafletMap({ onMap }: { onMap: (map: LeafletMap) => void }) {
  const map = useMap()
  useEffect(() => {
    onMap(map)
  }, [map, onMap])
  return null
}
