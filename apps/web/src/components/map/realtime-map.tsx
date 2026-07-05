'use client'

import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import dynamic from 'next/dynamic'
import {
  APIProvider,
  Map,
  Marker,
  AdvancedMarker,
  AdvancedMarkerAnchorPoint,
  useMap,
} from '@vis.gl/react-google-maps'
import Link from 'next/link'
import { ChevronUp, Clock3, Gauge, Layers, Power, Smartphone, TrafficCone, X } from 'lucide-react'
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
import { MAP_STYLE_LABELS, type MapStyle } from '@/lib/map/tiles'
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
const STREET_VIEW_RIGHT_BOTTOM_POSITION = 9 as google.maps.ControlPosition
const GOOGLE_MAX_DETAIL_ZOOM = 22

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
  const [trafficEnabled, setTrafficEnabled] = useState(false)

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
        batteryPct:   v.battery_pct ?? null,
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

  const fleetPositions = useMemo(
    () => filteredVehicles.map((vehicle) => ({ lat: vehicle.lat, lng: vehicle.lng })),
    [filteredVehicles],
  )

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
    <div className="trackpro-google-map flex h-full min-h-0 w-full flex-col lg:min-h-[380px]">
      <div className="relative min-h-0 flex-1">
      <Map
        center={camera.center}
        zoom={camera.zoom}
        mapTypeId={mapStyle === 'streets' ? 'roadmap' : mapStyle}
        {...(mapId ? { mapId } : {})}
        maxZoom={GOOGLE_MAX_DETAIL_ZOOM}
        minZoom={3}
        isFractionalZoomEnabled={false}
        gestureHandling="greedy"
        disableDefaultUI
        mapTypeControl={false}
        zoomControl={false}
        fullscreenControl={false}
        streetViewControl
        streetViewControlOptions={{ position: STREET_VIEW_RIGHT_BOTTOM_POSITION }}
        rotateControl={false}
        scaleControl={false}
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
        <GoogleMapHealthCheck onError={onError} />
        <GoogleStreetViewControlPosition />
        <GoogleTrafficLayer enabled={trafficEnabled} />
        <SetMexicoViewOnceGoogle applyKey={fleetViewKey} positions={fleetPositions} />
        <GoogleVehicleTrackLayer vehicleId={selectedVehicleId} />

        {filteredVehicles.map((vehicle) => {
          const selected = vehicle.vehicleId === selectedVehicleId
          const color = getMarkerColor(vehicle)
          const iconOpts = {
            color,
            heading: vehicle.heading,
            selected,
            vehicleType: vehicle.vehicleType,
            deviceSource: vehicle.deviceSource,
            ignition: vehicle.ignition,
          }

          if (mapId) {
            return (
              <AdvancedMarker
                key={vehicle.vehicleId}
                position={{ lat: vehicle.lat, lng: vehicle.lng }}
                anchorPoint={AdvancedMarkerAnchorPoint.CENTER}
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

      <MapQualityControls
        mapStyle={mapStyle}
        onChangeStyle={setMapStyle}
        trafficEnabled={trafficEnabled}
        onToggleTraffic={() => setTrafficEnabled(v => !v)}
      />

      {selectedVehicle && showDetailPanel && (
        <div className="fixed inset-x-0 bottom-[calc(7.75rem+env(safe-area-inset-bottom,0px))] lg:absolute lg:inset-x-auto lg:bottom-4 lg:right-4 z-[1000] pointer-events-auto px-3 lg:px-0 flex justify-center lg:justify-end">
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
              deviceSource: selectedVehicle.deviceSource,
              mobilePlatform: selectedVehicle.mobilePlatform,
              batteryPct: selectedVehicle.batteryPct,
            }}
            onClose={() => handleSelectVehicle(null)}
          />
        </div>
      )}

      {selectedVehicle && !showDetailPanel && (
        <div className="fixed inset-x-0 bottom-[calc(7.75rem+env(safe-area-inset-bottom,0px))] lg:absolute lg:inset-x-auto lg:bottom-4 lg:right-4 z-[1000] px-3 lg:px-0 flex justify-center lg:justify-end pointer-events-auto">
          <div className="w-full sm:w-[320px] rounded-2xl border border-white/25 bg-slate-900/90 backdrop-blur-xl shadow-2xl text-white overflow-hidden">
            <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2 border-b border-white/10">
              <div className="min-w-0">
                <p className="text-xs text-orange-300 uppercase tracking-wide">{getAssetCardLabel(selectedVehicle)}</p>
                <p className="font-semibold truncate">{getAssetTitle(selectedVehicle)}</p>
                <p className="text-xs text-white/70 truncate">{getAssetSubLabel(selectedVehicle)}</p>
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
              <span className={`flex items-center gap-1.5 ${selectedVehicle.deviceSource === 'mobile' ? selectedVehicle.speed > 2 ? 'text-green-400' : 'text-orange-300' : selectedVehicle.ignition ? 'text-green-400' : 'text-white/70'}`}>
                {selectedVehicle.deviceSource === 'mobile' ? <Smartphone className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                {selectedVehicle.deviceSource === 'mobile'
                  ? (selectedVehicle.speed > 2 ? 'En movimiento' : 'Estatico')
                  : (selectedVehicle.ignition ? 'Motor ON' : 'Motor OFF')}
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
                {selectedVehicle.deviceSource === 'mobile' ? 'Historial ubicacion' : 'Ver historial'}
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

      {selectedVehicle && (
        <div className="absolute left-2 right-2 bottom-2 lg:left-4 lg:right-auto lg:bottom-4 z-20 pointer-events-none">
          <div className="inline-flex max-w-full items-center gap-3 bg-slate-900/85 text-white rounded-xl px-3 py-2 text-xs shadow-lg backdrop-blur">
            <span className="font-semibold truncate">{getAssetTitle(selectedVehicle)}</span>
            <span className="flex items-center gap-1 text-white/80"><Gauge className="w-3 h-3" />{Math.round(selectedVehicle.speed)} km/h</span>
            <span className={`flex items-center gap-1 ${selectedVehicle.deviceSource === 'mobile' ? selectedVehicle.speed > 2 ? 'text-green-400' : 'text-orange-300' : selectedVehicle.ignition ? 'text-green-400' : 'text-white/70'}`}>
              {selectedVehicle.deviceSource === 'mobile' ? <Smartphone className="w-3 h-3" /> : <Power className="w-3 h-3" />}
              {selectedVehicle.deviceSource === 'mobile'
                ? (selectedVehicle.speed > 2 ? 'MOV' : 'ESTATICO')
                : (selectedVehicle.ignition ? 'ON' : 'OFF')}
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

      <MobileMapControls
        mapStyle={mapStyle}
        onChangeStyle={setMapStyle}
        trafficEnabled={trafficEnabled}
        onToggleTraffic={() => setTrafficEnabled(v => !v)}
        onCenterSelected={selectedVehicle ? centerSelectedVehicle : undefined}
        onCenterFleet={centerFleet}
        onZoomIn={() => setCamera((prev) => ({ ...prev, zoom: Math.min(GOOGLE_MAX_DETAIL_ZOOM, Math.floor(prev.zoom) + 1) }))}
        onZoomOut={() => setCamera((prev) => ({ ...prev, zoom: Math.max(4, prev.zoom - 1) }))}
      />
    </div>
  )
}

function GoogleMapHealthCheck({ onError }: { onError: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const mapRoot = document.querySelector('.gm-style')
      if (!mapRoot) {
        onError()
        return
      }

      const hasError = Boolean(mapRoot.querySelector('.gm-err-container, .gm-err-message, .dismissButton'))
      const hasTiles = Array.from(mapRoot.querySelectorAll('img')).some((img) => {
        const source = img.getAttribute('src') ?? ''
        return img.complete && img.naturalWidth > 16 && (
          source.includes('google') ||
          source.includes('gstatic') ||
          source.includes('googleapis')
        )
      })
      const hasVectorCanvas = mapRoot.querySelectorAll('canvas').length > 0

      if (hasError || (!hasTiles && !hasVectorCanvas)) onError()
    }, 4500)

    return () => window.clearTimeout(timer)
  }, [onError])

  return null
}

function MapQualityControls({
  mapStyle,
  onChangeStyle,
  trafficEnabled,
  onToggleTraffic,
}: {
  mapStyle: MapStyle
  onChangeStyle: (style: MapStyle) => void
  trafficEnabled?: boolean
  onToggleTraffic?: () => void
}) {
  const styles: MapStyle[] = ['hybrid', 'satellite', 'streets', 'terrain']

  return (
    <div className="absolute right-3 top-3 z-[1000] hidden max-w-[calc(100%-1.5rem)] items-center gap-1.5 rounded-xl border border-gray-200 bg-white/95 p-1.5 shadow-lg backdrop-blur md:flex">
      <div className="flex h-8 w-8 items-center justify-center text-gray-500" title="Capas">
        <Layers className="h-4 w-4" />
      </div>
      <div className="flex overflow-hidden rounded-lg border border-gray-200">
        {styles.map((style) => (
          <button
            key={style}
            type="button"
            onClick={() => onChangeStyle(style)}
            className={`px-3 py-1.5 text-xs font-medium transition ${
              mapStyle === style
                ? 'bg-orange-500 text-white'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {MAP_STYLE_LABELS[style]}
          </button>
        ))}
      </div>
      {onToggleTraffic && (
        <button
          type="button"
          onClick={onToggleTraffic}
          title="Tráfico"
          className={`flex h-8 w-8 items-center justify-center rounded-lg border transition ${
            trafficEnabled
              ? 'border-orange-500 bg-orange-500 text-white'
              : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
          }`}
        >
          <TrafficCone className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

function GoogleStreetViewControlPosition() {
  useEffect(() => {
    let cancelled = false
    let attempts = 0

    const placePegman = () => {
      if (cancelled) return
      const pegman = document.querySelector<HTMLElement>('.trackpro-google-map .gm-svpc')
      const control = pegman?.parentElement
      if (control) {
        control.classList.add('trackpro-street-view-control')
        control.style.position = 'absolute'
        control.style.top = 'auto'
        control.style.left = 'auto'
        control.style.right = '44px'
        control.style.bottom = '86px'
        control.style.margin = '0'
        control.style.transform = 'none'
        control.style.zIndex = '50'
        control.style.overflow = 'visible'
        pegman.style.overflow = 'visible'
        return
      }

      attempts += 1
      if (attempts < 20) window.setTimeout(placePegman, 250)
    }

    placePegman()
    return () => { cancelled = true }
  }, [])

  return null
}

function GoogleTrafficLayer({ enabled }: { enabled: boolean }) {
  const map = useMap()

  useEffect(() => {
    if (!map || !enabled) return
    const TrafficLayer = globalThis.google?.maps?.TrafficLayer
    if (!TrafficLayer) return
    const layer = new TrafficLayer()
    layer.setMap(map)
    return () => layer.setMap(null)
  }, [enabled, map])

  return null
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
  deviceSource?: string | null
  mobilePlatform?: string | null
  batteryPct?: number | null
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

function getAssetCardLabel(vehicle: VehicleData) {
  return vehicle.deviceSource === 'mobile' ? 'Movil seleccionado' : 'Unidad seleccionada'
}

function getAssetTitle(vehicle: VehicleData) {
  if (vehicle.deviceSource === 'mobile') return vehicle.ownerName || vehicle.economicNum || 'Movil TrackProGPS'
  return vehicle.economicNum ?? vehicle.vehicleId
}

function getAssetSubLabel(vehicle: VehicleData) {
  if (vehicle.deviceSource !== 'mobile') return vehicle.plates ?? 'Sin placas'
  if (vehicle.mobilePlatform === 'ios') return 'iPhone / iOS'
  if (vehicle.mobilePlatform === 'android') return 'Android'
  return 'Movil TrackProGPS'
}
