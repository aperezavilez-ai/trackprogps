import Link from 'next/link'
import { Compass, CreditCard } from 'lucide-react'
import { getAccountPhase, type AccountPhaseInput } from '@/lib/billing/account-phase'

interface Props extends AccountPhaseInput {
  role: string
}

export function ExplorationBanner({ role, ...input }: Props) {
  if (role !== 'admin_empresa') return null

  const phase = getAccountPhase(input)
  if (phase !== 'demo') return null

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 text-sm bg-gradient-to-r from-orange-50 to-amber-50 border-b border-orange-100 text-orange-950">
      <Compass className="w-4 h-4 flex-shrink-0 text-orange-600" />
      <span className="flex-1">
        <strong>Modo demostración</strong> — Explora mapa, alertas, reportes y más con datos de ejemplo.
        Nada se guarda hasta que contrates un plan.
      </span>
      <Link
        href="/billing?tab=suscripcion"
        className="flex items-center gap-1 font-semibold text-xs whitespace-nowrap bg-orange-500 text-white px-3 py-1.5 rounded-md hover:bg-orange-400 transition"
      >
        <CreditCard className="w-3.5 h-3.5" />
        Elegir plan
      </Link>
    </div>
  )
}
