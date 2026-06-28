import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isSuperAdmin } from '@/lib/auth/scope'

export async function GET() {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !isSuperAdmin(profile)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const [
    { data: subscriptions },
    { count: totalCompanies },
    { count: activeCompanies },
    { count: demoCompanies },
  ] = await Promise.all([
    supabase
      .from('subscriptions')
      .select(`
        id, status, current_period_end, stripe_subscription_id,
        company:companies(id, name, email, status),
        plan:plans(id, name, type, price_monthly, price_yearly)
      `)
      .order('current_period_end', { ascending: false }),
    supabase.from('companies').select('*', { count: 'exact', head: true }),
    supabase.from('companies').select('*', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('companies').select('*', { count: 'exact', head: true }).eq('status', 'demo'),
  ])

  const rows = subscriptions ?? []
  const paying = rows.filter(s => s.status === 'active' || s.status === 'trialing')
  const pastDue = rows.filter(s => s.status === 'past_due')
  const withStripe = rows.filter(s => s.stripe_subscription_id)

  const estimatedMrr = paying.reduce((sum, sub) => {
    const plan = sub.plan as { price_monthly?: number } | null
    return sum + (plan?.price_monthly ?? 0)
  }, 0)

  const byPlan: Record<string, { count: number; mrr: number }> = {}
  for (const sub of paying) {
    const plan = sub.plan as { name?: string; price_monthly?: number } | null
    const key = plan?.name ?? 'Sin plan'
    if (!byPlan[key]) byPlan[key] = { count: 0, mrr: 0 }
    byPlan[key].count += 1
    byPlan[key].mrr += plan?.price_monthly ?? 0
  }

  const companies = paying.map(sub => {
    const company = sub.company as { id: string; name: string; email: string; status: string } | null
    const plan = sub.plan as { name: string; price_monthly: number } | null
    return {
      company_id: company?.id ?? '',
      company_name: company?.name ?? '—',
      company_status: company?.status ?? '—',
      plan_name: plan?.name ?? '—',
      subscription_status: sub.status,
      monthly_amount: plan?.price_monthly ?? 0,
      period_end: sub.current_period_end,
      has_stripe: Boolean(sub.stripe_subscription_id),
    }
  })

  return NextResponse.json({
    summary: {
      estimated_mrr: estimatedMrr,
      paying_companies: paying.length,
      past_due: pastDue.length,
      with_stripe: withStripe.length,
      total_companies: totalCompanies ?? 0,
      active_companies: activeCompanies ?? 0,
      demo_companies: demoCompanies ?? 0,
    },
    by_plan: Object.entries(byPlan).map(([name, v]) => ({ name, ...v })),
    companies,
  })
}
