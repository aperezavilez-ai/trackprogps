import Link from 'next/link'
import { Clock, AlertTriangle, CreditCard } from 'lucide-react'
import { getTrialStatus, trialDaysLeft, type TrialStatusInput } from '@/lib/billing/trial-status'

interface Props extends TrialStatusInput {
  role: string
}

export function TrialBanner({ role, ...input }: Props) {
  if (role !== 'admin_empresa') return null

  const phase = getTrialStatus(input)
  const daysLeft = trialDaysLeft(input.trialEndsAt)

  if (phase === 'paid' || phase === 'suspended') return null

  if (phase === 'expired') {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 text-sm bg-red-50 border-b border-red-100 text-red-800">
        <AlertTriangle className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1 font-medium">
          Tu prueba gratuita terminó. Activa un plan para seguir usando TrackPro GPS.
        </span>
        <Link href="/billing?trial_expired=1&tab=suscripcion" className="flex items-center gap-1 font-semibold text-xs whitespace-nowrap text-red-700 hover:text-red-900">
          <CreditCard className="w-3.5 h-3.5" />
          Elegir plan
        </Link>
      </div>
    )
  }

  if (phase === 'ending_soon' && daysLeft !== null) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 text-sm bg-orange-50 border-b border-orange-100 text-orange-900">
        <Clock className="w-4 h-4 flex-shrink-0" />
        <span className="flex-1">
          Tu prueba termina en <strong>{daysLeft} día{daysLeft === 1 ? '' : 's'}</strong>. Contrata un plan para no perder acceso.
        </span>
        <Link href="/billing?tab=suscripcion" className="font-semibold text-xs whitespace-nowrap text-orange-700 hover:text-orange-900">
          Ver planes
        </Link>
      </div>
    )
  }

  if (input.trialEndsAt && daysLeft !== null && daysLeft > 3) {
    return (
      <div className="hidden lg:flex items-center gap-3 px-4 py-2 text-xs bg-blue-50/80 border-b border-blue-100 text-blue-800">
        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1">Prueba gratuita — {daysLeft} días restantes</span>
        <Link href="/billing?tab=suscripcion" className="font-medium hover:underline">Planes</Link>
      </div>
    )
  }

  return null
}
