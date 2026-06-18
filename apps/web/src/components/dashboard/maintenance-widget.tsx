'use client'

import Link from 'next/link'
import { Wrench, AlertTriangle, Calendar, Gauge, ArrowRight } from 'lucide-react'
import { useUpcomingMaintenance } from '@/lib/hooks/use-maintenance'

export function MaintenanceWidget() {
  const { data: items, isLoading } = useUpcomingMaintenance(30)

  const overdue = (items ?? []).filter(i => i.is_overdue)
  const upcoming = (items ?? []).filter(i => !i.is_overdue)

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5 animate-pulse">
        <div className="h-4 bg-gray-100 rounded w-40 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-12 bg-gray-50 rounded-xl" />)}
        </div>
      </div>
    )
  }

  if (!items?.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Wrench className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-gray-900">Mantenimiento</h3>
        </div>
        <div className="text-center py-4">
          <div className="text-2xl mb-1">✅</div>
          <p className="text-xs text-gray-500">Sin mantenimientos pendientes</p>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wrench className="w-4 h-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Mantenimiento próximo</h3>
        </div>
        {overdue.length > 0 && (
          <span className="flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 px-2 py-0.5 rounded-full font-medium">
            <AlertTriangle className="w-3 h-3" />
            {overdue.length} vencido{overdue.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div className="space-y-2">
        {[...overdue, ...upcoming].slice(0, 5).map((item, i) => (
          <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border text-xs ${
            item.is_overdue
              ? 'bg-red-50 border-red-100'
              : item.days_remaining !== null && item.days_remaining <= 7
              ? 'bg-yellow-50 border-yellow-100'
              : 'bg-gray-50 border-gray-100'
          }`}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-gray-900">{item.economic_num}</span>
                <span className="text-gray-500">·</span>
                <span className="text-gray-600">{item.maintenance_type.replace('_', ' ')}</span>
              </div>
              <div className="flex gap-3 mt-1 text-gray-500">
                {item.next_service_date && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {item.is_overdue
                      ? `Vencido hace ${Math.abs(item.days_remaining ?? 0)}d`
                      : `En ${item.days_remaining}d`}
                  </span>
                )}
                {item.km_remaining !== null && item.km_remaining > 0 && (
                  <span className="flex items-center gap-1">
                    <Gauge className="w-3 h-3" />
                    {Math.round(item.km_remaining).toLocaleString()} km restantes
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {items.length > 5 && (
        <Link href="/maintenance"
          className="flex items-center justify-center gap-1 mt-3 text-xs text-orange-500 hover:text-orange-600 font-medium">
          Ver todos ({items.length}) <ArrowRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  )
}
