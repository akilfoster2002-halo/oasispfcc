import Stripe from 'stripe'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'

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
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll() } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = adminClient()
  const { data: membership } = await admin
    .from('church_memberships')
    .select('church:churches(stripe_customer_id, slug)')
    .eq('user_id', user.id)
    .in('role', ['admin', 'pastor'])
    .eq('status', 'approved')
    .limit(1)
    .single()

  const church = membership?.church as unknown as { stripe_customer_id: string | null; slug: string } | null
  if (!church?.stripe_customer_id) {
    return Response.json({ error: 'No billing account found' }, { status: 404 })
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')

  const session = await stripe().billingPortal.sessions.create({
    customer: church.stripe_customer_id,
    return_url: `${appUrl}/${church.slug}/settings/billing`,
  })

  return Response.json({ url: session.url })
}
