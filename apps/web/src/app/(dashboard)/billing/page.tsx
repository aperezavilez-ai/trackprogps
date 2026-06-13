import { createSupabaseServerClient } from '@/lib/supabase/server'
import { BillingClient } from '@/components/billing/billing-client'

export const dynamic = 'force-dynamic'

export default async function BillingPage() {
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

  const [{ data: subscription }, { data: plans }, { data: company }] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('*, plan:plans(*)')
      .eq('company_id', profile.company_id)
      .single(),
    supabase
      .from('plans')
      .select('*')
      .eq('is_active', true)
      .order('price_monthly'),
    supabase
      .from('companies')
      .select('name, email, status')
      .eq('id', profile.company_id)
      .single(),
  ])

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Facturación</h1>
        <p className="text-sm text-gray-500 mt-1">Administra tu suscripción y plan</p>
      </div>
      <BillingClient subscription={subscription} plans={plans ?? []} company={company} />
    </div>
  )
}
