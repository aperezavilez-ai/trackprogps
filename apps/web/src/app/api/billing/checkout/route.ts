import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import { resolvePlanId } from '@/lib/billing/resolve-plan'

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY']!, { apiVersion: '2024-06-20' })

export async function POST(request: NextRequest) {
  if (!process.env['STRIPE_SECRET_KEY']) {
    return NextResponse.json({ error: 'Stripe no configurado' }, { status: 503 })
  }

  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  let planId = body.plan_id as string | undefined
  let billingPeriod = (body.billing_period as 'monthly' | 'yearly' | undefined) ?? 'monthly'

  const { data: profile } = await supabase.from('users')
    .select('company_id, company:companies(name, email, settings)')
    .eq('id', user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: 'No company' }, { status: 400 })

  const company = profile.company as { name: string; email: string; settings: Record<string, unknown> } | null
  const settings = company?.settings ?? {}
  const pending = settings['pending_checkout'] as { plan_id?: string; billing_period?: 'monthly' | 'yearly' } | undefined

  if (!planId && pending?.plan_id) {
    planId = pending.plan_id
    billingPeriod = pending.billing_period ?? billingPeriod
  }

  if (!planId) return NextResponse.json({ error: 'Plan requerido' }, { status: 422 })

  const resolvedPlanId = await resolvePlanId(supabase, planId)
  if (!resolvedPlanId) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  const { data: plan } = await supabase.from('plans').select('*').eq('id', resolvedPlanId).single()
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  const { data: sub } = await supabase.from('subscriptions')
    .select('stripe_customer_id').eq('company_id', profile.company_id).maybeSingle()

  let customerId = sub?.stripe_customer_id
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: company?.email ?? user.email ?? '',
      name: company?.name ?? '',
      metadata: { company_id: profile.company_id },
    })
    customerId = customer.id
    if (sub) {
      await supabase.from('subscriptions').update({ stripe_customer_id: customerId }).eq('company_id', profile.company_id)
    } else {
      await supabase.from('subscriptions').insert({
        company_id: profile.company_id,
        plan_id: resolvedPlanId,
        stripe_customer_id: customerId,
        status: 'cancelled',
        current_period_start: new Date().toISOString(),
      })
    }
  }

  const amount = billingPeriod === 'yearly' ? plan.price_yearly : plan.price_monthly
  const price = await stripe.prices.create({
    currency: 'mxn',
    unit_amount: Math.round(amount * 100),
    recurring: { interval: billingPeriod === 'yearly' ? 'year' : 'month' },
    product_data: { name: `TrackPro ${plan.name}` },
  })

  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://trackprogps.mx'

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: price.id, quantity: 1 }],
    success_url: `${appUrl}/billing?success=1&tab=suscripcion`,
    cancel_url: `${appUrl}/billing?tab=suscripcion`,
    metadata: { company_id: profile.company_id, plan_id: resolvedPlanId },
    subscription_data: { metadata: { company_id: profile.company_id, plan_id: resolvedPlanId } },
  })

  const { pending_checkout: _, ...restSettings } = settings
  await supabase
    .from('companies')
    .update({ settings: restSettings, updated_at: new Date().toISOString() })
    .eq('id', profile.company_id)

  return NextResponse.json({ checkout_url: session.url })
}
