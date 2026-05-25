import Stripe from 'stripe'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

const PRICE_IDS: Record<string, string> = {
  starter:      process.env.STRIPE_PRICE_STARTER!,
  growth:       process.env.STRIPE_PRICE_GROWTH!,
  intelligence: process.env.STRIPE_PRICE_INTELLIGENCE!,
}

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

export async function POST(req: Request) {
  const { plan } = await req.json()
  const priceId = PRICE_IDS[plan]
  if (!priceId) return Response.json({ error: 'Invalid plan' }, { status: 400 })

  // Get the logged-in user
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  // Find the church this user administers
  const admin = adminClient()
  const { data: membership } = await admin
    .from('church_memberships')
    .select('church_id, church:churches(id, name, stripe_customer_id, slug)')
    .eq('user_id', user.id)
    .in('role', ['master', 'admin', 'pastor'])
    .eq('status', 'approved')
    .order('created_at', { ascending: true })
    .limit(1)
    .single()

  if (!membership) return Response.json({ error: 'No church found for this account' }, { status: 404 })

  const church = membership.church as unknown as { id: string; name: string; stripe_customer_id: string | null; slug: string }

  const s = stripe()
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  // Get or create Stripe customer
  let customerId = church.stripe_customer_id
  if (!customerId) {
    const customer = await s.customers.create({
      email: user.email,
      name: church.name,
      metadata: { church_id: church.id, church_slug: church.slug },
    })
    customerId = customer.id
    await admin.from('churches').update({ stripe_customer_id: customerId }).eq('id', church.id)
  }

  const session = await s.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${appUrl}/${church.slug}/dashboard?upgraded=1`,
    cancel_url: `${appUrl}/pricing`,
    metadata: { church_id: church.id, plan },
    subscription_data: { metadata: { church_id: church.id, plan } },
    allow_promotion_codes: true,
  })

  return Response.json({ url: session.url })
}
