import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase-server'
import { normalizeAccessKey } from '@/lib/access-key'
import { rateLimit, clientIpFrom } from '@/lib/rate-limit'

export async function POST(req: NextRequest) {
  // ── Rate limit ─────────────────────────────────────────────────────────────
  // Per-IP cap blocks scanners; per-email cap stops credential-stuffing one address.
  const ip = clientIpFrom(req)
  const ipLimit = rateLimit({ key: `signup:ip:${ip}`, limit: 20, windowMs: 60 * 60 * 1000 })
  if (!ipLimit.allowed) {
    return Response.json(
      { error: 'Too many signup attempts from this network. Try again in an hour.' },
      { status: 429, headers: { 'Retry-After': Math.ceil(ipLimit.retryAfterMs / 1000).toString() } },
    )
  }

  const { name, email, password, accessKey, refCode } = await req.json()
  if (!name || !email || !password) {
    return Response.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (typeof password !== 'string' || password.length < 8) {
    return Response.json({ error: 'Password must be at least 8 characters.' }, { status: 400 })
  }

  const emailLimit = rateLimit({ key: `signup:email:${String(email).toLowerCase()}`, limit: 5, windowMs: 60 * 60 * 1000 })
  if (!emailLimit.allowed) {
    return Response.json(
      { error: 'Too many signup attempts for this email. Try again in an hour.' },
      { status: 429 },
    )
  }

  const admin = getSupabaseServer()

  // ── Validate access key (optional) ─────────────────────────────────────────
  let church: { id: string; slug: string } | null = null
  if (accessKey) {
    const normalized = normalizeAccessKey(accessKey)
    if (!normalized) {
      return Response.json({ error: 'Access keys are 8 characters, like XXXX-XXXX.' }, { status: 400 })
    }
    const { data } = await admin
      .from('churches')
      .select('id, slug, access_key_expires_at')
      .eq('access_key', normalized)
      .single()

    if (!data) {
      return Response.json({ error: 'Invalid access key' }, { status: 400 })
    }
    if (!data.access_key_expires_at || new Date(data.access_key_expires_at) <= new Date()) {
      return Response.json(
        { error: 'This access key has expired. Ask your church admin for the current key.' },
        { status: 400 },
      )
    }
    church = { id: data.id, slug: data.slug }
  }

  // ── Create the auth user ───────────────────────────────────────────────────
  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: name, name },
  })

  if (userError || !userData.user) {
    return Response.json({ error: userError?.message ?? 'Failed to create user' }, { status: 400 })
  }

  const userId = userData.user.id

  // ── Attach to church (with orphan cleanup) ────────────────────────────────
  if (church) {
    const { error: membershipError } = await admin.from('church_memberships').insert({
      user_id: userId,
      church_id: church.id,
      role: 'member',
      status: 'approved',
      joined_via: 'access_key',
    })

    if (membershipError) {
      // Roll back the auth user so the customer can retry signup without a
      // "this email already exists" wall.
      await admin.auth.admin.deleteUser(userId).catch(() => { /* best effort */ })
      return Response.json(
        { error: 'Could not finish creating your account. Please try again.' },
        { status: 500 },
      )
    }
  }

  // ── Establish a session server-side so the client doesn't need to sign in again. ──
  // If this fails we still return success — the client will fall back to its own
  // signInWithPassword call. `sessionEstablished` tells it whether to skip that.
  let sessionEstablished = false
  try {
    const cookieStore = await cookies()
    const sessionClient = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: (cookiesToSet) => {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      },
    )
    const { error: signInErr } = await sessionClient.auth.signInWithPassword({ email, password })
    if (!signInErr) sessionEstablished = true
  } catch {
    // Swallow: the client will fall back. We don't want signup to fail just
    // because cookies couldn't be set (e.g. middleware quirks).
  }

  // ── Handle referral bonus ─────────────────────────────────────────────────
  if (refCode && typeof refCode === 'string') {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { data: referrer } = await admin
        .from('churches')
        .select('id')
        .eq('ref_code', refCode.toUpperCase())
        .single()

      if (referrer) {
        // Give referrer +5 messages today by storing negative usage (offsets their count)
        const { data: existing } = await admin
          .from('agent_daily_usage')
          .select('messages_used')
          .eq('church_id', referrer.id)
          .eq('usage_date', today)
          .maybeSingle()

        await admin.from('agent_daily_usage').upsert(
          {
            church_id: referrer.id,
            usage_date: today,
            messages_used: existing ? Math.max(0, existing.messages_used - 5) : -5,
          },
          { onConflict: 'church_id,usage_date' },
        )

        // Give the new church +5 on day 1 if they created a new workspace (no access key)
        // If they joined via access key, give the joined church a day-1 bonus
        const targetChurchId = church?.id
        if (targetChurchId && targetChurchId !== referrer.id) {
          await admin.from('agent_daily_usage').upsert(
            { church_id: targetChurchId, usage_date: today, messages_used: -5 },
            { onConflict: 'church_id,usage_date' },
          )
        }
      }
    } catch {
      // Referral bonus is best-effort — don't fail signup
    }
  }

  return Response.json({
    slug: church?.slug ?? null,
    sessionEstablished,
  })
}
