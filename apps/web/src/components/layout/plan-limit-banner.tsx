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

  const vehiclePct = usage.vehicles.max > 0
    ? (usage.vehicles.current / usage.vehicles.max) * 100
    : 0
  const mobileMax = usage.mobile_devices?.max ?? 0
  const mobileCurrent = usage.mobile_devices?.current ?? 0
  const mobilePct = mobileMax > 0 ? (mobileCurrent / mobileMax) * 100 : 0
  const userPct = usage.users.max > 0
    ? (usage.users.current / usage.users.max) * 100
    : 0

  const atVehicleLimit = usage.at_vehicle_limit
  const atMobileLimit = usage.at_mobile_limit ?? false
  const atUserLimit = usage.at_user_limit
  const showVehicle = usage.vehicles.max > 0 && vehiclePct >= 80
  const showMobile = mobileMax > 0 && mobilePct >= 80
  const showUser = userPct >= 80

  if (!showVehicle && !showMobile && !showUser) return null

  const critical = atVehicleLimit || atMobileLimit || atUserLimit
  const messages: string[] = []

  if (showVehicle) {
    messages.push(atVehicleLimit
      ? `GPS vehículo: ${usage.vehicles.current}/${usage.vehicles.max} (límite)`
      : `GPS vehículo: ${Math.round(vehiclePct)}% (${usage.vehicles.current}/${usage.vehicles.max})`)
  }
  if (showMobile) {
    messages.push(atMobileLimit
      ? `Móviles: ${mobileCurrent}/${mobileMax} (límite)`
      : `Móviles: ${Math.round(mobilePct)}% (${mobileCurrent}/${mobileMax})`)
  }
  if (showUser) {
    messages.push(atUserLimit
      ? `Usuarios: ${usage.users.current}/${usage.users.max} (límite)`
      : `Usuarios: ${Math.round(userPct)}% (${usage.users.current}/${usage.users.max})`)
  }

  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 text-sm ${
      critical
        ? 'bg-red-50 border-b border-red-100 text-red-800'
        : 'bg-yellow-50 border-b border-yellow-100 text-yellow-800'
    }`}>
      <AlertTriangle className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{messages.join(' · ')}. Actualiza tu plan para ampliar capacidad.</span>
      <Link
        href="/billing"
        className={`flex items-center gap-1 font-medium text-xs whitespace-nowrap ${
          critical ? 'text-red-700 hover:text-red-900' : 'text-yellow-700 hover:text-yellow-900'
        }`}
      >
        Ver planes <ArrowRight className="w-3.5 h-3.5" />
      </Link>
    </div>
  )
}
