import { createSupabaseServerClient } from '@/lib/supabase/server'
import { BillingClient } from '@/components/billing/billing-client'
import { isSuperAdmin } from '@/lib/auth/scope'

export const dynamic = 'force-dynamic'

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { tab?: string; checkout?: string; success?: string; trial_expired?: string }
}) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('company_id, role')
    .eq('id', user.id)
    .single()

  if (!profile || !['super_admin', 'admin_empresa'].includes(profile.role)) {
    return <div className="p-6 text-gray-500">No tienes permiso para ver esta sección.</div>
  }

  const defaultTab = searchParams.tab === 'pagos' ? 'pagos'
    : searchParams.tab === 'suscripcion' || searchParams.checkout === '1' || searchParams.success === '1' ? 'suscripcion'
    : 'facturas'

  const autoCheckout = searchParams.checkout === '1'

  if (isSuperAdmin(profile) && !profile.company_id) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-gray-900">Facturación</h1>
          <p className="text-sm text-gray-500 mt-1">Gestión de facturación de la plataforma</p>
        </div>
        <BillingClient
          subscription={null}
          plans={[]}
          company={null}
          defaultTab={defaultTab}
          isPlatformAdmin
          billingSettings={null}
        />
      </div>
    )
  }

  const [{ data: subscription }, { data: plans }, { data: company }] = await Promise.all([
    supabase.from('subscriptions').select('*, plan:plans(*)').eq('company_id', profile.company_id!).single(),
    supabase.from('plans').select('*').eq('is_active', true).order('price_monthly'),
    supabase.from('companies').select('name, email, status, settings').eq('id', profile.company_id!).single(),
  ])

  const billingSettings = (company?.settings as Record<string, unknown> | null)?.['billing_cfdi'] ?? null
  const pendingCheckout = (company?.settings as Record<string, unknown> | null)?.['pending_checkout'] as
    { plan_id: string; billing_period: 'monthly' | 'yearly' } | undefined

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Facturación</h1>
        <p className="text-sm text-gray-500 mt-1">Facturas CFDI, pagos y suscripción de tu empresa</p>
        {searchParams.trial_expired === '1' && (
          <p className="mt-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            Tu período de prueba terminó. Elige un plan para reactivar el acceso a mapa, alertas e historial.
          </p>
        )}
        {searchParams.success === '1' && (
          <p className="mt-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2 inline-block">
            Pago recibido. Tu suscripción se actualizará en unos momentos.
          </p>
        )}
        {autoCheckout && pendingCheckout?.plan_id && (
          <p className="mt-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
            Redirigiendo al checkout seguro de Stripe para activar tu plan…
          </p>
        )}
      </div>
      <BillingClient
        subscription={subscription}
        plans={plans ?? []}
        company={company ? { ...company, id: profile.company_id! } : null}
        defaultTab={defaultTab}
        billingSettings={billingSettings as Record<string, string> | null}
        pendingCheckout={pendingCheckout ?? null}
        autoCheckout={autoCheckout}
      />
    </div>
  )
}
