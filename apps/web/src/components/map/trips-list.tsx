'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { History, Clock, MapPin, Gauge, Calendar } from 'lucide-react'

interface TripSummary {
  id: string
  started_at: string
  ended_at: string | null
  distance_km: number
  duration_min: number
  avg_speed: number | null
  max_speed: number | null
  is_complete: boolean
}

interface TripsListProps {
  vehicleId: string
  trips: TripSummary[]
  onSelectTrip: (trip: TripSummary) => void
  selectedTripId: string | null
}

export function TripsList({ vehicleId, trips, onSelectTrip, selectedTripId }: TripsListProps) {
  if (trips.length === 0) {
    return (
      <div className="text-center py-8 text-gray-400">
        <History className="w-8 h-8 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No hay viajes registrados</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {trips.map(trip => {
        const isSelected = trip.id === selectedTripId
        const startDate  = new Date(trip.started_at)
        const endDate    = trip.ended_at ? new Date(trip.ended_at) : null

        return (
          <button
            key={trip.id}
            onClick={() => onSelectTrip(trip)}
            className={`w-full text-left p-3 rounded-xl border transition ${
              isSelected
                ? 'border-blue-400 bg-blue-50 ring-1 ring-blue-200'
                : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Calendar className="w-3.5 h-3.5" />
                {startDate.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
              </div>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                trip.is_complete
                  ? 'bg-green-50 text-green-700'
                  : 'bg-yellow-50 text-yellow-700'
              }`}>
                {trip.is_complete ? 'Completo' : 'En curso'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
              <Clock className="w-3 h-3" />
              {startDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}
              {endDate && ` → ${endDate.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`}
            </div>

            <div className="flex gap-3 mt-2 text-xs">
              <span className="flex items-center gap-1 text-gray-600 font-medium">
                <MapPin className="w-3 h-3 text-blue-500" />
                {trip.distance_km.toFixed(1)} km
              </span>
              <span className="flex items-center gap-1 text-gray-500">
                <Clock className="w-3 h-3" />
                {trip.duration_min} min
              </span>
              {trip.max_speed && (
                <span className="flex items-center gap-1 text-gray-500">
                  <Gauge className="w-3 h-3" />
                  máx {Math.round(trip.max_speed)} km/h
                </span>
              )}
            </div>
          </button>
        )
      })}
    </div>
  )
}
