'use client'

import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'

interface Plan {
  id: string
  name: string
  type: string
  max_vehicles: number
  max_users: number
  price_monthly: number
  price_yearly: number
}

interface Props {
  selectedId?: string | null
  onSelect?: (planId: string) => void
  compact?: boolean
  billing?: 'monthly' | 'yearly'
  onBillingChange?: (period: 'monthly' | 'yearly') => void
  requireSelection?: boolean
}

const HIGHLIGHT_TYPE = 'profesional'

export function PublicPricingPlans({
  selectedId,
  onSelect,
  compact,
  billing: billingProp,
  onBillingChange,
  requireSelection,
}: Props) {
  const [plans, setPlans] = useState<Plan[]>([])
  const [billingLocal, setBillingLocal] = useState<'monthly' | 'yearly'>('monthly')
  const billing = billingProp ?? billingLocal
  const setBilling = onBillingChange ?? setBillingLocal

  useEffect(() => {
    fetch('/api/plans/public')
      .then((r) => r.json())
      .then((json) => setPlans(json.data ?? []))
      .catch(() => {})
  }, [])

  if (!plans.length) return null

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      <div className="flex items-center justify-between gap-2">
        <h3 className={`font-semibold text-gray-900 ${compact ? 'text-sm' : 'text-base'}`}>
          Planes TrackPro GPS
        </h3>
        <div className="flex rounded-lg border border-gray-200 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setBilling('monthly')}
            className={`px-2.5 py-1 rounded-md ${billing === 'monthly' ? 'bg-orange-500 text-white' : 'text-gray-600'}`}
          >
            Mensual
          </button>
          <button
            type="button"
            onClick={() => setBilling('yearly')}
            className={`px-2.5 py-1 rounded-md ${billing === 'yearly' ? 'bg-orange-500 text-white' : 'text-gray-600'}`}
          >
            Anual
          </button>
        </div>
      </div>

      <div className={`grid gap-3 ${compact ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-3'}`}>
        {plans.map((plan) => {
          const price = billing === 'monthly' ? plan.price_monthly : plan.price_yearly
          const highlighted = plan.type === HIGHLIGHT_TYPE
          const selected = selectedId === plan.id
          return (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelect?.(plan.id)}
              className={`text-left rounded-xl border-2 p-4 transition ${
                selected || highlighted
                  ? 'border-orange-500 bg-orange-50/80 ring-1 ring-orange-200'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
            >
              {highlighted && (
                <span className="text-[10px] uppercase tracking-wide font-semibold text-orange-600">Más popular</span>
              )}
              <div className="font-semibold text-gray-900 mt-0.5">{plan.name}</div>
              <div className="mt-2">
                <span className="text-2xl font-bold text-gray-900">
                  ${price.toLocaleString('es-MX')}
                </span>
                <span className="text-xs text-gray-500 ml-1">
                  /{billing === 'monthly' ? 'mes' : 'año'}
                </span>
              </div>
              <ul className="mt-3 space-y-1 text-xs text-gray-600">
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                  Hasta {plan.max_vehicles >= 999 ? 'flota ilimitada' : `${plan.max_vehicles} vehículos`}
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                  {plan.max_users >= 999 ? 'Usuarios ilimitados' : `${plan.max_users} usuarios`}
                </li>
                <li className="flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-green-600 flex-shrink-0" />
                  Mapa en tiempo real + alertas
                </li>
              </ul>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-gray-500 text-center">
        14 días de prueba gratuita{requireSelection ? ' · Elige un plan para continuar' : ' · Sin tarjeta al registrarte'}
      </p>
    </div>
  )
}
