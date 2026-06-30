'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  CheckCircle, Loader2, CreditCard, Calendar, AlertTriangle,
  FileText, Wallet, Users, Radio, Truck, Search, TrendingUp, Building2,
} from 'lucide-react'

type BillingTab = 'ingresos' | 'facturas' | 'pagos' | 'suscripcion'

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

interface ClientSummary {
  id: string
  full_name: string
  phone: string | null
  email: string | null
  is_active: boolean
  vehicles_count: number
  active_vehicles: number
  gps_devices: number
  vehicles: {
    id: string; economic_num: string; plates: string; status: string
    device: { id: string; imei: string; status: string } | null
  }[]
}

interface CompanyOption { id: string; name: string }

interface Props {
  subscription: Subscription | null
  plans: Plan[]
  company: { id?: string; name: string; email: string; status: string } | null
  defaultTab?: BillingTab
  isPlatformAdmin?: boolean
  billingSettings?: Record<string, string> | null
  pendingCheckout?: { plan_id: string; billing_period: 'monthly' | 'yearly' } | null
  autoCheckout?: boolean
}

const COMPANY_TABS = [
  { id: 'facturas' as const,     label: 'Facturas CFDI', icon: FileText },
  { id: 'pagos' as const,       label: 'Pagos',         icon: Wallet },
  { id: 'suscripcion' as const, label: 'Suscripción',   icon: CreditCard },
]

interface PlatformStats {
  summary: {
    estimated_mrr: number
    paying_companies: number
    past_due: number
    with_stripe: number
    total_companies: number
    active_companies: number
    demo_companies: number
  }
  by_plan: { name: string; count: number; mrr: number }[]
  companies: {
    company_id: string
    company_name: string
    company_status: string
    plan_name: string
    subscription_status: string
    monthly_amount: number
    period_end: string
    has_stripe: boolean
  }[]
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  active:   { label: 'Activa',            color: 'bg-green-50 text-green-700 border-green-200' },
  trialing: { label: 'Período de prueba', color: 'bg-orange-50 text-orange-600 border-orange-200' },
  past_due: { label: 'Pago pendiente',    color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  cancelled:{ label: 'Cancelada',         color: 'bg-red-50 text-red-700 border-red-200' },
}

const FEATURE_LABELS: Record<string, string> = {
  realtime_map:  'Mapa en tiempo real',
  alerts:        'Sistema de alertas',
  geofences:     'Geocercas',
  reports:       'Reportes avanzados',
  maintenance:   'Control de mantenimiento',
  mobile_app:    'App móvil',
  ai_assistant:  'Asistente IA',
  api_access:    'Acceso API',
  white_label:   'White label',
}

export function BillingClient({
  subscription: initialSubscription,
  plans: initialPlans,
  company: initialCompany,
  defaultTab = 'facturas',
  isPlatformAdmin,
  billingSettings: initialBillingSettings,
  pendingCheckout = null,
  autoCheckout = false,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [tab, setTab]                 = useState<BillingTab>(defaultTab)
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null)
  const [billing, setBilling]         = useState<'monthly' | 'yearly'>(pendingCheckout?.billing_period ?? 'monthly')
  const [loading, setLoading]         = useState(isPlatformAdmin ?? false)
  const [platformStats, setPlatformStats] = useState<PlatformStats | null>(null)
  const [platformLoading, setPlatformLoading] = useState(false)

  const tabs = useMemo(() => {
    if (!isPlatformAdmin) return COMPANY_TABS
    return [
      { id: 'ingresos' as const, label: 'Ingresos', icon: TrendingUp },
      ...COMPANY_TABS,
    ]
  }, [isPlatformAdmin])

  const [companies, setCompanies]         = useState<CompanyOption[]>([])
  const [companyId, setCompanyId]       = useState(initialCompany?.id ?? '')
  const [driverId, setDriverId]         = useState('')

  const [subscription, setSubscription] = useState(initialSubscription)
  const [plans, setPlans]               = useState(initialPlans)
  const [company, setCompany]           = useState(initialCompany)
  const [billingSettings, setBillingSettings] = useState(initialBillingSettings)
  const [clients, setClients]           = useState<ClientSummary[]>([])

  const loadOverview = useCallback(async (cId: string, dId?: string) => {
    if (!cId) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ company_id: cId })
      if (dId) params.set('driver_id', dId)
      const res = await fetch(`/api/billing/overview?${params}`)
      const data = await res.json()
      if (!res.ok) return
      setSubscription(data.subscription)
      setPlans(data.plans ?? [])
      setCompany(data.company)
      setBillingSettings(data.billing_settings)
      setClients(data.clients ?? [])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadPlatformStats = useCallback(async () => {
    setPlatformLoading(true)
    try {
      const res = await fetch('/api/billing/platform-stats')
      const data = await res.json()
      if (res.ok) setPlatformStats(data)
    } finally {
      setPlatformLoading(false)
    }
  }, [])

  useEffect(() => {
    setTab(defaultTab)
  }, [defaultTab])

  useEffect(() => {
    if (isPlatformAdmin) {
      void loadPlatformStats()
      fetch('/api/billing/overview')
        .then(r => r.json())
        .then(data => {
          setCompanies(data.companies ?? [])
          setLoading(false)
        })
      const fromUrl = searchParams.get('company_id')
      if (fromUrl) setCompanyId(fromUrl)
    } else if (initialCompany?.id) {
      void loadOverview(initialCompany.id)
    }
  }, [isPlatformAdmin, initialCompany?.id, loadOverview, loadPlatformStats, searchParams])

  useEffect(() => {
    if (companyId) void loadOverview(companyId, driverId || undefined)
  }, [companyId, driverId, loadOverview])

  const currentPlan  = subscription?.plan
  const statusConfig = STATUS_MAP[subscription?.status ?? 'trialing'] ?? STATUS_MAP['trialing']!

  const filteredClients = driverId
    ? clients.filter(c => c.id === driverId)
    : clients

  async function handleUpgrade(planId: string) {
    setLoadingPlan(planId)
    try {
      const res  = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan_id: planId, billing_period: billing }),
      })
      const data = await res.json()
      if (data.checkout_url) {
        window.location.href = data.checkout_url
        return
      }
      if (data.error) alert(data.error)
    } finally { setLoadingPlan(null) }
  }

  useEffect(() => {
    if (!autoCheckout || !pendingCheckout?.plan_id || isPlatformAdmin) return
    if (loadingPlan) return
    const t = setTimeout(() => {
      void handleUpgrade(pendingCheckout.plan_id)
    }, 600)
    return () => clearTimeout(t)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoCheckout, pendingCheckout?.plan_id, isPlatformAdmin])

  async function handlePortal() {
    const res  = await fetch('/api/billing/portal', { method: 'POST' })
    const data = await res.json()
    if (data.portal_url) window.location.href = data.portal_url
  }

  function onCompanyChange(id: string) {
    setCompanyId(id)
    setDriverId('')
  }

  function changeTab(next: BillingTab) {
    setTab(next)
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', next)
    params.delete('checkout')
    router.replace(`/billing?${params.toString()}`, { scroll: false })
  }

  const showCompanyHint = isPlatformAdmin && !companyId && tab !== 'ingresos'

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl overflow-x-auto">
        {tabs.map(t => (
          <button key={t.id} onClick={() => changeTab(t.id)}
            className={`flex items-center gap-2 flex-1 py-2.5 px-4 rounded-lg text-sm font-medium whitespace-nowrap transition ${tab === t.id ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {tab === 'ingresos' && isPlatformAdmin && (
        <div className="space-y-4">
          {platformLoading && (
            <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando ingresos...
            </div>
          )}
          {!platformLoading && platformStats && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { label: 'MRR estimado', value: `$${platformStats.summary.estimated_mrr.toLocaleString('es-MX')} MXN`, icon: TrendingUp, color: 'text-green-600' },
                  { label: 'Empresas pagando', value: platformStats.summary.paying_companies, icon: Building2, color: 'text-orange-500' },
                  { label: 'Con Stripe', value: platformStats.summary.with_stripe, icon: CreditCard, color: 'text-blue-600' },
                  { label: 'Pago pendiente', value: platformStats.summary.past_due, icon: AlertTriangle, color: 'text-yellow-600' },
                ].map(card => (
                  <div key={card.label} className="bg-white border border-gray-200 rounded-2xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-gray-500">{card.label}</span>
                      <card.icon className={`w-4 h-4 ${card.color}`} />
                    </div>
                    <div className={`text-xl font-bold ${card.color}`}>{card.value}</div>
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total empresas', value: platformStats.summary.total_companies },
                  { label: 'Activas', value: platformStats.summary.active_companies },
                  { label: 'En demo', value: platformStats.summary.demo_companies },
                ].map(s => (
                  <div key={s.label} className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm">
                    <div className="text-gray-500 text-xs">{s.label}</div>
                    <div className="text-lg font-semibold text-gray-900">{s.value}</div>
                  </div>
                ))}
              </div>

              {platformStats.by_plan.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-2xl p-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Ingresos por plan</h2>
                  <div className="space-y-2">
                    {platformStats.by_plan.map(row => (
                      <div key={row.name} className="flex items-center justify-between text-sm py-2 border-b border-gray-100 last:border-0">
                        <span className="font-medium text-gray-900">{row.name} <span className="text-gray-400 font-normal">({row.count})</span></span>
                        <span className="text-green-600 font-semibold">${row.mrr.toLocaleString('es-MX')} MXN/mes</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Empresas con suscripción</h2>
                {platformStats.companies.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">No hay suscripciones activas o en prueba.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                          <th className="pb-2 pr-4">Empresa</th>
                          <th className="pb-2 pr-4">Plan</th>
                          <th className="pb-2 pr-4">Estado</th>
                          <th className="pb-2 pr-4">Monto/mes</th>
                          <th className="pb-2">Renovación</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {platformStats.companies.map(row => {
                          const st = STATUS_MAP[row.subscription_status] ?? STATUS_MAP.trialing!
                          return (
                            <tr key={row.company_id}>
                              <td className="py-3 pr-4">
                                <div className="font-medium text-gray-900">{row.company_name}</div>
                                <div className="text-xs text-gray-400">{row.company_status}{row.has_stripe ? ' · Stripe' : ''}</div>
                              </td>
                              <td className="py-3 pr-4 text-gray-700">{row.plan_name}</td>
                              <td className="py-3 pr-4">
                                <span className={`text-xs px-2 py-0.5 rounded-full border ${st.color}`}>{st.label}</span>
                              </td>
                              <td className="py-3 pr-4 font-medium">${row.monthly_amount.toLocaleString('es-MX')}</td>
                              <td className="py-3 text-gray-500 text-xs">
                                {row.period_end ? new Date(row.period_end).toLocaleDateString('es-MX') : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
                <p className="mt-4 text-xs text-gray-400">
                  MRR estimado con precio mensual del plan. Para detalle completo usa{' '}
                  <Link href="/admin" className="text-orange-500 hover:underline">Administrador → Empresas</Link>.
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {tab !== 'ingresos' && (
      <>
      {/* Selector por empresa / cliente */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Search className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-900">Consultar por usuario</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Selecciona empresa y cliente para verificar facturación, pagos y dispositivos GPS asignados.
        </p>

        <div className={`grid gap-3 ${isPlatformAdmin ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
          {isPlatformAdmin && (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Empresa</label>
              <select value={companyId} onChange={e => onCompanyChange(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500">
                <option value="">Selecciona una empresa...</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Cliente</label>
            <select value={driverId} onChange={e => setDriverId(e.target.value)}
              disabled={!companyId && isPlatformAdmin}
              className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50">
              <option value="">Todos los clientes</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
            </select>
          </div>
        </div>

        {company && (
          <p className="mt-3 text-xs text-orange-500 font-medium">
            Consultando: {company.name}{driverId ? ` → ${clients.find(c => c.id === driverId)?.full_name}` : ''}
          </p>
        )}
      </div>

      {showCompanyHint && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 text-sm text-orange-800">
          Selecciona una empresa para ver su facturación, pagos y verificar clientes.
          Gestiona suscripciones en <Link href="/admin" className="underline font-medium">Empresas y suscripciones</Link>.
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-400 text-sm gap-2">
          <Loader2 className="w-4 h-4 animate-spin" /> Cargando datos...
        </div>
      )}

      {!loading && (companyId || !isPlatformAdmin) && (
        <>
          {tab === 'facturas' && (
            <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-gray-900">Facturas CFDI</h2>
              {company && (
                <p className="text-sm text-gray-500">Empresa: <strong>{company.name}</strong> · {company.email}</p>
              )}
              {billingSettings?.razon_social ? (
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-gray-500">Razón social:</span> <strong>{billingSettings.razon_social}</strong></div>
                  <div><span className="text-gray-500">RFC:</span> <strong>{billingSettings.rfc}</strong></div>
                  <div><span className="text-gray-500">Régimen fiscal:</span> {billingSettings.regimen_fiscal}</div>
                  <div><span className="text-gray-500">C.P.:</span> {billingSettings.codigo_postal}</div>
                  <div><span className="text-gray-500">PAC:</span> {billingSettings.pac_provider || 'No configurado'}</div>
                  <div><span className="text-gray-500">Serie:</span> {billingSettings.serie_factura || 'A'}</div>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">
                  Sin datos CFDI configurados. Configura en{' '}
                  <Link href="/settings" className="text-orange-500 hover:underline">Configuración → Facturación CFDI</Link>.
                </p>
              )}
              <div className="border border-dashed border-gray-200 rounded-xl p-8 text-center text-gray-400 text-sm">
                No hay facturas emitidas aún. Al timbrar, aquí aparecerán PDF, XML, UUID y código QR.
              </div>
            </div>
          )}

          {tab === 'pagos' && (
            <div className="space-y-4">
              <div className="bg-white border border-gray-200 rounded-2xl p-6 space-y-4">
                <h2 className="text-lg font-semibold text-gray-900">Historial de pagos</h2>
                {subscription?.stripe_subscription_id ? (
                  <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl text-sm">
                    <div>
                      <div className="font-medium text-gray-900">Suscripción {currentPlan?.name}</div>
                      <div className="text-gray-500">Stripe · {subscription.status}</div>
                      {subscription.current_period_end && (
                        <div className="text-gray-400 text-xs mt-1">
                          Próximo cobro: {new Date(subscription.current_period_end).toLocaleDateString('es-MX')}
                        </div>
                      )}
                    </div>
                    <button onClick={handlePortal} className="text-orange-500 text-sm font-medium hover:underline">
                      Ver en Stripe →
                    </button>
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">
                    No hay pagos Stripe registrados para {company?.name ?? 'esta empresa'}.
                  </p>
                )}
              </div>

              {/* Verificación por cliente */}
              <div className="bg-white border border-gray-200 rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-5 h-5 text-gray-500" />
                  <h2 className="text-lg font-semibold text-gray-900">Verificación por cliente</h2>
                </div>
                <p className="text-sm text-gray-500 mb-4">
                  Revisa qué clientes tienen GPS activo, vehículos asignados y estado del servicio.
                </p>

                {filteredClients.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-8">No hay clientes registrados en esta empresa.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {filteredClients.map(client => (
                      <div key={client.id} className="py-4 first:pt-0 last:pb-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <Link href={`/drivers/${client.id}`} className="font-medium text-gray-900 hover:text-orange-500">
                                {client.full_name}
                              </Link>
                              <span className={`text-xs px-2 py-0.5 rounded-full ${client.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                {client.is_active ? 'Activo' : 'Inactivo'}
                              </span>
                            </div>
                            <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-gray-500">
                              {client.phone && <span>{client.phone}</span>}
                              {client.email && <span>{client.email}</span>}
                            </div>
                          </div>
                          <div className="flex gap-4 text-center flex-shrink-0">
                            <div>
                              <div className="text-lg font-bold text-gray-900">{client.gps_devices}</div>
                              <div className="text-xs text-gray-400 flex items-center gap-1"><Radio className="w-3 h-3" />GPS</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-gray-900">{client.active_vehicles}</div>
                              <div className="text-xs text-gray-400 flex items-center gap-1"><Truck className="w-3 h-3" />Activos</div>
                            </div>
                          </div>
                        </div>

                        {client.vehicles.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {client.vehicles.map(v => (
                              <span key={v.id} className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1 text-gray-600">
                                {v.economic_num} ({v.plates})
                                {v.device
                                  ? <span className="text-green-600 ml-1">· GPS {v.device.status}</span>
                                  : <span className="text-orange-500 ml-1">· Sin GPS</span>}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'suscripcion' && (
            <>
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-lg font-semibold text-gray-900">Plan {currentPlan?.name ?? 'Básico'}</h2>
              <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${statusConfig.color}`}>
                {statusConfig.label}
              </span>
            </div>
                    {company && <p className="text-sm text-gray-500 mb-1">{company.name}</p>}
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
                    Hay un problema con el método de pago. Actualízalo para mantener el acceso.
          </div>
        )}
      </div>

              {!isPlatformAdmin && (
                <>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plans.map(plan => {
                      const isCurrent    = plan.id === currentPlan?.id
                      const price        = billing === 'monthly' ? plan.price_monthly : plan.price_yearly / 12
                      const isLoading    = loadingPlan === plan.id
          const isEnterprise = plan.type === 'empresarial'

          return (
            <div key={plan.id} className={`relative bg-white border rounded-2xl p-6 flex flex-col
                          ${isCurrent ? 'border-orange-400 ring-2 ring-orange-100' : isEnterprise ? 'border-purple-200' : 'border-gray-200'}`}>
              {isCurrent && (
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-orange-500 text-white text-xs px-3 py-1 rounded-full font-medium">
                  Plan actual
                </div>
              )}
              <div className="mb-4">
                <div className="text-lg font-bold text-gray-900">{plan.name}</div>
                <div className="flex items-baseline gap-1 mt-2">
                  <span className="text-3xl font-bold text-gray-900">${price.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</span>
                  <span className="text-sm text-gray-500">MXN/mes</span>
                </div>
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
                    </div>
                  )
                })}
              </div>
              <button
                onClick={() => !isCurrent && handleUpgrade(plan.id)}
                disabled={isCurrent || isLoading}
                className={`w-full py-3 rounded-xl text-sm font-medium transition flex items-center justify-center gap-2
                  ${isCurrent ? 'bg-gray-100 text-gray-400 cursor-default' :
                                isEnterprise ? 'bg-purple-600 hover:bg-purple-700 text-white' : 'bg-orange-500 hover:bg-orange-600 text-white'}`}
              >
                {isLoading ? <><Loader2 className="w-4 h-4 animate-spin" /> Procesando...</> :
                 isCurrent ? 'Plan activo' : 'Seleccionar plan'}
              </button>
            </div>
          )
        })}
      </div>
                </>
              )}
            </>
          )}
        </>
      )}
      </>
      )}
    </div>
  )
}
