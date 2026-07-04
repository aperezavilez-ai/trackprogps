'use client'

import { RoutePlayback } from './route-playback'

interface RouteHistoryMapProps {
  vehicleId: string
  vehicleName: string
  deviceSource?: 'mobile' | 'hardware'
  apiKey: string
  initialCenter?: { lat: number; lng: number }
}

export function RouteHistoryMap({ vehicleId, vehicleName, deviceSource = 'hardware', apiKey, initialCenter }: RouteHistoryMapProps) {
  return (
    <RoutePlayback
      vehicleId={vehicleId}
      vehicleName={vehicleName}
      deviceSource={deviceSource}
      apiKey={apiKey}
      initialCenter={initialCenter}
    />
  )
}
