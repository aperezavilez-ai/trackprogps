'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import {
  APIProvider,
  Map,
  Marker,
  AdvancedMarker,
} from '@vis.gl/react-google-maps'
import Link from 'next/link'
import { ChevronUp, Clock3, Gauge, Power, X } from 'lucide-react'
import { useMapStore } from '@/lib/stores/app-store'
import { useRealtimeVehicles } from '@/lib/hooks/use-realtime'
import {
  createGoogleVehicleIcon,
  createVehicleMarkerHtml,
  getVehicleColor,
  FLEET_MAP_STYLES,
} from '@/lib/map/vehicle-marker'
import { VehicleMapPanel } from '@/components/map/vehicle-map-panel'
import { GoogleVehicleTrackLayer } from '@/components/map/google-vehicle-track-layer'
import { reverseGeocodeLatLng } from '@/lib/map/reverse-geocode'
import { MobileMapControls } from '@/components/map/mobile-map-controls'
import {
  isInMexico,
  MEXICO_DASHBOARD_VIEW,
} from '@/lib/map/map-viewport'
import { SetMexicoViewOnceGoogle } from '@/components/map/set-mexico-view-once-google'
import type { LiveVehicle } from '@gps-saas/types'
import { GOOGLE_MAPS_MAX_VEHICLES } from '@/lib/constants/limits'

const LeafletRealtimeMap = dynamic(
  () => import('./leaflet-realtime-map').then(m => m.LeafletRealtimeMap),
  { ssr: false, loading: () => (
    <div className="w-full h-full min-h-[380px] flex items-center justify-center bg-gray-100 text-gray-400 text-sm">
      Cargando mapa...
    </div>
  )}
)

interface RealtimeMapProps {
  companyId: string
  initialVehicles: LiveVehicle[]
}

const USE_GOOGLE = process.env['NEXT_PUBLIC_GOOGLE_MAPS_ENABLED'] === 'true'

export function RealtimeMap({ companyId, initialVehicles }: RealtimeMapProps) {
  const apiKey = process.env['NEXT_PUBLIC_GOOGLE_MAPS_API_KEY']
  const mapId = process.env['NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID']
  const [mapError, setMapError] = useState(false)

  useEffect(() => {
    if (!USE_GOOGLE) return
    const prev = (window as Window & { gm_authFailure?: () => void }).gm_authFailure
    ;(window as Window & { gm_authFailure?: () => void }).gm_authFailure = () => setMapError(true)
    return () => {
      ;(window as Window & { gm_authFailure?: () => void }).gm_authFailure = prev
    }
  }, [])

  // OpenStreetMap por defecto — Leaflet cluster escala mejor en flotas grandes
  if (!USE_GOOGLE || !apiKey || mapError || initialVehicles.length > GOOGLE_MAPS_MAX_VEHICLES) {
    return <LeafletRealtimeMap companyId={companyId} initialVehicles={initialVehicles} />
  }

  return (
    <APIProvider apiKey={apiKey}>
      <GoogleMapContent
        companyId={companyId}
        initialVehicles={initialVehicles}
        mapId={mapId}
        onError={() => setMapError(true)}
      />
    </APIProvider>
  )
}

function GoogleMapContent({
  companyId,
  initialVehicles,
  mapId,
  onError,
}: RealtimeMapProps & { mapId?: string; onError: () => void }) {
  const {
    vehicles,
    selectedVehicleId,
    mapCenter,
    mapZoom,
    filter,
    assetFilter,
    groupFilter,
    mapStyle,
    setSelectedVehicle,
    updateVehicle,
    setMapStyle,
  } = useMapStore()

  const [camera, setCamera] = useState({
    center: MEXICO_DASHBOARD_VIEW.center,
    zoom: Number(MEXICO_DASHBOARD_VIEW.zoom),
  })
  const [fleetViewKey, setFleetViewKey] = useState(0)
  const prevSelectedRef = useRef<string | null>(null)
  const [showDetailPanel, setShowDetailPanel] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null)
  const [addressLoading, setAddressLoading] = useState(false)

  useEffect(() => {
    initialVehicles.forEach((v) => {
      updateVehicle(v.vehicle_id, {
        lat:         v.lat,
        lng:         v.lng,
        speed:       v.speed,
        heading:     v.heading,
        ignition:    v.ignition,
        lastUpdate:  v.last_update,
        economicNum: v.economic_num,
        plates:      v.plates,
        deviceId:    v.device_id ?? null,
        vehicleType: v.vehicle_type,
        deviceSource: v.device_source ?? 'hardware',
        mobilePlatform: v.mobile_platform ?? null,
        groupId:     v.group_id ?? null,
        groupName:   v.group_name ?? null,
        ownerName:   v.owner_name ?? null,
        driverName:  v.driver_name ?? null,
      })
    })
  }, [initialVehicles, updateVehicle])

  useRealtimeVehicles(companyId)

  const filteredVehicles = useMemo(() => {
    const all = [...vehicles.values()].filter(v => isInMexico(v.lat, v.lng))
    const byGroup = groupFilter === 'all'
      ? all
      : all.filter(v => v.groupId === groupFilter)
    const byAsset = assetFilter === 'all'
      ? byGroup
      : assetFilter === 'mobile'
        ? byGroup.filter(v => v.deviceSource === 'mobile')
        : assetFilter === 'vehicles'
          ? byGroup.filter(v => v.deviceSource !== 'mobile' && v.vehicleType !== 'other')
          : byGroup.filter(v => v.deviceSource === 'mobile' || v.vehicleType === 'other')
    switch (filter) {
      case 'online':  return byAsset.filter(v => v.ignition)
      case 'offline': return byAsset.filter(v => !v.ignition)
      case 'moving':  return byAsset.filter(v => v.speed > 2)
      case 'stopped': return byAsset.filter(v => v.speed <= 2 && v.ignition)
      default:        return byAsset
    }
  }, [vehicles, filter, assetFilter, groupFilter])

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

  const handleSelectVehicle = useCallback((vehicleId: string | null) => {
    setSelectedVehicle(vehicleId)
  }, [setSelectedVehicle])

  const handleMarkerClick = useCallback((
    vehicleId: string,
    alreadySelected: boolean,
    ev?: { stop?: () => void },
  ) => {
    ev?.stop?.()
    handleSelectVehicle(alreadySelected ? null : vehicleId)
  }, [handleSelectVehicle])

  // Solo acercar al seleccionar — no resetear vista al deseleccionar
  useEffect(() => {
    if (!selectedVehicle) return
    setCamera({
      center: { lat: selectedVehicle.lat, lng: selectedVehicle.lng },
      zoom: Math.max(mapZoom, 14),
    })
  }, [selectedVehicleId, selectedVehicle?.lat, selectedVehicle?.lng, mapZoom, selectedVehicle])

  // Al quitar selección, volver a la vista México del dashboard
  useEffect(() => {
    if (prevSelectedRef.current && !selectedVehicleId) {
      setFleetViewKey((k) => k + 1)
    }
    prevSelectedRef.current = selectedVehicleId
  }, [selectedVehicleId])

  useEffect(() => {
    const isMexicoDefault =
      Math.abs(mapCenter.lat - MEXICO_DASHBOARD_VIEW.center.lat) < 0.01 &&
      Math.abs(mapCenter.lng - MEXICO_DASHBOARD_VIEW.center.lng) < 0.01
    if (!isMexicoDefault) {
      setCamera({ center: mapCenter, zoom: mapZoom })
    }
  }, [mapCenter, mapZoom])

  const getMarkerColor = useCallback((vehicle: VehicleData) => {
    return getVehicleColor(vehicle.speed, vehicle.ignition)
  }, [])

  const centerSelectedVehicle = useCallback(() => {
    if (!selectedVehicle) return
    setCamera({
      center: { lat: selectedVehicle.lat, lng: selectedVehicle.lng },
      zoom: Math.max(camera.zoom, 15),
    })
  }, [selectedVehicle, camera.zoom])

  const centerFleet = useCallback(() => {
    setFleetViewKey((k) => k + 1)
  }, [])

  return (
    <div className="relative w-full h-full min-h-0 lg:min-h-[380px]">
      <Map
        center={camera.center}
        zoom={camera.zoom}
        mapTypeId={mapStyle === 'streets' ? 'roadmap' : mapStyle}
        {...(mapId ? { mapId } : {})}
        gestureHandling="greedy"
        disableDefaultUI={false}
        mapTypeControl
        mapTypeControlOptions={{ mapTypeIds: ['hybrid', 'satellite', 'roadmap'] }}
        styles={FLEET_MAP_STYLES}
        onCameraChanged={(ev) => {
          const { center, zoom } = ev.detail
          setCamera({ center, zoom })
        }}
        onBoundsChanged={() => {
          const err = document.querySelector('.gm-err-container, .dismissButton')
          if (err) onError()
        }}
      >
        <SetMexicoViewOnceGoogle applyKey={fleetViewKey} />
        <GoogleVehicleTrackLayer vehicleId={selectedVehicleId} />

        {filteredVehicles.map((vehicle) => {
          const selected = vehicle.vehicleId === selectedVehicleId
          const color = getMarkerColor(vehicle)
          const iconOpts = {
            color,
            heading: vehicle.heading,
            selected,
            vehicleType: vehicle.vehicleType,
            ignition: vehicle.ignition,
          }

          if (mapId) {
            return (
              <AdvancedMarker
                key={vehicle.vehicleId}
                position={{ lat: vehicle.lat, lng: vehicle.lng }}
                zIndex={selected ? 1000 : 1}
                onClick={(ev) => handleMarkerClick(vehicle.vehicleId, selected, ev)}
              >
                <div
                  className="vehicle-marker-icon cursor-pointer"
                  dangerouslySetInnerHTML={{ __html: createVehicleMarkerHtml(iconOpts) }}
                />
              </AdvancedMarker>
            )
          }

          return (
            <Marker
              key={vehicle.vehicleId}
              position={{ lat: vehicle.lat, lng: vehicle.lng }}
              title={vehicle.economicNum ?? vehicle.vehicleId}
              onClick={(ev) => handleMarkerClick(vehicle.vehicleId, selected, ev)}
              icon={createGoogleVehicleIcon(iconOpts)}
            />
          )
        })}

      </Map>

      <MobileMapControls
        mapStyle={mapStyle}
        onChangeStyle={setMapStyle}
        onCenterSelected={selectedVehicle ? centerSelectedVehicle : undefined}
        onCenterFleet={centerFleet}
        onZoomIn={() => setCamera((prev) => ({ ...prev, zoom: Math.min(20, prev.zoom + 1) }))}
        onZoomOut={() => setCamera((prev) => ({ ...prev, zoom: Math.max(4, prev.zoom - 1) }))}
      />

      {selectedVehicle && showDetailPanel && (
        <div className="fixed inset-x-0 bottom-16 lg:absolute lg:inset-x-auto lg:bottom-4 lg:right-4 z-[1000] pointer-events-auto px-3 lg:px-0 flex justify-center lg:justify-end">
          <VehicleMapPanel
            vehicle={{
              vehicleId:   selectedVehicle.vehicleId,
              lat:         selectedVehicle.lat,
              lng:         selectedVehicle.lng,
              speed:       selectedVehicle.speed,
              heading:     selectedVehicle.heading,
              ignition:    selectedVehicle.ignition,
              lastUpdate:  selectedVehicle.lastUpdate,
              economicNum: selectedVehicle.economicNum ?? '',
              plates:      selectedVehicle.plates ?? '',
              driverName:  selectedVehicle.driverName,
              ownerName:   selectedVehicle.ownerName,
              groupName:   selectedVehicle.groupName,
              deviceId:    selectedVehicle.deviceId,
            }}
            onClose={() => handleSelectVehicle(null)}
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
                onClick={() => handleSelectVehicle(null)}
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

      <div className="absolute top-14 lg:top-4 left-4 bg-white/90 backdrop-blur rounded-lg shadow-md px-3 py-1.5 text-xs sm:text-sm z-10 hidden sm:block">
        <span className="font-medium">{filteredVehicles.length}</span>
        <span className="text-gray-500 ml-1">vehículos</span>
      </div>

      {selectedVehicle && (
        <div className="absolute left-2 right-2 bottom-2 lg:left-4 lg:right-auto lg:bottom-4 z-20 pointer-events-none">
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

interface VehicleData {
  vehicleId: string
  deviceId?: string | null
  lat: number
  lng: number
  speed: number
  heading: number
  ignition: boolean
  lastUpdate: string
  economicNum?: string
  plates?: string
  vehicleType?: string
  groupId?: string | null
  groupName?: string | null
  ownerName?: string | null
  driverName?: string | null
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
