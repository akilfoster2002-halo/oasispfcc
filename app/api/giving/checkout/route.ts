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

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { slug, amount, fund = 'General', name, email } = body

  if (!slug || !amount || !name) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const cents = Math.round(parseFloat(amount) * 100)
  if (isNaN(cents) || cents < 50) {
    return Response.json({ error: 'Minimum gift is $0.50' }, { status: 400 })
  }

  const { data: church } = await adminClient()
    .from('churches')
    .select('id, name')
    .eq('slug', slug)
    .single()

  if (!church) return Response.json({ error: 'Church not found' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://aquila.church'

  const session = await stripe().checkout.sessions.create({
    mode: 'payment',
    customer_email: email || undefined,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: cents,
        product_data: {
          name: `${fund} Giving`,
          description: `Online giving to ${church.name}`,
        },
      },
    }],
    metadata: {
      type: 'giving',
      church_id: church.id,
      church_slug: slug,
      fund,
      person_name: name,
      person_email: email ?? '',
    },
    success_url: `${appUrl}/give/${slug}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/give/${slug}`,
  })

  return Response.json({ url: session.url })
}
