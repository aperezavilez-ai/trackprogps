'use client'

import { RoutePlayback } from './route-playback'

interface RouteHistoryMapProps {
  vehicleId: string
  vehicleName: string
  apiKey: string
  initialCenter?: { lat: number; lng: number }
}

export function RouteHistoryMap({ vehicleId, vehicleName, apiKey, initialCenter }: RouteHistoryMapProps) {
  return (
    <RoutePlayback
      vehicleId={vehicleId}
      vehicleName={vehicleName}
      apiKey={apiKey}
      initialCenter={initialCenter}
    />
  )
}
