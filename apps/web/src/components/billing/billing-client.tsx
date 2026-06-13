'use client'

import { useState } from 'react'
import { CheckCircle, Loader2, CreditCard, Calendar, AlertTriangle } from 'lucide-react'

interface Plan {
  id: string; name: string; type: string
  max_vehicles: number; max_users: number
  price_monthly: number; price_yearly: number
  features: Record<string, boolean | number>
}

interface Subscription {
  id: string; status: string
  current_period_end: string
  cancel_at_period_end: boolean
  stripe_subscription_id: string | null
  plan: Plan | null
}

interface Props {
  subscription: Subscription | null
  plans: Plan[]
  company: { name: string; email: string; status: string } | null
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active:   { label: 'Activa',          color: 'bg-green-50 text-green-700 border-green-200' },
  trialing: { label: 'Período de prueba', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  past_due: { label: 'Pago pendiente',  color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  cancelled:{ label: 'Cancelada',       color: 'bg-red-50 text-red-700 border-red-200' },
}

const FEATURE_LABELS: Record<string, string> = {
  realtime_map:         'Mapa en tiempo real',
  alerts:               'Sistema de alertas',
  geofences:            'Geocercas',
  reports:              'Reportes avanzados',
  maintenance:          'Control de mantenimiento',
  mobile_app:           'App móvil',
  ai_assistant:         'Asistente IA',
  api_access:           'Acceso API',
  white_label:          'White label',
}

export function BillingClient({ subscription, plans, company }: Props) {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [billing, setBilling]         = useState<'monthly' | 'yearly'>('monthly')

  const currentPlan  = subscription?.plan
  const statusConfig = STATUS_MAP[subscription?.status ?? 'trialing'] ?? STATUS_MAP['trialing']!

  async function handleUpgrade(planId: string) {
    setLoadingPlan(planId)
    try {
      const res  = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, billing_period: billing }),
      })
      const data = await res.json()
      if (data.checkout_url) window.location.href = data.checkout_url
    } finally { setLoadingPlan(null) }
  }

  async function handlePortal() {
    const res  = await fetch('/api/billing/portal', { method: 'POST' })
    const data = await res.json()
    if (data.portal_url) window.location.href = data.portal_url
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Current subscription */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <h2 className="text-lg font-semibold text-gray-900">
                Plan {currentPlan?.name ?? 'Básico'}
              </h2>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
            {subscription?.current_period_end && (
              <p className="text-sm text-gray-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {subscription.status === 'trialing' ? 'Prueba hasta:' : 'Próxima renovación:'}
                {' '}{new Date(subscription.current_period_end).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            )}
          </div>
          {subscription?.stripe_subscription_id && (
            <button onClick={handlePortal}
              className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">
              <CreditCard className="w-4 h-4" /> Gestionar pago
            </button>
          )}
        </div>

        {subscription?.status === 'past_due' && (
          <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-yellow-800">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            Hay un problema con tu método de pago. Actualízalo para mantener el acceso.
          </div>
        )}
      </div>

      {/* Billing toggle */}
      <div className="flex items-center gap-4">
        <span className="text-sm font-medium text-gray-900">Planes disponibles</span>
        <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1">
          {(['monthly', 'yearly'] as const).map(b => (
            <button key={b} onClick={() => setBilling(b)}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition ${billing === b ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {b === 'monthly' ? 'Mensual' : 'Anual (-20%)'}
            </button>
          ))}
        </div>
      </div>

      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map(plan => {
          const isCurrent   = plan.id === currentPlan?.id
          const price       = billing === 'monthly' ? plan.price_monthly : plan.price_yearly / 12
          const isLoading   = loadingPlan === plan.id
          const isEnterprise = plan.type === 'empresarial'

          return (
            <div key={plan.id} className={`relative bg-white border rounded-2xl p-6 flex flex-col
              ${isCurrent ? 'border-blue-400 ring-2 ring-blue-100' : isEnterprise ? 'border-purple-200' : 'border-gray-200'}`}>
              {isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full font-medium">
                  Plan actual
                </div>
              )}
              {isEnterprise && !isCurrent && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-purple-600 text-white text-xs px-3 py-1 rounded-full font-medium">
                  Recomendado
                </div>
              )}

              <div className="mb-4">
                <div className="text-lg font-bold text-gray-900">{plan.name}</div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold text-gray-900">${price.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</span>
                  <span className="text-sm text-gray-500">MXN/mes</span>
                </div>
                {billing === 'yearly' && (
                  <div className="text-xs text-green-600 mt-1">Ahorra ${(plan.price_monthly * 12 - plan.price_yearly).toLocaleString()} al año</div>
                )}
                <div className="text-sm text-gray-500 mt-2">
                  Hasta {plan.max_vehicles} vehículos · {plan.max_users} usuarios
                </div>
              </div>

              <div className="flex-1 space-y-2 mb-6">
                {Object.entries(FEATURE_LABELS).map(([key, label]) => {
                  const val = plan.features[key]
                  const included = val === true || (typeof val === 'number' && val > 0)
                  return (
                    <div key={key} className={`flex items-center gap-2 text-sm ${included ? 'text-gray-700' : 'text-gray-300'}`}>
                      <CheckCircle className={`w-4 h-4 flex-shrink-0 ${included ? 'text-green-500' : 'text-gray-200'}`} />
                      {label}
                      {typeof val === 'number' && val > 0 && key === 'route_history_days' && (
                        <span className="text-xs text-gray-400">({val} días)</span>
                      )}
                    </div>
                  )
                })}
              </div>

              <button
                onClick={() => !isCurrent && handleUpgrade(plan.id)}
                disabled={isCurrent || isLoading}
                className={`w-full py-3 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2
                  ${isCurrent ? 'bg-gray-100 text-gray-400 cursor-default' :
                    isEnterprise ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
              >
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</> :
                 isCurrent ? 'Plan activo' : 'Seleccionar plan'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
