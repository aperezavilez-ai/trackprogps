'use client'

import {
  Truck, Zap, PauseCircle, WifiOff, AlertTriangle,
  TrendingUp, Navigation
} from 'lucide-react'
import type { DashboardStats as Stats } from '@gps-saas/types'

interface DashboardStatsProps {
  stats: Stats
}

export function DashboardStats({ stats }: DashboardStatsProps) {
  const cards = [
    {
      label:   'Total',
      value:   stats.total_vehicles,
      icon:    Truck,
      color:   'text-orange-500',
      bg:      'bg-orange-50',
      border:  'border-orange-100',
    },
    {
      label:   'En movimiento',
      value:   stats.vehicles_online - stats.vehicles_stopped,
      icon:    Navigation,
      color:   'text-green-600',
      bg:      'bg-green-50',
      border:  'border-green-100',
    },
    {
      label:   'Detenidos',
      value:   stats.vehicles_stopped,
      icon:    PauseCircle,
      color:   'text-yellow-600',
      bg:      'bg-yellow-50',
      border:  'border-yellow-100',
    },
    {
      label:   'Sin señal',
      value:   stats.vehicles_no_signal,
      icon:    WifiOff,
      color:   'text-gray-500',
      bg:      'bg-gray-50',
      border:  'border-gray-200',
    },
    {
      label:   'Alertas activas',
      value:   stats.active_alerts,
      icon:    AlertTriangle,
      color:   stats.active_alerts > 0 ? 'text-red-600' : 'text-gray-400',
      bg:      stats.active_alerts > 0 ? 'bg-red-50' : 'bg-gray-50',
      border:  stats.active_alerts > 0 ? 'border-red-100' : 'border-gray-200',
    },
    {
      label:   'Productividad',
      value:   `${stats.productivity_today}%`,
      icon:    TrendingUp,
      color:   'text-purple-600',
      bg:      'bg-purple-50',
      border:  'border-purple-100',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`${card.bg} ${card.border} border rounded-xl p-4 flex flex-col gap-2`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-500 font-medium">{card.label}</span>
            <card.icon className={`w-4 h-4 ${card.color}`} />
          </div>
          <span className={`text-2xl font-semibold ${card.color}`}>
            {card.value}
          </span>
        </div>
      ))}
    </div>
  )
}
