'use client'

import { useState, useEffect } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import { es } from 'date-fns/locale'

interface AlertsChartProps {
  companyId: string
}

interface AlertsData {
  date:     string
  critical: number
  high:     number
  medium:   number
  low:      number
}

export function AlertsChart({ companyId }: AlertsChartProps) {
  const [data, setData]     = useState<AlertsData[]>([])
  const [loading, setLoading] = useState(true)
  const [range, setRange]   = useState(7)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const to   = new Date()
      const from = subDays(to, range)

      const params = new URLSearchParams({
        date_from:  from.toISOString(),
        date_to:    to.toISOString(),
        per_page:   '500',
      })

      const res  = await fetch(`/api/alerts?${params}`)
      const json = await res.json()
      const alerts = json.data ?? []

      // Group by day and severity
      const days = eachDayOfInterval({ start: from, end: to })
      const grouped = days.map(day => {
        const dayStr = format(day, 'yyyy-MM-dd')
        const dayAlerts = alerts.filter((a: { created_at: string }) =>
          a.created_at.startsWith(dayStr)
        )
        return {
          date:     format(day, 'd MMM', { locale: es }),
          critical: dayAlerts.filter((a: { severity: string }) => a.severity === 'critical').length,
          high:     dayAlerts.filter((a: { severity: string }) => a.severity === 'high').length,
          medium:   dayAlerts.filter((a: { severity: string }) => a.severity === 'medium').length,
          low:      dayAlerts.filter((a: { severity: string }) => a.severity === 'low').length,
        }
      })

      setData(grouped)
      setLoading(false)
    }

    void load()
  }, [range, companyId])

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-gray-900">Alertas por día</h3>
        <div className="flex items-center gap-1">
          {[7, 14, 30].map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2.5 py-1 text-xs rounded-lg font-medium transition ${
                range === r
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-500 hover:bg-gray-100'
              }`}
            >
              {r}d
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full" />
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <AreaChart data={data} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorCritical" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorHigh" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#F97316" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#9CA3AF' }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                borderRadius: '10px',
                border: '1px solid #E5E7EB',
                fontSize: '12px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: '11px', paddingTop: '8px' }}
              formatter={(value) => ({ critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja' }[value] ?? value)}
            />
            <Area type="monotone" dataKey="critical" stroke="#EF4444" fill="url(#colorCritical)" strokeWidth={2} />
            <Area type="monotone" dataKey="high"     stroke="#F97316" fill="url(#colorHigh)"     strokeWidth={2} />
            <Area type="monotone" dataKey="medium"   stroke="#EAB308" fill="none"               strokeWidth={1.5} strokeDasharray="4 2" />
            <Area type="monotone" dataKey="low"      stroke="#3B82F6" fill="none"               strokeWidth={1} strokeDasharray="4 2" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  )
}
