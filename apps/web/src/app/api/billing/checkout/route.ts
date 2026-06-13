import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY']!, { apiVersion: '2024-06-20' })

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { plan_id, billing_period } = await request.json()

  const { data: profile } = await supabase.from('users')
    .select('company_id, company:companies(name, email)')
    .eq('id', user.id).single()
  if (!profile?.company_id) return NextResponse.json({ error: 'No company' }, { status: 400 })

  const { data: plan } = await supabase.from('plans').select('*').eq('id', plan_id).single()
  if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 })

  // Get or create Stripe customer
  const { data: sub } = await supabase.from('subscriptions')
    .select('stripe_customer_id').eq('company_id', profile.company_id).single()

  let customerId = sub?.stripe_customer_id
  if (!customerId) {
    const company = profile.company as { name: string; email: string } | null
    const customer = await stripe.customers.create({
      email: company?.email ?? user.email ?? '',
      name:  company?.name ?? '',
      metadata: { company_id: profile.company_id },
    })
    customerId = customer.id
    await supabase.from('subscriptions').update({ stripe_customer_id: customerId }).eq('company_id', profile.company_id)
  }

  // Create Stripe price dynamically (or use pre-created price IDs)
  const amount = billing_period === 'yearly' ? plan.price_yearly : plan.price_monthly
  const price  = await stripe.prices.create({
    currency:     'mxn',
    unit_amount:  Math.round(amount * 100),
    recurring: { interval: billing_period === 'yearly' ? 'year' : 'month' },
    product_data: { name: `TrackPro ${plan.name}` },
  })

  const session = await stripe.checkout.sessions.create({
    customer:     customerId,
    mode:         'subscription',
    line_items:   [{ price: price.id, quantity: 1 }],
    success_url:  `${process.env['NEXT_PUBLIC_APP_URL']}/billing?success=1`,
    cancel_url:   `${process.env['NEXT_PUBLIC_APP_URL']}/billing`,
    metadata:     { company_id: profile.company_id, plan_id },
    subscription_data: { metadata: { company_id: profile.company_id, plan_id } },
  })

  return NextResponse.json({ checkout_url: session.url })
}
