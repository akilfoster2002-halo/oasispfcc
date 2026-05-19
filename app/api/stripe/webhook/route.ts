import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'
import { NextRequest } from 'next/server'

function stripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' })
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )
}

const PLAN_FROM_PRICE: Record<string, string> = {
  [process.env.STRIPE_PRICE_STARTER!]:      'starter',
  [process.env.STRIPE_PRICE_GROWTH!]:       'growth',
  [process.env.STRIPE_PRICE_INTELLIGENCE!]: 'intelligence',
}

function statusFromStripe(status: Stripe.Subscription.Status): string {
  const map: Record<string, string> = {
    active:            'active',
    trialing:          'trialing',
    past_due:          'past_due',
    canceled:          'canceled',
    unpaid:            'unpaid',
    incomplete:        'past_due',
    incomplete_expired:'canceled',
    paused:            'canceled',
  }
  return map[status] ?? 'canceled'
}

async function handleSubscription(sub: Stripe.Subscription) {
  const churchId = sub.metadata?.church_id
  if (!churchId) return

  const priceId = sub.items.data[0]?.price.id
  const plan = PLAN_FROM_PRICE[priceId] ?? 'starter'
  const status = statusFromStripe(sub.status)
  // current_period_end lives on the subscription item in newer API versions
  const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end
    ?? sub.items.data[0]?.current_period_end
  const expiresAt = periodEnd ? new Date(periodEnd * 1000).toISOString() : null

  await adminClient()
    .from('churches')
    .update({
      stripe_subscription_id: sub.id,
      plan,
      plan_status: status,
      plan_expires_at: expiresAt,
    })
    .eq('id', churchId)
}

export async function POST(req: NextRequest) {
  const body = await req.text()
  const sig = req.headers.get('stripe-signature')!

  let event: Stripe.Event
  try {
    event = stripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!)
  } catch {
    return Response.json({ error: 'Invalid signature' }, { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session

      if (session.metadata?.type === 'giving') {
        const churchId = session.metadata.church_id
        const fund = session.metadata.fund ?? 'General'
        const personName = session.metadata.person_name ?? 'Anonymous'
        const amount = (session.amount_total ?? 0) / 100
        await adminClient()
          .from('giving')
          .insert({
            church_id: churchId,
            person_id: null,
            person_name: personName,
            amount,
            fund,
            method: 'online',
            given_at: new Date().toISOString().slice(0, 10),
            notes: `Stripe online giving – ${session.id}`,
          })
        break
      }

      if (session.mode === 'subscription' && session.subscription) {
        const sub = await stripe().subscriptions.retrieve(session.subscription as string)
        if (!sub.metadata?.church_id && session.metadata?.church_id) {
          await stripe().subscriptions.update(sub.id, {
            metadata: { church_id: session.metadata.church_id, plan: session.metadata.plan },
          })
          sub.metadata = { ...sub.metadata, ...session.metadata }
        }
        await handleSubscription(sub)
      }
      break
    }
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await handleSubscription(event.data.object as Stripe.Subscription)
      break
  }

  return Response.json({ received: true })
}
