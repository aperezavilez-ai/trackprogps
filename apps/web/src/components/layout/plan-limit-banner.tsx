'use client'

import Link from 'next/link'
import { AlertTriangle, ArrowRight } from 'lucide-react'
import { useCompanyUsage } from '@/lib/hooks/use-company-usage'

interface PlanLimitBannerProps {
  companyId: string
}

export function PlanLimitBanner({ companyId }: PlanLimitBannerProps) {
  const { usage, loading } = useCompanyUsage(companyId)

  if (loading || !usage) return null

  const vehiclePct = (usage.vehicles.current / usage.vehicles.max) * 100
  const atLimit    = usage.at_vehicle_limit

  // Only show when >= 80% of vehicle limit used
  if (vehiclePct < 80) return null

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
      atLimit
        ? 'bg-red-50 border-b border-red-100 text-red-800'
        : 'bg-yellow-50 border-b border-yellow-100 text-yellow-800'
    }`}>
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">
        {atLimit
          ? `Alcanzaste el límite de tu plan: ${usage.vehicles.current}/${usage.vehicles.max} vehículos.`
          : `Vas a ${Math.round(vehiclePct)}% de tu límite: ${usage.vehicles.current}/${usage.vehicles.max} vehículos.`}
        {' '}Actualiza tu plan para agregar más.
      </span>
      <Link
        href="/billing"
        className={`flex items-center gap-1 font-medium text-xs whitespace-nowrap ${
          atLimit ? 'text-red-700 hover:text-red-900' : 'text-yellow-700 hover:text-yellow-900'
        }`}
      >
        Ver planes <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}
