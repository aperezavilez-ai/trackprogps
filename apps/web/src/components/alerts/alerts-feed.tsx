'use client'

import { useState, useEffect } from 'react'
import { AlertTriangle, Zap, MapPin, Gauge } from 'lucide-react'
import { useRealtimeAlerts } from '@/lib/hooks/use-realtime'
import type { Alert } from '@gps-saas/types'

interface AlertsFeedProps {
  initialAlerts: Alert[]
  companyId: string
}

const ALERT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  speed_excess:          Gauge,
  geofence_enter:        MapPin,
  geofence_exit:         MapPin,
  sos:                   AlertTriangle,
  power_cut:             Zap,
  unauthorized_movement: AlertTriangle,
  default:               AlertTriangle,
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'bg-red-50 border-red-200 text-red-700',
  high:     'bg-orange-50 border-orange-200 text-orange-700',
  medium:   'bg-yellow-50 border-yellow-200 text-yellow-700',
  low:      'bg-orange-50 border-orange-200 text-orange-600',
}

export function AlertsFeed({ initialAlerts, companyId }: AlertsFeedProps) {
  const [alerts, setAlerts] = useState<Alert[]>(initialAlerts)

  // Subscribe to new alerts in realtime
  useRealtimeAlerts(companyId, (newAlert) => {
    setAlerts((prev) => [newAlert as Alert, ...prev].slice(0, 50))
  })

  return (
    <div className="bg-white border border-gray-200 rounded-xl h-full flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Alertas activas</h3>
        {alerts.length > 0 && (
          <span className="bg-red-100 text-red-700 text-xs font-medium px-2 py-0.5 rounded-full">
            {alerts.length}
          </span>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {alerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 gap-2 py-8">
            <AlertTriangle className="w-8 h-8 opacity-40" />
            <span className="text-sm">Sin alertas activas</span>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function AlertCard({ alert }: { alert: Alert }) {
  const Icon = ALERT_ICONS[alert.type] ?? ALERT_ICONS['default']!
  const style = SEVERITY_STYLES[alert.severity] ?? SEVERITY_STYLES['low']!

  const timeAgo = (date: string) => {
    const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000)
    if (seconds < 60)   return `${seconds}s`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`
    return `${Math.floor(seconds / 3600)}h`
  }

  return (
    <div className={`px-4 py-3 border-l-2 ${style}`}>
      <div className="flex items-start gap-2">
        <Icon className="w-4 h-4 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{alert.title}</div>
          <div className="text-xs opacity-75 mt-0.5 line-clamp-2">{alert.message}</div>
        </div>
        <span className="text-xs opacity-60 flex-shrink-0">{timeAgo(alert.created_at)}</span>
      </div>
    </div>
  )
}
