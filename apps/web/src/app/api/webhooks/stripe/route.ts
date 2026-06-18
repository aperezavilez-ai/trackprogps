import { NextResponse, type NextRequest } from 'next/server'
import Stripe from 'stripe'
import { createSupabaseServiceClient } from '@/lib/supabase/server'

const stripe = new Stripe(process.env['STRIPE_SECRET_KEY']!, {
  apiVersion: '2024-06-20',
})

export async function POST(request: NextRequest) {
  const body   = await request.text()
  const sig    = request.headers.get('stripe-signature')
  const secret = process.env['STRIPE_WEBHOOK_SECRET']!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, sig!, secret)
  } catch (err) {
    console.error('Stripe webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = createSupabaseServiceClient()

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      const companyId = session.metadata?.company_id
      const planId = session.metadata?.plan_id
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id
      const subscriptionId = typeof session.subscription === 'string'
        ? session.subscription
        : session.subscription?.id

      if (companyId) {
        const { data: companyRow } = await supabase
          .from('companies')
          .select('settings')
          .eq('id', companyId)
          .single()

        const prevSettings = (companyRow?.settings ?? {}) as Record<string, unknown>
        const { demo_tour: _removed, ...restSettings } = prevSettings

        const subPatch: Record<string, string> = {}
        if (customerId) subPatch.stripe_customer_id = customerId
        if (subscriptionId) subPatch.stripe_subscription_id = subscriptionId
        if (planId) subPatch.plan_id = planId
        subPatch.status = 'active'

        if (Object.keys(subPatch).length > 0) {
          await supabase.from('subscriptions').update(subPatch).eq('company_id', companyId)
        }

        const companyPatch: Record<string, unknown> = {
          status: 'active',
          settings: restSettings,
        }
        if (planId) companyPatch.plan_id = planId
        await supabase.from('companies').update(companyPatch).eq('id', companyId)
      }
      break
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string
      const planId = subscription.metadata?.plan_id

      // Find company by stripe customer id
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('company_id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (sub) {
        const status = mapStripeStatus(subscription.status)

        const subUpdate: Record<string, unknown> = {
          status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end:   new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          stripe_subscription_id: subscription.id,
        }
        if (planId) subUpdate.plan_id = planId

        await supabase
          .from('subscriptions')
          .update(subUpdate)
          .eq('company_id', sub.company_id)

        if (planId) {
          await supabase.from('companies').update({ plan_id: planId }).eq('id', sub.company_id)
        }

        // Suspend or reactivate company
        if (status === 'past_due' || status === 'cancelled') {
          await supabase
            .from('companies')
            .update({ status: 'suspended' })
            .eq('id', sub.company_id)
        } else if (status === 'active') {
          await supabase
            .from('companies')
            .update({ status: 'active' })
            .eq('id', sub.company_id)
        }
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('company_id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (sub) {
        await supabase
          .from('subscriptions')
          .update({ status: 'past_due' })
          .eq('company_id', sub.company_id)

        // Send payment failure notification (via Supabase Edge Function)
        await supabase.functions.invoke('send-payment-failed-email', {
          body: { company_id: sub.company_id },
        })
      }
      break
    }

    case 'invoice.payment_succeeded': {
      const invoice = event.data.object as Stripe.Invoice
      const customerId = invoice.customer as string

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('company_id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (sub) {
        await supabase
          .from('subscriptions')
          .update({ status: 'active' })
          .eq('company_id', sub.company_id)

        await supabase
          .from('companies')
          .update({ status: 'active' })
          .eq('id', sub.company_id)
      }
      break
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription
      const customerId = subscription.customer as string

      const { data: sub } = await supabase
        .from('subscriptions')
        .select('company_id')
        .eq('stripe_customer_id', customerId)
        .single()

      if (sub) {
        await supabase
          .from('subscriptions')
          .update({ status: 'cancelled' })
          .eq('company_id', sub.company_id)

        await supabase
          .from('companies')
          .update({ status: 'suspended' })
          .eq('id', sub.company_id)
      }
      break
    }
  }

  return NextResponse.json({ received: true })
}

function mapStripeStatus(status: Stripe.Subscription.Status): string {
  const map: Record<Stripe.Subscription.Status, string> = {
    active:             'active',
    past_due:           'past_due',
    canceled:           'cancelled',
    unpaid:             'past_due',
    trialing:           'trialing',
    incomplete:         'past_due',
    incomplete_expired: 'cancelled',
    paused:             'past_due',
  }
  return map[status] ?? 'past_due'
}
