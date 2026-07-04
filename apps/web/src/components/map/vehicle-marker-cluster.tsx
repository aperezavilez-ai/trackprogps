'use client'

import { useEffect, useRef } from 'react'
import { useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet.markercluster'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { createVehicleIcon, getVehicleColor, createClusterIcon } from '@/lib/map/vehicle-marker'

type ClusterVehicle = {
  vehicleId: string
  deviceId?: string | null
  lat: number
  lng: number
  speed: number
  heading: number
  ignition: boolean
  economicNum: string
  plates: string
  vehicleType?: string
  deviceSource?: string | null
}

interface VehicleMarkerClusterProps {
  vehicles: ClusterVehicle[]
  selectedVehicleId: string | null
  onSelect: (id: string | null) => void
}

export function VehicleMarkerCluster({ vehicles, selectedVehicleId, onSelect }: VehicleMarkerClusterProps) {
  const map = useMap()
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null)
  const markersRef = useRef(new Map<string, L.Marker>())

  useEffect(() => {
    const cluster = L.markerClusterGroup({
      maxClusterRadius: 60,
      disableClusteringAtZoom: 15,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      iconCreateFunction: (c) => createClusterIcon(c.getChildCount()),
    })
    map.addLayer(cluster)
    clusterRef.current = cluster
    const markers = markersRef.current

    return () => {
      map.removeLayer(cluster)
      clusterRef.current = null
      markers.clear()
    }
  }, [map])

  useEffect(() => {
    const cluster = clusterRef.current
    if (!cluster) return

    const current = markersRef.current
    const nextIds = new Set(vehicles.map((v) => v.vehicleId))

    for (const [id, marker] of current) {
      if (!nextIds.has(id)) {
        cluster.removeLayer(marker)
        current.delete(id)
      }
    }

    for (const vehicle of vehicles) {
      const selected = vehicle.vehicleId === selectedVehicleId
      const color = getVehicleColor(vehicle.speed, vehicle.ignition)
      const icon = createVehicleIcon({
        color,
        heading: vehicle.heading ?? 0,
        selected,
        label: vehicle.economicNum,
        vehicleType: vehicle.vehicleType,
        deviceSource: vehicle.deviceSource,
        ignition: vehicle.ignition,
      })

      const existing = current.get(vehicle.vehicleId)
      if (existing) {
        existing.setLatLng([vehicle.lat, vehicle.lng])
        existing.setIcon(icon)
      } else {
        const marker = L.marker([vehicle.lat, vehicle.lng], { icon })
        marker.on('click', (e) => {
          L.DomEvent.stopPropagation(e)
          onSelect(selected ? null : vehicle.vehicleId)
        })
        cluster.addLayer(marker)
        current.set(vehicle.vehicleId, marker)
      }
    }
  }, [vehicles, selectedVehicleId, onSelect])

  return null
}
