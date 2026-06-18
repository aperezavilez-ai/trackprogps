'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Gauge } from 'lucide-react'

interface KmStat {
  vehicle_id:   string
  economic_num: string
  plates:       string
  km_total:     number
  trips_count:  number
  avg_speed:    number | null
  max_speed:    number | null
}

export function FleetKmWidget() {
  const [stats, setStats]   = useState<KmStat[]>([])
  const [loading, setLoading] = useState(true)
  const [total, setTotal]   = useState(0)

  useEffect(() => {
    async function load() {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const params = new URLSearchParams({
        date_from: today.toISOString(),
        date_to:   new Date().toISOString(),
      })
      const res  = await fetch(`/api/reports/km-stats?${params}`)
      const data = await res.json()
      const items = data.data ?? []
      setStats(items.slice(0, 5))
      setTotal(items.reduce((s: number, v: KmStat) => s + (v.km_total ?? 0), 0))
      setLoading(false)
    }
    void load()
  }, [])

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Km hoy</h3>
        </div>
        <span className="text-lg font-bold text-orange-500">
          {total.toFixed(0)} km
        </span>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-10 bg-gray-50 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : stats.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-4">Sin datos de km hoy</p>
      ) : (
        <div className="space-y-2">
          {stats.map((stat, i) => {
            const pct = total > 0 ? (stat.km_total / total) * 100 : 0
            return (
              <div key={stat.vehicle_id} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-4 text-right">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-xs font-medium text-gray-900 truncate">
                      {stat.economic_num}
                    </span>
                    <span className="text-xs text-gray-500 ml-2 flex-shrink-0">
                      {stat.km_total.toFixed(1)} km
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
                {stat.max_speed && (
                  <div className="flex items-center gap-0.5 text-xs text-gray-400 flex-shrink-0">
                    <Gauge className="w-3 h-3" />
                    {Math.round(stat.max_speed)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
